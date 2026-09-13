import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

const createStandardHandler = (customMessage) => (req, res, next, options) => {
  logSecurityEvent(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, {
    req,
    userId: req.user?._id || null,
    metadata: {
      path: req.originalUrl,
      method: req.method,
      limit: options.limit,
      windowMs: options.windowMs,
    },
  });

  return res.status(options.statusCode || 429).json({
    success: false,
    message: customMessage || "Too many requests. Please try again later.",
  });
};

const isTestMode =
  process.env.NODE_ENV === "test" ||
  process.execArgv.some((arg) => arg.includes("--test")) ||
  process.argv.some((arg) => arg.includes("test"));

/**
 * Global API rate limiter:
 * 100 requests per 15 minutes per IP.
 * Protects against basic volumetric denial of service while allowing fluid browsing.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || (isTestMode ? 5000 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createStandardHandler("Too many requests from this IP. Please try again later."),
});

/**
 * Authentication rate limiter:
 * 5 attempts per 15 minutes per IP for /login and /register.
 * Mitigates credential stuffing and brute-force password guessing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || (isTestMode ? 1000 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createStandardHandler(
    "Too many login or registration attempts from this IP. Please try again after 15 minutes."
  ),
});

/**
 * Password reset rate limiter:
 * 5 requests per 15 minutes per IP.
 * Prevents spamming reset tokens or exhausting email/SMS services.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RESET_MAX) || (isTestMode ? 1000 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createStandardHandler(
    "Too many password reset requests from this IP. Please try again after 15 minutes."
  ),
});

/**
 * Chat REST API rate limiter:
 * 60 requests per minute per IP to prevent automated scraping or spam.
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CHAT_MAX) || (isTestMode ? 2000 : 60),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createStandardHandler("Chat request limit reached. Please wait a moment."),
});

/**
 * Verify Email rate limiter:
 * 10 attempts per 15 minutes per IP to prevent brute-force OTP guessing.
 */
export const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_VERIFY_MAX) || (isTestMode ? 1000 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createStandardHandler(
    "Too many verification attempts from this IP. Please wait 15 minutes before trying again."
  ),
});

/**
 * Resend Verification Code rate limiter:
 * 3 requests per 15 minutes per email/IP to prevent spamming transactional email providers.
 */
export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RESEND_MAX) || (isTestMode ? 1000 : 3),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email && typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return email ? `resend_${email}` : ipKeyGenerator(req.ip);
  },
  handler: createStandardHandler(
    "Too many verification code requests. Please wait 15 minutes before requesting another code."
  ),
});

/**
 * Review rate limiter:
 * 30 review submissions/edits per 15 minutes per user/IP.
 */
export const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REVIEW_MAX) || (isTestMode ? 1000 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?._id ? `user_${req.user._id}` : ipKeyGenerator(req.ip);
  },
  handler: createStandardHandler(
    "Too many review requests. Please wait a moment before trying again."
  ),
});


