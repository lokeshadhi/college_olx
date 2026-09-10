// Validates and sanitizes the structured output returned by Gemini
// to ensure it matches the CampusX Product schema and application enums.

export const ALLOWED_CATEGORIES = [
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
];

export const ALLOWED_CONDITIONS = ["New", "Like New", "Good", "Fair", "Old"];

/**
 * Validates and normalizes Gemini AI output
 * @param {object} raw - Parsed JSON object from Gemini
 * @returns {object} Validated, sanitized listing suggestion
 */
export const validateAiListing = (raw) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid AI response: Expected a JSON object");
  }

  // 1. Detected product
  const detectedProduct =
    typeof raw.detectedProduct === "string" && raw.detectedProduct.trim()
      ? raw.detectedProduct.trim()
      : "Unknown Item";

  // 2. Category mapping & validation
  let category = "Others";
  if (typeof raw.category === "string" && ALLOWED_CATEGORIES.includes(raw.category.trim())) {
    category = raw.category.trim();
  } else if (typeof raw.category === "string") {
    // Attempt case-insensitive match
    const matched = ALLOWED_CATEGORIES.find(
      (c) => c.toLowerCase() === raw.category.trim().toLowerCase()
    );
    if (matched) category = matched;
  }

  // 3. Condition mapping & validation
  let condition = "Good";
  if (typeof raw.condition === "string" && ALLOWED_CONDITIONS.includes(raw.condition.trim())) {
    condition = raw.condition.trim();
  } else if (typeof raw.condition === "string") {
    const rawLower = raw.condition.trim().toLowerCase();
    if (rawLower === "poor") {
      // Map 'poor' (common LLM condition) to existing DB enum 'Old'
      condition = "Old";
    } else {
      const matched = ALLOWED_CONDITIONS.find((c) => c.toLowerCase() === rawLower);
      if (matched) condition = matched;
    }
  }

  // 4. Suggested Title (max 120 chars per Product model)
  let suggestedTitle =
    typeof raw.suggestedTitle === "string" && raw.suggestedTitle.trim()
      ? raw.suggestedTitle.trim()
      : detectedProduct;
  if (suggestedTitle.length > 120) {
    suggestedTitle = suggestedTitle.substring(0, 117) + "...";
  }

  // 5. Description (max 2000 chars per Product model)
  let description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : `${suggestedTitle} in ${condition} condition.`;
  if (description.length > 2000) {
    description = description.substring(0, 1997) + "...";
  }

  // 6. Price estimation (INR)
  let estimatedPriceMin = Number(raw.estimatedPriceMin);
  let estimatedPriceMax = Number(raw.estimatedPriceMax);

  if (isNaN(estimatedPriceMin) || estimatedPriceMin < 0) estimatedPriceMin = 100;
  if (isNaN(estimatedPriceMax) || estimatedPriceMax < estimatedPriceMin) {
    estimatedPriceMax = estimatedPriceMin > 0 ? Math.round(estimatedPriceMin * 1.3) : 200;
  }

  // Round to nearest integer (rupees)
  estimatedPriceMin = Math.round(estimatedPriceMin);
  estimatedPriceMax = Math.round(estimatedPriceMax);

  // 7. Tags (array of clean strings, max 8)
  let tags = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, ""))
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 8);
    // Remove duplicates
    tags = [...new Set(tags)];
  }

  // 8. Detected Attributes (brand, model)
  const detectedAttributes = {
    brand:
      raw.detectedAttributes && typeof raw.detectedAttributes.brand === "string"
        ? raw.detectedAttributes.brand.trim()
        : "Unknown",
    model:
      raw.detectedAttributes && typeof raw.detectedAttributes.model === "string"
        ? raw.detectedAttributes.model.trim()
        : "Unknown / Unable to determine",
  };

  // 9. Confidence (clamped between 0.0 and 1.0)
  let confidence = Number(raw.confidence);
  if (isNaN(confidence)) confidence = 0.85;
  confidence = Math.max(0.1, Math.min(1.0, Math.round(confidence * 100) / 100));

  // 10. Notes / observations
  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim())
    : [];

  return {
    detectedProduct,
    category,
    condition,
    suggestedTitle,
    description,
    estimatedPriceMin,
    estimatedPriceMax,
    currency: "INR",
    tags,
    detectedAttributes,
    confidence,
    notes,
  };
};
