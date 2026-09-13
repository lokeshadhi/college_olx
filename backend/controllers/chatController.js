import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";

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
      (p) => p._id.toString() === userId
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
      (p) => p.toString() === userId
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
      (p) => p.toString() === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized to post to this conversation" });
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
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ success: false, message: "Valid imageUrl required for image messages" });
      }
    }

    const receiverId = conversation.participants
      .find((p) => p.toString() !== userId)
      ?.toString();

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
      (p) => p.toString() === userId
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
    if (io && updateResult.modifiedCount > 0) {
      io.to(`conversation:${conversationId}`).emit("messages_read", {
        conversationId,
        readerId: userId,
        readAt: now,
      });
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

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "campusx/chat",
      resource_type: "image",
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
