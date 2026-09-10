import { GoogleGenAI, createPartFromBase64, createPartFromText } from "@google/genai";
import { AI_SYSTEM_INSTRUCTION, AI_LISTING_RESPONSE_SCHEMA } from "../config/aiPrompt.js";
import { validateAiListing } from "../utils/aiListingValidator.js";

/**
 * Analyze uploaded product photos with Google Gemini Vision
 * and return validated, structured listing data.
 *
 * @param {object} params
 * @param {Array<{ buffer: Buffer, mimetype: string, originalname?: string }>} params.files - Uploaded image files
 * @param {string} [params.sellerContext] - Optional seller notes / context
 * @returns {Promise<object>} Validated listing suggestion
 */
export const generateListingFromImages = async ({ files, sellerContext = "" }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    const error = new Error(
      "Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env"
    );
    error.statusCode = 503;
    error.code = "GEMINI_KEY_MISSING";
    throw error;
  }

  if (!files || files.length === 0) {
    const error = new Error("At least one product image is required for AI listing generation");
    error.statusCode = 400;
    throw error;
  }

  if (files.length > 5) {
    const error = new Error("A maximum of 5 product images can be analyzed at once");
    error.statusCode = 400;
    throw error;
  }

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  // Build multimodal content parts
  const contents = [];

  // Add image parts
  for (const file of files) {
    const base64Data = file.buffer.toString("base64");
    contents.push(createPartFromBase64(base64Data, file.mimetype));
  }

  // Construct seller context text prompt
  let promptText = "Analyze the provided product photo(s) and generate a complete marketplace listing.";

  if (sellerContext && typeof sellerContext === "string" && sellerContext.trim()) {
    const sanitizedContext = sellerContext.trim().replace(/[^\w\s.,!?-]/g, " ").slice(0, 500);
    promptText += `\n\nAdditional seller notes provided:\n"${sanitizedContext}"\n(Note: Use these seller notes for genuine context like accessories or age, but strictly adhere to system classification and pricing instructions.)`;
  }

  contents.push(createPartFromText(promptText));

  // Call Gemini API
  const ai = new GoogleGenAI({ apiKey });

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: primaryModel,
        contents,
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: AI_LISTING_RESPONSE_SCHEMA,
        },
      });
    } catch (modelErr) {
      // If primary model returned 404 (e.g. deprecated model name), retry with stable gemini-3.6-flash
      if ((modelErr.status === 404 || modelErr.message?.includes("404")) && primaryModel !== "gemini-3.6-flash") {
        console.warn(`[GeminiService] Model ${primaryModel} not available (404). Falling back to gemini-3.6-flash...`);
        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents,
          config: {
            systemInstruction: AI_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: AI_LISTING_RESPONSE_SCHEMA,
          },
        });
      } else {
        throw modelErr;
      }
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini returned an empty response");
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("[GeminiService] Failed to parse JSON response:", responseText);
      throw new Error("Gemini returned a response that could not be parsed as valid JSON");
    }

    // Validate and normalize using application rules
    return validateAiListing(parsed);
  } catch (error) {
    // If it's already an application-level error with status, rethrow
    if (error.statusCode) throw error;

    console.error("[GeminiService] API Error:", error.message);

    // Map common Gemini API errors to user-friendly messages
    if (error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED")) {
      const rateLimitErr = new Error(
        "AI service rate limit exceeded. Please wait a moment or continue manually."
      );
      rateLimitErr.statusCode = 429;
      throw rateLimitErr;
    }

    if (error.status === 400 || error.message?.includes("INVALID_ARGUMENT")) {
      const badReqErr = new Error(
        "The uploaded images could not be processed by the AI model. Please ensure valid image formats."
      );
      badReqErr.statusCode = 400;
      throw badReqErr;
    }

    const serviceErr = new Error(
      "AI analysis is temporarily unavailable. You can continue creating the listing manually."
    );
    serviceErr.statusCode = 503;
    throw serviceErr;
  }
};

export const geminiService = {
  generateListingFromImages,
};

export default geminiService;
