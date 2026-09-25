import socketAuth from "../middleware/socketAuth.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Block from "../models/Block.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

// In-memory presence tracker: maps userId -> Set of active socketIds (for multi-tab support)
const userSocketsMap = new Map();

// In-memory rate limiting tracker: maps socketId -> array of message timestamps (sliding window)
const socketRateLimits = new Map();

/**
 * Checks if an image URL is safe and trusted
 */
const isSafeImageUrl = (url) => {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith("https://res.cloudinary.com/") ||
    trimmed.startsWith("/uploads/") ||
    /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/uploads\/)/i.test(trimmed)
  );
};

const getParticipantId = (p) => (p && p._id ? p._id.toString() : p ? p.toString() : null);

/**
 * Helper to verify participant and non-blocked status for socket events
 */
const verifyConversationParticipant = async (convId, uId) => {
  if (!convId || !uId) return null;
  const conversation = await Conversation.findById(convId);
  if (!conversation || !Array.isArray(conversation.participants)) return null;

  const isParticipant = conversation.participants.some(
    (p) => getParticipantId(p) === uId.toString()
  );
  if (!isParticipant) return null;

  const otherParticipant = conversation.participants.find(
    (p) => getParticipantId(p) !== uId.toString()
  );
  const otherId = getParticipantId(otherParticipant);
  if (otherId && (await Block.isBlocked(uId, otherId))) {
    return null; // Blocked users cannot interact
  }

  return conversation;
};

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
 * Socket message rate limiting (Disabled)
 * @returns {boolean} Always returns true
 */
const checkSocketRateLimit = () => true;

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

    // 3. Join conversation room with participant and block verification
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
          (p) => getParticipantId(p) === userId
        );

        if (!isParticipant) {
          logSecurityEvent(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, {
            metadata: { reason: "Unauthorized conversation room join attempt", userId, conversationId },
          });
          socket.emit("chat_error", { message: "Unauthorized to join this conversation" });
          if (typeof callback === "function") callback({ success: false, error: "Unauthorized" });
          return;
        }

        const otherParticipant = conversation.participants.find(
          (p) => getParticipantId(p) !== userId
        );
        const otherId = getParticipantId(otherParticipant);
        if (otherId && (await Block.isBlocked(userId, otherId))) {
          socket.emit("chat_error", { message: "Cannot join room. Communication is blocked." });
          if (typeof callback === "function") callback({ success: false, error: "Blocked" });
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

    // 5. Send message in real-time
    socket.on("send_message", async (data, callback) => {
      try {
        // Enforce rate limiting
        if (!checkSocketRateLimit(socket.id)) {
          logSecurityEvent(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, {
            metadata: { reason: "Socket rate limit exceeded for sending messages", userId },
          });
          socket.emit("chat_error", { message: "Rate limit exceeded. Please slow down." });
          if (typeof callback === "function") callback({ success: false, error: "Rate limit exceeded" });
          return;
        }

        const {
          conversationId,
          content = "",
          messageType = "text",
          imageUrl = "",
          encryptionVersion = 0,
          ciphertext = "",
          iv = "",
          encryptedKey = "",
          senderEncryptedKey = "",
          keyFingerprint = "",
        } = data || {};

        if (!conversationId) {
          socket.emit("chat_error", { message: "conversationId is required" });
          if (typeof callback === "function") callback({ success: false, error: "conversationId is required" });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit("chat_error", { message: "Conversation not found" });
          if (typeof callback === "function") callback({ success: false, error: "Conversation not found" });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => getParticipantId(p) === userId
        );
        if (!isParticipant) {
          socket.emit("chat_error", { message: "Unauthorized to send messages in this conversation" });
          if (typeof callback === "function") callback({ success: false, error: "Unauthorized" });
          return;
        }

        const receiverParticipant = conversation.participants.find(
          (p) => getParticipantId(p) !== userId
        );
        const receiverId = getParticipantId(receiverParticipant);

        if (!receiverId) {
          socket.emit("chat_error", { message: "Recipient not found in conversation" });
          if (typeof callback === "function") callback({ success: false, error: "Recipient not found" });
          return;
        }

        // Enforce block status
        const isBlocked = await Block.isBlocked(userId, receiverId);
        if (isBlocked) {
          socket.emit("chat_error", { message: "Cannot send message. Communication between these users is blocked." });
          if (typeof callback === "function") callback({ success: false, error: "Blocked" });
          return;
        }

        // Validate payload by type
        const isEncrypted = Number(encryptionVersion) >= 1;
        if (isEncrypted) {
          if (!ciphertext || typeof ciphertext !== "string" || !ciphertext.trim()) {
            socket.emit("chat_error", { message: "Ciphertext is required for encrypted messages" });
            if (typeof callback === "function") callback({ success: false, error: "Ciphertext required" });
            return;
          }
          if (!iv || typeof iv !== "string" || !iv.trim()) {
            socket.emit("chat_error", { message: "IV is required for encrypted messages" });
            if (typeof callback === "function") callback({ success: false, error: "IV required" });
            return;
          }
          if (!encryptedKey || typeof encryptedKey !== "string" || !encryptedKey.trim()) {
            socket.emit("chat_error", { message: "encryptedKey is required for encrypted messages" });
            if (typeof callback === "function") callback({ success: false, error: "encryptedKey required" });
            return;
          }
        } else if (messageType === "text") {
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
          if (!imageUrl || typeof imageUrl !== "string" || !isSafeImageUrl(imageUrl)) {
            socket.emit("chat_error", { message: "Invalid or insecure image URL" });
            if (typeof callback === "function") callback({ success: false, error: "Invalid image URL" });
            return;
          }
        }

        // Save to MongoDB BEFORE considering message sent
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          receiver: receiverId,
          content: isEncrypted ? "" : (messageType === "text" ? content.trim() : ""),
          messageType,
          imageUrl: messageType === "image" ? imageUrl : "",
          encryptionVersion: isEncrypted ? Number(encryptionVersion) : 0,
          ciphertext: isEncrypted ? ciphertext.trim() : "",
          iv: isEncrypted ? iv.trim() : "",
          encryptedKey: isEncrypted ? encryptedKey.trim() : "",
          senderEncryptedKey: isEncrypted ? (senderEncryptedKey || "").trim() : "",
          keyFingerprint: isEncrypted ? (keyFingerprint || "").trim() : "",
        });

        // Update conversation summary
        const preview = isEncrypted
          ? "🔒 Encrypted Message"
          : (messageType === "image" ? "📷 Photo" : content.trim().slice(0, 100));
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

    // 6. Typing indicators (strictly authorized for conversation participants, blocked check)
    socket.on("typing_start", async (data) => {
      const conversationId = data?.conversationId;
      if (!conversationId) return;

      const authorized = await verifyConversationParticipant(conversationId, userId);
      if (!authorized) return;

      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        conversationId,
        userId,
      });
    });

    socket.on("typing_stop", async (data) => {
      const conversationId = data?.conversationId;
      if (!conversationId) return;

      const authorized = await verifyConversationParticipant(conversationId, userId);
      if (!authorized) return;

      socket.to(`conversation:${conversationId}`).emit("user_stop_typing", {
        conversationId,
        userId,
      });
    });

    // 7. Message read receipts (authorized for participants, with unread sync)
    const handleReadReceipt = async (data, callback) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) {
          if (typeof callback === "function") callback({ success: false, error: "Missing conversationId" });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (typeof callback === "function") callback({ success: false, error: "Not found" });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => getParticipantId(p) === userId
        );
        if (!isParticipant) {
          if (typeof callback === "function") callback({ success: false, error: "Unauthorized" });
          return;
        }

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

        // Authoritative unread count update for reader's other tabs
        const unreadTotal = await Message.countDocuments({
          receiver: userId,
          read: false,
        });
        io.to(`user:${userId}`).emit("unread_count_updated", { unreadTotal });

        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        if (typeof callback === "function") callback({ success: false });
      }
    };

    socket.on("message_read", handleReadReceipt);
    socket.on("mark_as_read", handleReadReceipt);


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
