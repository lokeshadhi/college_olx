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

/**
 * Upload an image attachment for chat
 */
export const uploadChatImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post("/chat/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/**
 * Fetch AI smart reply suggestions for a conversation
 */
export const getAiSmartReplies = async (conversationId) => {
  const response = await api.post(`/chat/conversations/${conversationId}/ai-smart-reply`);
  return response.data;
};

export const chatService = {
  getConversations,
  getConversationById,
  createOrGetConversation,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  uploadChatImage,
  getAiSmartReplies,
};

export default chatService;
