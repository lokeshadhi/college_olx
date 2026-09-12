import api from "./api.js";

/**
 * Fetch transactions for current user (buyer or seller)
 * @param {Object} params { status, role }
 */
export const getMyTransactions = async (params = {}) => {
  const { data } = await api.get("/transactions", { params });
  return data;
};

/**
 * Fetch a single transaction by ID
 * @param {string} id
 */
export const getTransactionById = async (id) => {
  const { data } = await api.get(`/transactions/${id}`);
  return data;
};

/**
 * Create a new transaction
 * @param {Object} payload { productId, amount, ... }
 */
export const createTransaction = async (payload) => {
  const { data } = await api.post("/transactions", payload);
  return data;
};

/**
 * Update transaction status (e.g. ACCEPT, PAY, COMPLETE, CANCEL)
 * @param {string} id
 * @param {Object} payload { status, notes, meetupLocation }
 */
export const updateTransactionStatus = async (id, payload) => {
  const { data } = await api.patch(`/transactions/${id}/status`, payload);
  return data;
};
