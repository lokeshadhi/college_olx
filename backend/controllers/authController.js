import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

// Dummy hash for constant-time comparison when email is not found
const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmno";

// @desc    Register a new student
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, phone, department, year, password } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, {
        req,
        metadata: { reason: "Registration collision: email already exists" },
      });
      return res.status(400).json({ success: false, message: "An account with this email already exists" });
    }

    const user = await User.create({ name, email, phone, department, year, password });

    generateToken(res, user._id);

    logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, {
      req,
      userId: user._id,
      metadata: { action: "register" },
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log a student in with brute-force defense
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      // Execute constant-time dummy compare to prevent timing side-channel attacks
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
      logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, {
        req,
        metadata: { reason: "User not found" },
      });
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Check brute-force lockout status
    if (user.isLocked()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      logSecurityEvent(SECURITY_EVENTS.LOGIN_LOCKED, {
        req,
        userId: user._id,
        metadata: { remainingMinutes },
      });
      return res.status(429).json({
        success: false,
        message: `Account is temporarily locked due to consecutive failed attempts. Please try again in ${remainingMinutes} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed attempts and apply temporary lockout if threshold exceeded
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
        logSecurityEvent(SECURITY_EVENTS.LOGIN_LOCKED, {
          req,
          userId: user._id,
          metadata: { failedAttempts: user.failedLoginAttempts, lockMinutes: 15 },
        });
      } else {
        logSecurityEvent(SECURITY_EVENTS.LOGIN_FAILED, {
          req,
          userId: user._id,
          metadata: { failedAttempts: user.failedLoginAttempts },
        });
      }

      await user.save({ validateBeforeSave: false });
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Successful login: reset brute-force counters
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save({ validateBeforeSave: false });

    generateToken(res, user._id);

    logSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, {
      req,
      userId: user._id,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log the current student out
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  logSecurityEvent(SECURITY_EVENTS.LOGOUT, {
    req,
    userId: req.user?._id,
  });

  // Ensure cookie clearing parameters exactly mirror cookie generation options,
  // particularly cross-origin settings for production deployments on Render.
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
    expires: new Date(0),
  });

  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// @desc    Request password reset token
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    let resetToken = null;
    if (user) {
      resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET_REQUESTED, {
        req,
        userId: user._id,
      });

      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const resetLink = `${clientUrl}/reset-password/${resetToken}`;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[PASSWORD RESET LINK for ${user.email}]: ${resetLink}`);
      }
    } else {
      logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET_REQUESTED, {
        req,
        metadata: { emailAttempted: email.toLowerCase(), userFound: false },
      });
    }

    // Always return the exact same generic message to prevent account enumeration
    const responsePayload = {
      success: true,
      message: "If an account exists for this email, password reset instructions have been sent.",
    };

    // Include debugToken in development and test environments to facilitate automated verification
    if (process.env.NODE_ENV !== "production" && resetToken) {
      responsePayload.debugToken = resetToken;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using cryptographically secure token
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the token provided in the URL to match the stored SHA-256 hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired",
      });
    }

    // Update password and invalidate the token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();

    logSecurityEvent(SECURITY_EVENTS.PASSWORD_RESET_COMPLETED, {
      req,
      userId: user._id,
    });

    // Invalidate existing session cookie
    res.cookie("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      domain: process.env.COOKIE_DOMAIN || undefined,
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get the logged-in student's profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: req.user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update the logged-in student's profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, department, year, profileImage } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department) user.department = department;
    if (year) user.year = year;
    if (profileImage) user.profileImage = profileImage;

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
