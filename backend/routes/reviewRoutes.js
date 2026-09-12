import express from "express";
import {
  createReview,
  getUserReviews,
  getProductReviews,
  getTransactionReviewStatus,
  getPendingReviews,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/auth.js";
import {
  createReviewRules,
  updateReviewRules,
  handleValidation,
} from "../middleware/validate.js";
import { reviewLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public review reading endpoints
router.get("/user/:userId", getUserReviews);
router.get("/product/:productId", getProductReviews);

// Authenticated review management endpoints
router.post(
  "/",
  protect,
  reviewLimiter,
  createReviewRules,
  handleValidation,
  createReview
);

router.get("/me/pending", protect, getPendingReviews);
router.get("/transaction/:transactionId", protect, getTransactionReviewStatus);

router.put(
  "/:reviewId",
  protect,
  reviewLimiter,
  updateReviewRules,
  handleValidation,
  updateReview
);

router.delete("/:reviewId", protect, reviewLimiter, deleteReview);

export default router;
