import api from "./api.js";

/**
 * Fetch all conversations for the authenticated user
 */
export const getConversations = async () => {
  const response = await api.get("/chat/conversations");
  return response.data;
};

/**
 * Fetch a single conversation by ID
 */
export const getConversationById = async (conversationId) => {
  const response = await api.get(`/chat/conversations/${conversationId}`);
  return response.data;
};

/**
 * Start or retrieve an existing conversation for a product
 */
export const createOrGetConversation = async (productId) => {
  const response = await api.post("/chat/conversations", { productId });
  return response.data;
};

/**
 * Get paginated messages for a conversation
 */
export const getMessages = async (conversationId, page = 1, limit = 30) => {
  const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Send a message via REST API
 */
export const sendMessage = async (conversationId, payload) => {
  const response = await api.post(`/chat/conversations/${conversationId}/messages`, payload);
  return response.data;
};

/**
 * Mark unread messages in a conversation as read
 */
export const markMessagesAsRead = async (conversationId) => {
  const response = await api.post(`/chat/conversations/${conversationId}/read`);
  return response.data;
};

// Backward-compatible alias for marking messages as read
export const markAsRead = markMessagesAsRead;

/**
 * Fetch total unread message count for authenticated user across all conversations
 */
export const getUnreadCount = async () => {
  const response = await api.get("/chat/unread-count");
  return response.data;
};

/**
 * Upload an image attachment for chat (optionally associates with conversation)
 */
export const uploadChatImage = async (file, conversationId = null) => {
  const formData = new FormData();
  formData.append("image", file);
  if (conversationId) {
    formData.append("conversationId", conversationId);
  }
  const response = await api.post("/chat/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/**
 * Block another user from chat
 */
export const blockUser = async (userId) => {
  const response = await api.post("/chat/block", { userId });
  return response.data;
};

/**
 * Unblock a previously blocked user
 */
export const unblockUser = async (userId) => {
  const response = await api.post("/chat/unblock", { userId });
  return response.data;
};

/**
 * Get list of users blocked by current user
 */
export const getBlockedUsers = async () => {
  const response = await api.get("/chat/blocked-users");
  return response.data;
};

/**
 * Get block relationship status for a specific conversation
 */
export const getConversationBlockStatus = async (conversationId) => {
  const response = await api.get(`/chat/conversations/${conversationId}/block-status`);
  return response.data;
};

/**
 * Submit a moderation report
 */
export const reportTarget = async ({ reportedUserId, conversationId, messageId, reason, description }) => {
  const response = await api.post("/chat/report", {
    reportedUserId,
    conversationId,
    messageId,
    reason,
    description,
  });
  return response.data;
};

export const chatService = {
  getConversations,
  getConversationById,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  markAsRead,
  getUnreadCount,
  uploadChatImage,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getConversationBlockStatus,
  reportTarget,
};

export default chatService;
