import socketAuth from "../middleware/socketAuth.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { aiChatSecurityService } from "../services/aiChatSecurityService.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

// In-memory presence tracker: maps userId -> Set of active socketIds (for multi-tab support)
const userSocketsMap = new Map();

// In-memory rate limiting tracker: maps socketId -> array of message timestamps (sliding window)
const socketRateLimits = new Map();

/**
 * Checks if a user is currently online (has at least 1 active socket connection)
 * @param {string} userId
 * @returns {boolean}
 */
export const isUserOnline = (userId) => {
  const sockets = userSocketsMap.get(userId?.toString());
  return Boolean(sockets && sockets.size > 0);
};

/**
 * Returns array of currently active user IDs
 * @returns {string[]}
 */
export const getActiveUserIds = () => {
  return Array.from(userSocketsMap.keys());
};

/**
 * Enforces per-socket message rate limiting (max 5 messages per 3 seconds)
 * @param {string} socketId
 * @returns {boolean} True if allowed, false if limit exceeded
 */
const checkSocketRateLimit = (socketId) => {
  const now = Date.now();
  const windowMs = 3000;
  const maxMessages = 5;

  let timestamps = socketRateLimits.get(socketId) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= maxMessages) {
    return false;
  }

  timestamps.push(now);
  socketRateLimits.set(socketId, timestamps);
  return true;
};

/**
 * Initializes Socket.IO chat engine
 * @param {import("socket.io").Server} io
 */
export const initChatSocket = (io) => {
  // 1. Handshake authentication
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = socket.userId;

    // 2. Register socket in presence map
    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }
    const userSockets = userSocketsMap.get(userId);
    userSockets.add(socket.id);

    // If this is the user's first active connection, broadcast online status
    if (userSockets.size === 1) {
      io.emit("user_online", { userId });
    }

    // Join personal notification room
    socket.join(`user:${userId}`);

    // Send the current list of online users to the newly connected client
    socket.emit("online_users", Array.from(userSocketsMap.keys()));

    // 3. Join conversation room with participant verification
    socket.on("join_conversation", async (data, callback) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit("chat_error", { message: "Conversation not found" });
          if (typeof callback === "function") callback({ success: false, error: "Not found" });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );

        if (!isParticipant) {
          logSecurityEvent(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, {
            metadata: { reason: "Unauthorized conversation room join attempt", userId, conversationId },
          });
          socket.emit("chat_error", { message: "Unauthorized to join this conversation" });
          if (typeof callback === "function") callback({ success: false, error: "Unauthorized" });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        socket.emit("chat_error", { message: "Error joining conversation room" });
      }
    });

    // 4. Leave conversation room
    socket.on("leave_conversation", (data) => {
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // 5. Send message (with validation, rate limiting, and MongoDB persistence)
    socket.on("send_message", async (data, callback) => {
      try {
        // Anti-spam rate limiting check
        if (!checkSocketRateLimit(socket.id)) {
          socket.emit("chat_error", { message: "You are sending messages too quickly. Please wait a moment." });
          if (typeof callback === "function") callback({ success: false, error: "Rate limit exceeded" });
          return;
        }

        const { conversationId, content = "", messageType = "text", imageUrl = "" } = data || {};

        if (!conversationId) {
          if (typeof callback === "function") callback({ success: false, error: "conversationId required" });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit("chat_error", { message: "Conversation not found" });
          if (typeof callback === "function") callback({ success: false, error: "Conversation not found" });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) {
          socket.emit("chat_error", { message: "Unauthorized to send messages in this conversation" });
          if (typeof callback === "function") callback({ success: false, error: "Unauthorized" });
          return;
        }

        // Validate payload by type
        if (messageType === "text") {
          const trimmed = content.trim();
          if (!trimmed) {
            socket.emit("chat_error", { message: "Message content cannot be empty" });
            if (typeof callback === "function") callback({ success: false, error: "Empty message" });
            return;
          }
          if (trimmed.length > 2000) {
            socket.emit("chat_error", { message: "Message cannot exceed 2000 characters" });
            if (typeof callback === "function") callback({ success: false, error: "Message too long" });
            return;
          }
        } else if (messageType === "image") {
          if (!imageUrl || typeof imageUrl !== "string") {
            socket.emit("chat_error", { message: "Invalid image URL" });
            if (typeof callback === "function") callback({ success: false, error: "Missing image" });
            return;
          }
        }

        const receiverId = conversation.participants
          .find((p) => p.toString() !== userId)
          ?.toString();

        // Optional non-blocking AI scam screening
        let securityAnalysis = { risk: "low", category: "normal", reason: "" };
        if (messageType === "text") {
          securityAnalysis = await aiChatSecurityService.analyzeMessageSecurity(content);
        }

        // Save to MongoDB BEFORE considering message sent
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          receiver: receiverId,
          content: messageType === "text" ? content.trim() : "",
          messageType,
          imageUrl: messageType === "image" ? imageUrl : "",
          securityAnalysis,
        });

        // Update conversation summary
        const preview = messageType === "image" ? "📷 Photo" : content.trim().slice(0, 100);
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          lastMessageContent: preview,
          lastMessageAt: message.createdAt,
        });

        // Populate sender info for the client
        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "name profileImage department")
          .lean();

        // Broadcast to everyone in this active conversation room
        io.to(`conversation:${conversationId}`).emit("new_message", populatedMessage);

        // Also emit notification to the receiver's personal user room
        if (receiverId) {
          io.to(`user:${receiverId}`).emit("notification_new_message", {
            conversationId,
            message: populatedMessage,
          });
        }

        if (typeof callback === "function") {
          callback({ success: true, message: populatedMessage });
        }
      } catch (error) {
        socket.emit("chat_error", { message: "Failed to send message" });
        if (typeof callback === "function") callback({ success: false, error: error.message });
      }
    });

    // 6. Typing indicators (throttled/debounced from client)
    socket.on("typing_start", (data) => {
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit("user_typing", {
          conversationId,
          userId,
        });
      }
    });

    socket.on("typing_stop", (data) => {
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit("user_stop_typing", {
          conversationId,
          userId,
        });
      }
    });

    // 7. Message read receipts
    socket.on("message_read", async (data, callback) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        const now = new Date();
        const updateResult = await Message.updateMany(
          {
            conversation: conversationId,
            receiver: userId,
            read: false,
          },
          {
            $set: { read: true, readAt: now },
          }
        );

        if (updateResult.modifiedCount > 0) {
          io.to(`conversation:${conversationId}`).emit("messages_read", {
            conversationId,
            readerId: userId,
            readAt: now,
          });
        }

        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        if (typeof callback === "function") callback({ success: false });
      }
    });

    // 8. Disconnect handling (multi-tab safe presence)
    socket.on("disconnect", () => {
      socketRateLimits.delete(socket.id);

      const sockets = userSocketsMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSocketsMap.delete(userId);
          // Broadcast offline event to all connected clients
          io.emit("user_offline", { userId });
        }
      }
    });
  });
};

export default initChatSocket;
