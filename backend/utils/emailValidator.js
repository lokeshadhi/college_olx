/**
 * Strict College Email Validator for NIT Kurukshetra
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
 * Requires numeric-only local part and @nitkkr.ac.in domain.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidCollegeEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  return COLLEGE_EMAIL_REGEX.test(trimmed);
};

/**
 * Returns a human-friendly, contextual error message for invalid college emails,
 * matching CampusX UX standards.
 * @param {string} email
 * @returns {string|null} Error string if invalid, null if valid
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
