import express from "express";
import {
  getConversations,
  getConversationById,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  uploadChatImage,
} from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimiter.js";
import { secureChatUpload } from "../middleware/chatUpload.js";

const router = express.Router();

// All chat routes require authentication and rate limiting
router.use(protect);
router.use(chatLimiter);

// Conversation list and detail
router.get("/conversations", getConversations);
router.get("/conversations/:conversationId", getConversationById);
router.post("/conversations", createOrGetConversation);

// Messages in conversation
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.post("/conversations/:conversationId/read", markMessagesAsRead);


// Secure image upload for chat attachment
router.post("/upload-image", secureChatUpload, uploadChatImage);

export default router;
