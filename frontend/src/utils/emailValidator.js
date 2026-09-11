/**
 * Strict College Email Validator for NIT Kurukshetra (Frontend)
 * Format requirement: Local part must contain NUMBERS ONLY followed by @nitkkr.ac.in
 * Example valid: 123456@nitkkr.ac.in, 20240101@nitkkr.ac.in
 */

export const COLLEGE_EMAIL_REGEX = /^[0-9]+@nitkkr\.ac\.in$/;

/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 * @param {string} email
 * @returns {string}
 */
export const normalizeEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

/**
 * Validates whether an email is a strictly valid NIT Kurukshetra student email.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidCollegeEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  return COLLEGE_EMAIL_REGEX.test(email.trim());
};

/**
 * Returns contextual, helpful validation errors matching CampusX requirements:
 * - If user enters student@gmail.com:
 *   "Please use your NIT Kurukshetra student email (example: 123456@nitkkr.ac.in)"
 * - If user enters abc123@nitkkr.ac.in:
 *   "The email must contain only numbers before @nitkkr.ac.in"
 *
 * @param {string} email
 * @returns {string|null}
 */
export const getCollegeEmailValidationError = (email) => {
  if (!email || typeof email !== "string" || !email.trim()) {
    return "College email is required";
  }

  const trimmed = email.trim();

  if (!trimmed.includes("@")) {
    return "Please use your NIT Kurukshetra student email (example: 123456@nitkkr.ac.in)";
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return "Please enter a valid email address";
  }

  const [localPart, domain] = parts;

  if (domain.toLowerCase() !== "nitkkr.ac.in") {
    return "Please use your NIT Kurukshetra student email (example: 123456@nitkkr.ac.in)";
  }

  if (!/^[0-9]+$/.test(localPart)) {
    return "The email must contain only numbers before @nitkkr.ac.in";
  }

  if (!COLLEGE_EMAIL_REGEX.test(trimmed)) {
    return "Please use your NIT Kurukshetra student email (example: 123456@nitkkr.ac.in)";
  }

  return null;
};
