import { body, validationResult } from "express-validator";
import { getCollegeEmailValidationError } from "../utils/emailValidator.js";

// Runs after the express-validator rule chains below; collects any failures
// into a consistent JSON error response instead of letting bad data through.
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// Password policy: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character
export const passwordComplexityRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_~`+\-=/\\\[\]]).{8,}$/;

export const registerRules = [
  body("name").trim().notEmpty().withMessage("Full name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("College email is required")
    .custom((val) => {
      const error = getCollegeEmailValidationError(val);
      if (error) {
        throw new Error(error);
      }
      return true;
    }),
  body("phone").trim().matches(/^[0-9]{10}$/).withMessage("Phone number must be 10 digits"),
  body("department").trim().notEmpty().withMessage("Department is required"),
  body("degree")
    .optional()
    .trim()
    .customSanitizer((val) => {
      if (!val) return "B.Tech";
      const clean = val.replace(/[\.\s_-]/g, "").toUpperCase();
      if (clean === "BTECH") return "B.Tech";
      if (clean === "MTECH") return "M.Tech";
      if (clean === "MCA") return "MCA";
      return val;
    })
    .isIn(["B.Tech", "M.Tech", "MCA"])
    .withMessage("Please select a valid degree (B.Tech, M.Tech, or MCA)"),
  body("year")
    .isIn(["1st Year", "2nd Year", "3rd Year", "4th Year"])
    .withMessage("Please select a valid year"),
  body("password")
    .matches(passwordComplexityRegex)
    .withMessage(
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    ),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
];

export const verifyEmailRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("College email is required")
    .custom((val) => {
      const error = getCollegeEmailValidationError(val);
      if (error) {
        throw new Error(error);
      }
      return true;
    }),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("Verification code is required")
    .matches(/^[0-9]{6}$/)
    .withMessage("Verification code must be exactly 6 digits"),
];

export const resendVerificationRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("College email is required")
    .custom((val) => {
      const error = getCollegeEmailValidationError(val);
      if (error) {
        throw new Error(error);
      }
      return true;
    }),
];

export const loginRules = [
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const forgotPasswordRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("College email is required")
    .custom((val) => {
      const error = getCollegeEmailValidationError(val);
      if (error) {
        throw new Error(error);
      }
      return true;
    }),
];

export const verifyPasswordResetOtpRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("College email is required")
    .custom((val) => {
      const error = getCollegeEmailValidationError(val);
      if (error) {
        throw new Error(error);
      }
      return true;
    }),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("Password reset code is required")
    .matches(/^[0-9]{6}$/)
    .withMessage("Password reset code must be exactly 6 digits"),
];

export const resendPasswordResetOtpRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("College email is required")
    .custom((val) => {
      const error = getCollegeEmailValidationError(val);
      if (error) {
        throw new Error(error);
      }
      return true;
    }),
];

export const resetPasswordRules = [
  body("resetToken")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Password reset authorization token is required"),
  body("password")
    .matches(passwordComplexityRegex)
    .withMessage(
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    ),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
];

export const productRules = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("category")
    .isIn([
      "Books",
      "Electronics",
      "Cycles",
      "Furniture",
      "Hostel Essentials",
      "Lab Equipment",
      "Calculators",
      "Sports",
      "Stationery",
      "Others",
    ])
    .withMessage("Please select a valid category"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("condition")
    .isIn(["New", "Like New", "Good", "Fair", "Old"])
    .withMessage("Please select a valid condition"),
];

export const createReviewRules = [
  body("transactionId")
    .trim()
    .notEmpty()
    .withMessage("Transaction ID is required")
    .isMongoId()
    .withMessage("Invalid transaction ID format"),
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be an integer between 1 and 5"),
  body("review")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Review cannot exceed 500 characters"),
];

export const updateReviewRules = [
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be an integer between 1 and 5"),
  body("review")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Review cannot exceed 500 characters"),
];
