import { body, validationResult } from "express-validator";

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
  body("email").trim().isEmail().withMessage("A valid college email is required"),
  body("phone").trim().matches(/^[0-9]{10}$/).withMessage("Phone number must be 10 digits"),
  body("department").trim().notEmpty().withMessage("Department is required"),
  body("year")
    .isIn(["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year"])
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

export const loginRules = [
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const forgotPasswordRules = [
  body("email").trim().isEmail().withMessage("A valid college email is required"),
];

export const resetPasswordRules = [
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
