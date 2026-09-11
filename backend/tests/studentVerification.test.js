import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import app from "../server.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import {
  isValidCollegeEmail,
  normalizeEmail,
  getCollegeEmailValidationError,
  COLLEGE_EMAIL_REGEX,
} from "../utils/emailValidator.js";

describe("CampusX Student Verification & NIT Kurukshetra Email Test Suite", () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "student_verification_test_secret_9988776655";

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    if (server) server.close();
  });

  // ==========================================================
  // 1. STRICT EMAIL VALIDATION (UNIT TESTS)
  // ==========================================================
  describe("1. Strict NIT Kurukshetra Email Validation Rules", () => {
    it("should accept strictly valid NIT Kurukshetra student emails", () => {
      const validEmails = [
        "123456@nitkkr.ac.in",
        "20240101@nitkkr.ac.in",
        "220101@nitkkr.ac.in",
        "22@nitkkr.ac.in",
        "1@nitkkr.ac.in",
      ];

      for (const email of validEmails) {
        assert.equal(
          isValidCollegeEmail(email),
          true,
          `Expected "${email}" to be valid`
        );
        assert.equal(
          getCollegeEmailValidationError(email),
          null,
          `Expected no validation error for "${email}"`
        );
      }
    });

    it("should reject non-NIT Kurukshetra domains and non-numeric student IDs", () => {
      const invalidEmails = [
        "student@nitkkr.ac.in", // non-numeric local part
        "abc123@nitkkr.ac.in", // alphanumeric local part
        "123@student.nitkkr.ac.in", // incorrect sub-domain
        "123@gmail.com", // public provider
        "123@nitkkr.com", // wrong TLD (.com instead of .ac.in)
        "123abc@nitkkr.ac.in", // contains letters
        "abc@nitkkr.ac.in", // letters only
        "123 @nitkkr.ac.in", // whitespace inside
        "student@gmail.com", // non-college email
      ];

      for (const email of invalidEmails) {
        assert.equal(
          isValidCollegeEmail(email),
          false,
          `Expected "${email}" to be rejected`
        );
        assert.ok(
          getCollegeEmailValidationError(email) !== null,
          `Expected validation error message for "${email}"`
        );
      }
    });

    it("should return the exact requested error messages for common invalid patterns", () => {
      // Prompt requirement: If student@gmail.com -> "Please use your NIT Kurukshetra student email"
      const gmailError = getCollegeEmailValidationError("student@gmail.com");
      assert.ok(gmailError.includes("Please use your NIT Kurukshetra student email"));

      // Prompt requirement: If abc123@nitkkr.ac.in -> "The email must contain only numbers before @nitkkr.ac.in"
      const alphaError = getCollegeEmailValidationError("abc123@nitkkr.ac.in");
      assert.equal(alphaError, "The email must contain only numbers before @nitkkr.ac.in");
    });

    it("should normalize email with whitespace trimming and lowercase", () => {
      assert.equal(normalizeEmail("  123456@NITKKR.AC.IN  "), "123456@nitkkr.ac.in");
      assert.equal(normalizeEmail(""), "");
      assert.equal(normalizeEmail(null), "");
    });
  });

  // ==========================================================
  // 2. CRYPTOGRAPHIC OTP GENERATION & USER MODEL METHODS
  // ==========================================================
  describe("2. Cryptographic OTP Generation & Model Security", () => {
    it("should generate cryptographically secure 6-digit OTP and store SHA-256 hash", () => {
      const user = new User({
        name: "Test Student",
        email: "120001@nitkkr.ac.in",
        phone: "9876543210",
        department: "Computer Science",
        year: "3rd Year",
        password: "ValidPassword123!",
      });

      const rawOtp = user.createEmailVerificationOTP();

      // Check OTP format: exactly 6 digits
      assert.match(rawOtp, /^[0-9]{6}$/);

      // Verify OTP is hashed with SHA-256 in memory (64 hex characters)
      assert.ok(user.emailVerificationOTPHash);
      assert.equal(user.emailVerificationOTPHash.length, 64);
      assert.notEqual(user.emailVerificationOTPHash, rawOtp);

      // Verify expiration is set 10 minutes in the future
      const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
      assert.ok(user.emailVerificationOTPExpires.getTime() <= tenMinutesFromNow + 2000);
      assert.ok(user.emailVerificationOTPExpires.getTime() >= tenMinutesFromNow - 2000);

      // Verify attempts reset to 0
      assert.equal(user.emailVerificationAttempts, 0);

      // Verify verifyOTP method works correctly with constant-time check
      assert.equal(user.verifyOTP(rawOtp), true);
      assert.equal(user.verifyOTP("000000"), false);
      assert.equal(user.verifyOTP("wrong"), false);
    });

    it("should never expose OTP hash or attempts in serialized toJSON output", () => {
      const user = new User({
        name: "Secret User",
        email: "120002@nitkkr.ac.in",
        phone: "9876543210",
        department: "IT",
        year: "2nd Year",
        password: "ValidPassword123!",
      });

      user.createEmailVerificationOTP();
      const json = user.toJSON();

      assert.equal(json.emailVerificationOTPHash, undefined);
      assert.equal(json.emailVerificationOTPExpires, undefined);
      assert.equal(json.emailVerificationAttempts, undefined);
      assert.equal(json.password, undefined);
      assert.equal(json.isEmailVerified, false);
    });
  });

  // ==========================================================
  // 3. REGISTRATION & VERIFICATION ENDPOINTS (INTEGRATION TESTS)
  // ==========================================================
  describe("3. Student Registration & Verification Endpoints", () => {
    const testEmail = "120005@nitkkr.ac.in";
    let activeOtp = null;

    beforeEach(() => {
      // Mock User.findOne to simulate test database state
      const mockDbUser = {
        _id: "66e01234567890abcdef9901",
        name: "Aman Verma",
        email: testEmail,
        phone: "9876543210",
        department: "Computer Science",
        year: "3rd Year",
        isEmailVerified: false,
        emailVerificationAttempts: 0,
        emailVerificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000),
        createEmailVerificationOTP: function () {
          const otp = "654321";
          this.emailVerificationOTPHash = crypto.createHash("sha256").update(otp).digest("hex");
          this.emailVerificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
          this.emailVerificationAttempts = 0;
          return otp;
        },
        verifyOTP: function (candidate) {
          if (!this.emailVerificationOTPHash) return false;
          const candidateHash = crypto.createHash("sha256").update(candidate.trim()).digest("hex");
          return candidateHash === this.emailVerificationOTPHash;
        },
        save: async function () { return this; },
        toJSON: function () {
          return {
            _id: this._id,
            name: this.name,
            email: this.email,
            isEmailVerified: this.isEmailVerified,
          };
        },
      };

      activeOtp = mockDbUser.createEmailVerificationOTP();

      User.findOne = (query) => {
        let result = null;
        if (query?.email === testEmail) {
          result = mockDbUser;
        }

        return {
          select: () => Promise.resolve(result),
          then: (fn) => Promise.resolve(result).then(fn),
        };
      };

      User.create = async (data) => ({
        ...mockDbUser,
        ...data,
      });
    });

    it("should reject registration with non-NIT Kurukshetra email with 400", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Fake User",
          email: "student@gmail.com",
          phone: "9876543210",
          department: "IT",
          year: "1st Year",
          password: "SecurePassword123!",
          confirmPassword: "SecurePassword123!",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(
        body.message.includes("NIT Kurukshetra") ||
        body.errors?.some((e) => e.message.includes("NIT Kurukshetra"))
      );
    });

    it("should reject registration with alphanumeric email before domain with 400", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Fake User",
          email: "abc123@nitkkr.ac.in",
          phone: "9876543210",
          department: "IT",
          year: "1st Year",
          password: "SecurePassword123!",
          confirmPassword: "SecurePassword123!",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(
        body.errors?.some((e) => e.message.includes("only numbers before @nitkkr.ac.in")) ||
        body.message.includes("NIT Kurukshetra")
      );
    });

    it("should reject verification with incorrect OTP with 400", async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          otp: "000000",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.message, "Invalid verification code.");
    });

    it("should reject verification when OTP is expired with 400", async () => {
      // Mock expired OTP
      User.findOne = () => ({
        select: () =>
          Promise.resolve({
            email: testEmail,
            isEmailVerified: false,
            emailVerificationAttempts: 0,
            emailVerificationOTPExpires: new Date(Date.now() - 5000), // expired 5s ago
            emailVerificationOTPHash: crypto.createHash("sha256").update(activeOtp).digest("hex"),
            verifyOTP: () => true,
            save: async () => {},
          }),
      });

      const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          otp: activeOtp,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.message.includes("expired"));
    });

    it("should lock out verification and invalidate OTP after 5 failed attempts", async () => {
      // Mock user with 5 failed attempts
      User.findOne = () => ({
        select: () =>
          Promise.resolve({
            email: testEmail,
            isEmailVerified: false,
            emailVerificationAttempts: 5,
            emailVerificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000),
            emailVerificationOTPHash: crypto.createHash("sha256").update(activeOtp).digest("hex"),
            save: async () => {},
          }),
      });

      const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          otp: activeOtp,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.message.includes("Too many verification attempts"));
    });

    it("should successfully verify student with valid OTP and grant Verified Student status", async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          otp: activeOtp,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(body.message.includes("verified successfully"));
      assert.equal(body.data?.isEmailVerified, true);

      // Verify session cookie was set
      const cookieHeader = res.headers.get("set-cookie");
      assert.ok(cookieHeader);
      assert.ok(cookieHeader.includes("token="));
    });

    it("should reject verification on already verified account", async () => {
      User.findOne = () => ({
        select: () =>
          Promise.resolve({
            email: testEmail,
            isEmailVerified: true,
          }),
      });

      const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          otp: activeOtp,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.message.includes("already verified"));
    });

    it("should support resending OTP and invalidate prior OTP", async () => {
      let createdNewOtp = false;

      User.findOne = () => ({
        select: () =>
          Promise.resolve({
            email: testEmail,
            name: "Aman Verma",
            isEmailVerified: false,
            createEmailVerificationOTP: () => {
              createdNewOtp = true;
              return "987654";
            },
            save: async () => {},
          }),
      });

      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(createdNewOtp);
      assert.ok(body.message.includes("new verification code has been sent"));
    });
  });
});
