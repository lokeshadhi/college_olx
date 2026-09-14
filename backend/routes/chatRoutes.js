import express from "express";
import {
  getConversations,
  getConversationById,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  uploadChatImage,
  getUnreadCount,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getConversationBlockStatus,
  reportTarget,
} from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";
import {
  chatLimiter,
  blockLimiter,
  reportLimiter,
  chatUploadLimiter,
} from "../middleware/rateLimiter.js";
import { secureChatUpload } from "../middleware/chatUpload.js";
import keyRoutes from "./keyRoutes.js";

const router = express.Router();

// All chat routes require authentication and standard rate limiting
router.use(protect);
router.use(chatLimiter);

// Cryptographic public key registry & encrypted backups
router.use("/keys", keyRoutes);

// Global unread counter
router.get("/unread-count", getUnreadCount);

// Conversation list and detail
router.get("/conversations", getConversations);
router.get("/conversations/:conversationId", getConversationById);
router.post("/conversations", createOrGetConversation);
router.get("/conversations/:conversationId/block-status", getConversationBlockStatus);

// Messages in conversation
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.post("/conversations/:conversationId/read", markMessagesAsRead);

// Moderation: Block / Unblock
router.get("/blocked-users", getBlockedUsers);
router.post("/block", blockLimiter, blockUser);
router.post("/unblock", blockLimiter, unblockUser);

// Moderation: Reports
router.post("/report", reportLimiter, reportTarget);

// Secure image upload for chat attachment
router.post("/upload-image", chatUploadLimiter, secureChatUpload, uploadChatImage);

export default router;

