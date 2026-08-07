import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

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
    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.message ||
      "Something went wrong. Please try again.";
    return Promise.reject(new Error(message));
  }
);

export default api;
