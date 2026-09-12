import api from "./api.js";

/**
 * Submit a review for a completed transaction
 * @param {Object} data { transactionId, rating, review }
 */
export const createReview = async ({ transactionId, rating, review }) => {
  const { data } = await api.post("/reviews", { transactionId, rating, review });
  return data;
};

/**
 * Fetch reviews received by a specific user with pagination & optional role filter
 * @param {string} userId
 * @param {Object} params { page, limit, role }
 */
export const getUserReviews = async (userId, params = {}) => {
  const { data } = await api.get(`/reviews/user/${userId}`, { params });
  return data;
};

/**
 * Fetch reviews for a specific product
 * @param {string} productId
 * @param {Object} params { page, limit }
 */
export const getProductReviews = async (productId, params = {}) => {
  const { data } = await api.get(`/reviews/product/${productId}`, { params });
  return data;
};

/**
 * Get review submission status for a specific transaction
 * @param {string} transactionId
 */
export const getTransactionReviewStatus = async (transactionId) => {
  const { data } = await api.get(`/reviews/transaction/${transactionId}`);
  return data;
};

/**
 * Get all completed transactions where current user hasn't yet submitted a review
 */
export const getPendingReviews = async () => {
  const { data } = await api.get("/reviews/me/pending");
  return data;
};

/**
 * Update an existing review authored by the current user
 * @param {string} reviewId
 * @param {Object} data { rating, review }
 */
export const updateReview = async (reviewId, { rating, review }) => {
  const { data } = await api.put(`/reviews/${reviewId}`, { rating, review });
  return data;
};

/**
 * Delete a review authored by the current user
 * @param {string} reviewId
 */
export const deleteReview = async (reviewId) => {
  const { data } = await api.delete(`/reviews/${reviewId}`);
  return data;
};
