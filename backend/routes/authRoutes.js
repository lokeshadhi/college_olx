import profileUpload from "../middleware/profileupload.js";
import express from "express";
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyPasswordResetOTP,
  resendPasswordResetOTP,
  resetPassword,
  verifyEmail,
  resendVerification,
  uploadProfileImage,
  
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  verifyPasswordResetOtpRules,
  resendPasswordResetOtpRules,
  resetPasswordRules,
  verifyEmailRules,
  resendVerificationRules,
  handleValidation,
} from "../middleware/validate.js";
import {
  authLimiter,
  passwordResetLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();
router.post(
  "/profile-image",
  protect,
  profileUpload.single("profileImage"),
  uploadProfileImage
);
// Public authentication routes (rate-limited)
  
router.post("/register", authLimiter, registerRules, handleValidation, register);
router.post("/verify-email", verifyEmailLimiter, verifyEmailRules, handleValidation, verifyEmail);
router.post("/resend-verification", resendVerificationLimiter, resendVerificationRules, handleValidation, resendVerification);
router.post("/login", authLimiter, loginRules, handleValidation, login);
router.post("/forgot-password", passwordResetLimiter, forgotPasswordRules, handleValidation, forgotPassword);
router.post("/verify-password-reset-otp", verifyEmailLimiter, verifyPasswordResetOtpRules, handleValidation, verifyPasswordResetOTP);
router.post("/resend-password-reset-otp", resendVerificationLimiter, resendPasswordResetOtpRules, handleValidation, resendPasswordResetOTP);
router.post("/reset-password", passwordResetLimiter, resetPasswordRules, handleValidation, resetPassword);
router.post("/reset-password/:token", passwordResetLimiter, resetPasswordRules, handleValidation, resetPassword);

// Authenticated session routes
router.post("/logout", protect, logout);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;
