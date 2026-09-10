import { geminiService } from "../services/geminiService.js";

/**
 * @desc    Generate structured listing suggestions from product photos using Gemini Vision
 * @route   POST /api/ai/generate-listing
 * @access  Private (Authenticated Sellers only)
 */
export const generateAiListing = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image to generate listing suggestions",
      });
    }

    if (files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 5 images can be submitted for AI analysis",
      });
    }

    const sellerContext = typeof req.body.sellerContext === "string" ? req.body.sellerContext : "";

    console.log(
      `[AI Listing] Request received from user ${req.user?._id || "anon"} with ${files.length} image(s)`
    );

    const suggestion = await geminiService.generateListingFromImages({
      files,
      sellerContext,
    });

    const duration = Date.now() - startTime;
    console.log(`[AI Listing] Generated successfully in ${duration}ms for user ${req.user?._id}`);

    return res.status(200).json({
      success: true,
      message: "AI listing suggestions generated successfully",
      data: suggestion,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[AI Listing] Failed after ${duration}ms:`, error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to generate AI listing suggestions",
      code: error.code || "AI_GENERATION_FAILED",
    });
  }
};
