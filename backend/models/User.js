import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
    email: {
      type: String,
      required: [true, "College email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[0-9]{10}$/, "Phone number must be 10 digits"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    year: {
      type: String,
      required: [true, "Year is required"],
      enum: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    profileImage: {
      type: String,
      default: "",
    },
    // Brute-force protection & account lockout fields
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    // Password reset fields (strictly stores only hashed tokens/OTPs, never raw secrets)
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordResetOTPHash: {
      type: String,
      select: false,
    },
    passwordResetOTPExpires: {
      type: Date,
      select: false,
    },
    passwordResetOTPAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetVerifiedTokenHash: {
      type: String,
      select: false,
    },
    passwordResetVerifiedTokenExpires: {
      type: Date,
      select: false,
    },
    // Invalidate existing sessions/tokens upon password reset
    passwordChangedAt: {
      type: Date,
    },
    // Student email verification fields
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationOTPHash: {
      type: String,
      select: false,
    },
    emailVerificationOTPExpires: {
      type: Date,
      select: false,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    // Ratings & Reviews aggregate statistics
    sellerRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    sellerReviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    buyerRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    buyerReviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Hash the password before saving, only when it has been modified.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plaintext password against the stored hash.
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is currently locked due to repeated failed login attempts
userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

// Generates a cryptographically secure 32-byte password reset token,
// hashes it with SHA-256 for database storage, and sets a 15-minute expiration.
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

  return resetToken;
};

// Generates a cryptographically secure 6-digit OTP for student email verification,
// hashes it with SHA-256 for database storage, sets a 10-minute expiration,
// and resets attempts to 0.
userSchema.methods.createEmailVerificationOTP = function () {
  // Cryptographically secure 6-digit number between 100000 and 999999
  const otp = crypto.randomInt(100000, 1000000).toString();

  this.emailVerificationOTPHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  this.emailVerificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.emailVerificationAttempts = 0;

  return otp;
};

// Constant-time comparison of candidate OTP against stored hash
userSchema.methods.verifyOTP = function (candidateOTP) {
  if (!candidateOTP || typeof candidateOTP !== "string") return false;
  if (!this.emailVerificationOTPHash) return false;

  const candidateHash = crypto
    .createHash("sha256")
    .update(candidateOTP.trim())
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(this.emailVerificationOTPHash, "hex")
    );
  } catch {
    return false;
  }
};

// Generates a cryptographically secure 6-digit OTP for password reset,
// hashes it with SHA-256 for database storage, sets a 10-minute expiration,
// and clears any previous reset authorization.
userSchema.methods.createPasswordResetOTP = function () {
  const otp = crypto.randomInt(100000, 1000000).toString();

  this.passwordResetOTPHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  this.passwordResetOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.passwordResetOTPAttempts = 0;
  this.passwordResetVerifiedTokenHash = undefined;
  this.passwordResetVerifiedTokenExpires = undefined;

  return otp;
};

// Constant-time comparison of candidate password reset OTP against stored hash
userSchema.methods.verifyPasswordResetOTP = function (candidateOTP) {
  if (!candidateOTP || typeof candidateOTP !== "string") return false;
  if (!this.passwordResetOTPHash) return false;

  const candidateHash = crypto
    .createHash("sha256")
    .update(candidateOTP.trim())
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(this.passwordResetOTPHash, "hex")
    );
  } catch {
    return false;
  }
};

// Creates a cryptographically random, single-use authorization token
// granted only after successful OTP verification, valid for 15 minutes.
userSchema.methods.createPasswordResetAuthorization = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetVerifiedTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetVerifiedTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  this.passwordResetOTPHash = undefined;
  this.passwordResetOTPExpires = undefined;
  this.passwordResetOTPAttempts = 0;

  return resetToken;
};

// Constant-time comparison of candidate reset authorization token against stored hash
userSchema.methods.verifyPasswordResetAuthorization = function (candidateToken) {
  if (!candidateToken || typeof candidateToken !== "string") return false;
  if (!this.passwordResetVerifiedTokenHash) return false;

  const candidateHash = crypto
    .createHash("sha256")
    .update(candidateToken.trim())
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(this.passwordResetVerifiedTokenHash, "hex")
    );
  } catch {
    return false;
  }
};

// Never leak sensitive authentication or security fields when document is serialized
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.passwordResetOTPHash;
  delete obj.passwordResetOTPExpires;
  delete obj.passwordResetOTPAttempts;
  delete obj.passwordResetVerifiedTokenHash;
  delete obj.passwordResetVerifiedTokenExpires;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  delete obj.emailVerificationOTPHash;
  delete obj.emailVerificationOTPExpires;
  delete obj.emailVerificationAttempts;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;
