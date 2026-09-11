import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

/**
 * Parses a cookie string into a key-value object
 * @param {string} cookieHeader
 * @returns {Record<string, string>}
 */
const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return cookies;

  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx < 0) return;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });

  return cookies;
};

/**
 * Socket.IO Handshake Authentication Middleware:
 * Verifies JWT token from httpOnly cookie or handshake auth/headers.
 * Validates user existence and passwordChangedAt timestamp.
 * Attaches the verified user to socket.user and socket.userId.
 */
export const socketAuth = async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const parsedCookies = parseCookies(cookieHeader);

    // Primary: httpOnly cookie. Fallbacks: handshake auth payload or authorization header
    let token = parsedCookies.token || socket.handshake.auth?.token;

    if (!token && socket.handshake.headers.authorization?.startsWith("Bearer ")) {
      token = socket.handshake.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return next(new Error("Authentication error: User no longer exists"));
    }

    // Invalidate socket connection if password was changed after token issuance
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat && decoded.iat < changedTimestamp) {
        return next(new Error("Authentication error: Password changed recently"));
      }
    }

    socket.user = user;
    socket.userId = user._id.toString();

    next();
  } catch (error) {
    return next(new Error("Authentication error: Invalid or expired token"));
  }
};

export default socketAuth;
