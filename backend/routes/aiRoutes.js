import express from "express";
import { protect } from "../middleware/auth.js";
import { handleAiUpload } from "../middleware/aiUpload.js";
import { generateAiListing } from "../controllers/aiController.js";
import { aiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Authenticated sellers can submit 1-5 product photos for multimodal analysis (rate-limited)
router.post("/generate-listing", protect, aiLimiter, handleAiUpload, generateAiListing);

export default router;
