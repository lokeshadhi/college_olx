import express from "express";
import { protect } from "../middleware/auth.js";
import { handleAiUpload } from "../middleware/aiUpload.js";
import { generateAiListing } from "../controllers/aiController.js";

const router = express.Router();

// Authenticated sellers can submit 1-5 product photos for multimodal analysis
router.post("/generate-listing", protect, handleAiUpload, generateAiListing);

export default router;
