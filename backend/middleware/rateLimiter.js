/**
 * Rate Limiting Middleware (Disabled)
 * All rate limiters are configured as transparent pass-through middlewares.
 * Requests will never be blocked by rate limits or return 429 Too Many Requests.
 */

const noopLimiter = (req, res, next) => next();

export const globalLimiter = noopLimiter;
export const authLimiter = noopLimiter;
export const passwordResetLimiter = noopLimiter;
export const chatLimiter = noopLimiter;
export const verifyEmailLimiter = noopLimiter;
export const resendVerificationLimiter = noopLimiter;
export const reviewLimiter = noopLimiter;
export const reportLimiter = noopLimiter;
export const blockLimiter = noopLimiter;
export const chatUploadLimiter = noopLimiter;
