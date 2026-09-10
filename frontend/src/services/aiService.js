import api from "./api.js";

/**
 * Sends uploaded product images and optional seller context to the backend
 * AI assistant endpoint to generate structured listing suggestions via Gemini.
 *
 * @param {File[]} imageFiles - Array of File objects selected by the seller
 * @param {string} [sellerContext=""] - Optional context or notes from the seller
 * @returns {Promise<object>} Structured AI listing suggestions
 */
export const generateAiListing = async (imageFiles, sellerContext = "") => {
  const formData = new FormData();

  Array.from(imageFiles).forEach((file) => {
    formData.append("images", file);
  });

  if (sellerContext && sellerContext.trim()) {
    formData.append("sellerContext", sellerContext.trim());
  }

  const { data } = await api.post("/ai/generate-listing", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data.data;
};
