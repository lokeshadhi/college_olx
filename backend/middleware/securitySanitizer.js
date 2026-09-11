import DOMPurify from "isomorphic-dompurify";

/**
 * Escapes characters with special meaning in Regular Expressions.
 * Prevents ReDoS (Regular Expression Denial of Service) and regex injection.
 */
export const escapeRegex = (str) => {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Recursively removes MongoDB operator keys (keys starting with '$' or containing '.')
 * to prevent NoSQL query operator injection attacks.
 */
export const sanitizeMongoOperators = (target) => {
  if (!target || typeof target !== "object") return target;

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeMongoOperators(target[i]);
    }
    return target;
  }

  for (const key of Object.keys(target)) {
    // If the key starts with '$' (e.g. $gt, $ne, $where) or contains '.', delete it
    if (key.startsWith("$") || key.includes(".")) {
      delete target[key];
    } else {
      target[key] = sanitizeMongoOperators(target[key]);
    }
  }

  return target;
};

/**
 * Recursively cleans dangerous HTML and JavaScript constructs from string fields
 * using DOMPurify while preserving normal text, punctuation, and markdown formatting.
 */
export const sanitizeXSS = (target) => {
  if (!target) return target;

  if (typeof target === "string") {
    // Strip tags and dangerous script/event attributes
    return DOMPurify.sanitize(target, {
      ALLOWED_TAGS: [], // Disallow all HTML tags in marketplace fields
      ALLOWED_ATTR: [],
    }).trim();
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeXSS(target[i]);
    }
    return target;
  }

  if (typeof target === "object") {
    for (const key of Object.keys(target)) {
      target[key] = sanitizeXSS(target[key]);
    }
  }

  return target;
};

/**
 * Express middleware that applies NoSQL injection defense and XSS sanitization
 * to req.body, req.query, and req.params before route handlers execute.
 */
export const securitySanitizer = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    sanitizeMongoOperators(req.body);
    // Don't sanitize password fields with XSS stripper (passwords may legitimately contain special characters like < or >)
    const { password, confirmPassword, currentPassword, newPassword, ...otherFields } = req.body;
    sanitizeXSS(otherFields);
    // Re-assign sanitized fields back
    Object.assign(req.body, otherFields);
  }

  if (req.query && typeof req.query === "object") {
    sanitizeMongoOperators(req.query);
    sanitizeXSS(req.query);
  }

  if (req.params && typeof req.params === "object") {
    sanitizeMongoOperators(req.params);
    sanitizeXSS(req.params);
  }

  next();
};
