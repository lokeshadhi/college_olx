import axios from "axios";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

// Central axios instance. withCredentials lets the httpOnly JWT cookie set by
// the backend travel with every request, so the SPA stays logged in on refresh.
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Normalize error messages so components can just read err.message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Graceful handling for 429 Too Many Requests
    if (error.response?.status === 429) {
      const rateLimitMsg =
        error.response.data?.message ||
        "Too many requests. Please slow down and try again in a few minutes.";
      return Promise.reject(new Error(rateLimitMsg));
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.message ||
      "Something went wrong. Please try again.";
    return Promise.reject(new Error(message));
  }
);

export default api;
