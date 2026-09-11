import express from "express";
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  handleValidation,
} from "../middleware/validate.js";
import { authLimiter, passwordResetLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public authentication routes (rate-limited)
router.post("/register", authLimiter, registerRules, handleValidation, register);
router.post("/login", authLimiter, loginRules, handleValidation, login);
router.post("/forgot-password", passwordResetLimiter, forgotPasswordRules, handleValidation, forgotPassword);
router.post("/reset-password/:token", passwordResetLimiter, resetPasswordRules, handleValidation, resetPassword);

// Authenticated session routes
router.post("/logout", protect, logout);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;
