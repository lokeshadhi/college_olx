import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Block from "../models/Block.js";
import Report, { REPORT_REASONS } from "../models/Report.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";

const getParticipantId = (p) => (p && p._id ? p._id.toString() : p ? p.toString() : null);

// @desc    Get total unread message count for authenticated user across all conversations
// @route   GET /api/chat/unread-count
// @access  Private
export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const count = await Message.countDocuments({
      receiver: userId,
      read: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all conversations for the authenticated user
// @route   GET /api/chat/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name email profileImage department")
      .populate({
        path: "product",
        select: "title price images status condition location owner seller",
      })
      .lean();

    // Attach real-time unread message counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          receiver: userId,
          read: false,
        });
        return {
          ...conv,
          unreadCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: conversationsWithUnread,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation metadata by ID
// @route   GET /api/chat/conversations/:conversationId
// @access  Private
export const getConversationById = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId)
      .populate("participants", "name email profileImage department")
      .populate({
        path: "product",
        select: "title price images status condition location owner seller",
      })
      .lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => getParticipantId(p) === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized to access this conversation" });
    }

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      receiver: req.user._id,
      read: false,
    });

    res.status(200).json({
      success: true,
      data: { ...conversation, unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Find or create a conversation for a product
// @route   POST /api/chat/conversations
// @access  Private
export const createOrGetConversation = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const currentUserId = req.user._id;

    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Disallow messaging oneself
    if (product.owner.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot start a conversation for your own product listing",
      });
    }

    // Check if communication between these users is blocked
    const isBlocked = await Block.isBlocked(currentUserId, product.owner);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Cannot start or access conversation. Communication is blocked between these users.",
      });
    }

    // Find existing conversation between these two users for this product
    let conversation = await Conversation.findOne({
      product: productId,
      participants: { $all: [currentUserId, product.owner] },
    })
      .populate("participants", "name email profileImage department")
      .populate({
        path: "product",
        select: "title price images status condition location owner seller",
      });

    if (!conversation) {
      // Create new conversation
      const newConv = await Conversation.create({
        participants: [currentUserId, product.owner],
        product: productId,
        lastMessageAt: new Date(),
      });

      conversation = await Conversation.findById(newConv._id)
        .populate("participants", "name email profileImage department")
        .populate({
          path: "product",
          select: "title price images status condition location owner seller",
        });
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated messages for a conversation
// @route   GET /api/chat/conversations/:conversationId/messages
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => getParticipantId(p) === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized to access messages in this conversation" });
    }

    const [rawMessages, totalMessages] = await Promise.all([
      Message.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "name profileImage department")
        .lean(),
      Message.countDocuments({ conversation: conversationId }),
    ]);

    // Reverse so the client receives them in chronological ascending order
    const messages = rawMessages.reverse();

    res.status(200).json({
      success: true,
      data: {
        messages,
        page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const isSafeImageUrl = (url) => {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith("https://res.cloudinary.com/") ||
    trimmed.startsWith("/uploads/") ||
    /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/uploads\/)/i.test(trimmed)
  );
};

// @desc    Send a message via REST (fallback or for file messages)
// @route   POST /api/chat/conversations/:conversationId/messages
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content = "", messageType = "text", imageUrl = "" } = req.body;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => getParticipantId(p) === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized to post to this conversation" });
    }

    const receiverParticipant = conversation.participants.find(
      (p) => getParticipantId(p) !== userId
    );
    const receiverId = getParticipantId(receiverParticipant);

    if (!receiverId) {
      return res.status(400).json({ success: false, message: "Recipient not found in conversation" });
    }

    // Check block status
    const isBlocked = await Block.isBlocked(userId, receiverId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Cannot send message. Communication between these users is blocked.",
      });
    }

    if (messageType === "text") {
      const trimmed = content.trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: "Message content cannot be empty" });
      }
      if (trimmed.length > 2000) {
        return res.status(400).json({ success: false, message: "Message exceeds 2000 character limit" });
      }
    } else if (messageType === "image") {
      if (!imageUrl || typeof imageUrl !== "string" || !isSafeImageUrl(imageUrl)) {
        return res.status(400).json({
          success: false,
          message: "Valid and secure imageUrl required for image messages",
        });
      }
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      receiver: receiverId,
      content: messageType === "text" ? content.trim() : "",
      messageType,
      imageUrl: messageType === "image" ? imageUrl : "",
    });

    const preview = messageType === "image" ? "📷 Photo" : content.trim().slice(0, 100);
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageContent: preview,
      lastMessageAt: message.createdAt,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name profileImage department")
      .lean();

    // If Socket.IO instance is available on Express app, emit real-time event
    const io = req.app.get("io");
    if (io) {
      io.to(`conversation:${conversationId}`).emit("new_message", populatedMessage);
      if (receiverId) {
        io.to(`user:${receiverId}`).emit("notification_new_message", {
          conversationId,
          message: populatedMessage,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all unread messages in conversation as read
// @route   POST /api/chat/conversations/:conversationId/read
// @access  Private
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => getParticipantId(p) === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized" });
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

    const io = req.app.get("io");
    if (io) {
      if (updateResult.modifiedCount > 0) {
        io.to(`conversation:${conversationId}`).emit("messages_read", {
          conversationId,
          readerId: userId,
          readAt: now,
        });
      }

      // Synchronize authoritative unread count across all user tabs
      const unreadTotal = await Message.countDocuments({
        receiver: userId,
        read: false,
      });
      io.to(`user:${userId}`).emit("unread_count_updated", { unreadTotal });
    }

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload an image for chat attachment
// @route   POST /api/chat/upload-image
// @access  Private
export const uploadChatImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const { conversationId } = req.body;
    if (conversationId) {
      const conv = await Conversation.findById(conversationId);
      if (!conv) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ success: false, message: "Conversation not found" });
      }

      const isPart = conv.participants.some(
        (p) => p.toString() === req.user._id.toString()
      );
      if (!isPart) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(403).json({ success: false, message: "Not authorized for this conversation" });
      }

      const otherId = conv.participants.find(
        (p) => p.toString() !== req.user._id.toString()
      );
      if (otherId && (await Block.isBlocked(req.user._id, otherId))) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(403).json({
          success: false,
          message: "Cannot upload attachment. Communication is blocked.",
        });
      }
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "campusx/chat",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      tags: [`user_${req.user._id}`],
    });

    // Delete temporary file
    await fs.unlink(req.file.path).catch(() => {});

    res.status(200).json({
      success: true,
      imageUrl: result.secure_url,
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    next(error);
  }
};

// @desc    Block a user from chat
// @route   POST /api/chat/block
// @access  Private
export const blockUser = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    const currentUserId = req.user._id.toString();

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "Target userId is required" });
    }

    if (targetUserId.toString() === currentUserId) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await Block.findOneAndUpdate(
      { blocker: currentUserId, blocked: targetUserId },
      { blocker: currentUserId, blocked: targetUserId },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `Blocked ${targetUser.name || "user"} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unblock a previously blocked user
// @route   POST /api/chat/unblock
// @access  Private
export const unblockUser = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    const currentUserId = req.user._id.toString();

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "Target userId is required" });
    }

    await Block.findOneAndDelete({
      blocker: currentUserId,
      blocked: targetUserId,
    });

    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of users blocked by current user
// @route   GET /api/chat/blocked-users
// @access  Private
export const getBlockedUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const blocks = await Block.find({ blocker: currentUserId })
      .populate("blocked", "name email profileImage department")
      .lean();

    const blockedList = blocks.map((b) => b.blocked).filter(Boolean);

    res.status(200).json({
      success: true,
      data: blockedList,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check block relationship for a specific conversation
// @route   GET /api/chat/conversations/:conversationId/block-status
// @access  Private
export const getConversationBlockStatus = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user._id.toString();

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => getParticipantId(p) === currentUserId
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const otherParticipant = conversation.participants.find(
      (p) => getParticipantId(p) !== currentUserId
    );
    const otherId = getParticipantId(otherParticipant);

    const status = await Block.getBlockStatus(currentUserId, otherId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a moderation report for a user/conversation/message
// @route   POST /api/chat/report
// @access  Private
export const reportTarget = async (req, res, next) => {
  try {
    const { reportedUserId, conversationId, messageId, reason, description = "" } = req.body;
    const reporterId = req.user._id.toString();

    if (!reportedUserId) {
      return res.status(400).json({ success: false, message: "reportedUserId is required" });
    }

    if (reportedUserId.toString() === reporterId) {
      return res.status(400).json({ success: false, message: "You cannot report yourself" });
    }

    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ success: false, message: "Reported user not found" });
    }

    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reason. Must be one of: ${REPORT_REASONS.join(", ")}`,
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 1000 characters",
      });
    }

    // Deduplication: prevent duplicate pending reports from same reporter for same user within 24h
    const duplicateQuery = {
      reporter: reporterId,
      reportedUser: reportedUserId,
      status: "pending",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    if (messageId) {
      duplicateQuery.message = messageId;
    }

    const existingReport = await Report.findOne(duplicateQuery);
    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a pending report for this user. Our moderation team is reviewing it.",
      });
    }

    const report = await Report.create({
      reporter: reporterId,
      reportedUser: reportedUserId,
      conversation: conversationId || null,
      message: messageId || null,
      reason,
      description: description.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully. Thank you for helping keep CampusX safe.",
      reportId: report._id,
    });
  } catch (error) {
    next(error);
  }
};

