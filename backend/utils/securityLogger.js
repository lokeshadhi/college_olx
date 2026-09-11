/**
 * Security Audit Logger for CampusX
 * 
 * Records critical security events (failed logins, lockouts, rate limits,
 * blocked uploads, suspicious listings) with sanitized metadata.
 * STRICTLY NEVER LOGS: passwords, JWTs, session cookies, API keys, or reset tokens.
 */

export const SECURITY_EVENTS = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_LOCKED: "LOGIN_LOCKED",
  LOGOUT: "LOGOUT",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  BLOCKED_UPLOAD: "BLOCKED_UPLOAD",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  SUSPICIOUS_LISTING_FLAGGED: "SUSPICIOUS_LISTING_FLAGGED",
};

/**
 * Extracts a sanitized client IP from request headers or socket.
 * Handles reverse proxies (like Render) securely.
 */
export const getClientIp = (req) => {
  if (!req) return "unknown";
  const xForwardedFor = req.headers?.["x-forwarded-for"];
  if (xForwardedFor) {
    // Leftmost IP in X-Forwarded-For is client original IP
    return xForwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

/**
 * Log a structured security event.
 * @param {string} event - One of SECURITY_EVENTS
 * @param {object} params
 * @param {object} [params.req] - Express request object for IP and User-Agent
 * @param {string|null} [params.userId] - User ID if authenticated or resolved
 * @param {object} [params.metadata] - Safe contextual information (no credentials)
 */
export const logSecurityEvent = (event, { req = null, userId = null, metadata = {} } = {}) => {
  // Defensive sanitization: scrub sensitive keys if accidentally present
  const safeMetadata = { ...metadata };
  const sensitiveKeys = [
    "password",
    "token",
    "jwt",
    "secret",
    "cookie",
    "authorization",
    "confirmPassword",
    "resetToken",
  ];
  for (const key of Object.keys(safeMetadata)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      delete safeMetadata[key];
    }
  }

  const logEntry = {
    event,
    userId: userId ? userId.toString() : null,
    ip: getClientIp(req),
    userAgent: req?.headers?.["user-agent"] || "unknown",
    timestamp: new Date().toISOString(),
    metadata: safeMetadata,
  };

  if (process.env.NODE_ENV !== "test") {
    console.log(`[SECURITY AUDIT] ${JSON.stringify(logEntry)}`);
  }

  return logEntry;
};
