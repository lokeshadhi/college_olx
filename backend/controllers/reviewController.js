import mongoose from "mongoose";
import Review from "../models/Review.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

// @desc    Create a new transaction review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req, res, next) => {
  try {
    const { transactionId, rating, review = "" } = req.body;
    const currentUserId = req.user._id;

    if (!transactionId || !mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "A valid transaction ID is required.",
      });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5.",
      });
    }

    if (review && review.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Review cannot exceed 500 characters.",
      });
    }

    // Lookup the transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    // Enforce completed transaction requirement
    if (transaction.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "You can only review a transaction after it has been completed.",
      });
    }

    // Authoritative participant check
    const isBuyer = transaction.buyer.toString() === currentUserId.toString();
    const isSeller = transaction.seller.toString() === currentUserId.toString();

    if (!isBuyer && !isSeller) {
      logSecurityEvent(SECURITY_EVENTS.INPUT_VALIDATION_FAILED, {
        req,
        userId: currentUserId,
        metadata: {
          action: "unauthorized_review_attempt",
          transactionId,
        },
      });
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this transaction.",
      });
    }

    // Determine reviewed user and role automatically from the transaction
    const reviewedUser = isBuyer ? transaction.seller : transaction.buyer;
    const role = isBuyer ? "seller" : "buyer"; // Role that was reviewed

    if (reviewedUser.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot review yourself.",
      });
    }

    // Enforce uniqueness: A participant can review this transaction only once
    const existingReview = await Review.findOne({
      reviewer: currentUserId,
      transaction: transaction._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this transaction.",
      });
    }

    const trimmedReview = review ? review.trim() : "";

    const newReview = new Review({
      reviewer: currentUserId,
      reviewedUser,
      transaction: transaction._id,
      product: transaction.product,
      role,
      rating: numericRating,
      review: trimmedReview,
      moderationStatus: "APPROVED",
      moderationReason: "",
    });

    await newReview.save();

    // Recalculate and update the reviewed user's rating stats
    await Review.recalculateUserRatings(reviewedUser);

    await newReview.populate("reviewer", "name profileImage department isEmailVerified");
    await newReview.populate("product", "title images price");

    res.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      data: newReview,
    });
  } catch (error) {
    // Handle MongoDB duplicate key error gracefully
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this transaction.",
      });
    }
    next(error);
  }
};

// @desc    Get paginated reviews for a user
// @route   GET /api/reviews/user/:userId
// @access  Public
export const getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const role = req.query.role; // "seller", "buyer", or omitted for all

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format.",
      });
    }

    const filter = {
      reviewedUser: userId,
      moderationStatus: { $ne: "FLAGGED" },
    };

    if (role === "seller" || role === "buyer") {
      filter.role = role;
    }

    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("reviewer", "name profileImage department isEmailVerified")
      .populate("product", "title images price");

    const user = await User.findById(userId).select(
      "name profileImage department isEmailVerified sellerRating sellerReviewCount buyerRating buyerReviewCount rating reviewCount"
    );

    res.status(200).json({
      success: true,
      data: reviews,
      stats: user
        ? {
            sellerRating: user.sellerRating || 0,
            sellerReviewCount: user.sellerReviewCount || 0,
            buyerRating: user.buyerRating || 0,
            buyerReviewCount: user.buyerReviewCount || 0,
            rating: user.rating || 0,
            reviewCount: user.reviewCount || 0,
          }
        : null,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format.",
      });
    }

    const reviews = await Review.find({
      product: productId,
      moderationStatus: { $ne: "FLAGGED" },
    })
      .sort({ createdAt: -1 })
      .populate("reviewer", "name profileImage department isEmailVerified");

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get review status for a specific transaction
// @route   GET /api/reviews/transaction/:transactionId
// @access  Private
export const getTransactionReviewStatus = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID format.",
      });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const isBuyer = transaction.buyer.toString() === currentUserId.toString();
    const isSeller = transaction.seller.toString() === currentUserId.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this transaction.",
      });
    }

    const reviews = await Review.find({ transaction: transactionId })
      .populate("reviewer", "name profileImage department isEmailVerified");

    const currentUserReview = reviews.find(
      (r) => r.reviewer._id.toString() === currentUserId.toString()
    ) || null;

    const otherUserReview = reviews.find(
      (r) => r.reviewer._id.toString() !== currentUserId.toString()
    ) || null;

    res.status(200).json({
      success: true,
      data: {
        transactionId,
        isCompleted: transaction.status === "COMPLETED",
        currentUserRole: isBuyer ? "buyer" : "seller",
        hasReviewed: Boolean(currentUserReview),
        currentUserReview,
        otherUserReview,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get completed transactions waiting for the logged-in user's review
// @route   GET /api/reviews/me/pending
// @access  Private
export const getPendingReviews = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Find all completed transactions where current user was buyer or seller
    const completedTransactions = await Transaction.find({
      $or: [{ buyer: currentUserId }, { seller: currentUserId }],
      status: "COMPLETED",
    })
      .sort({ completedAt: -1 })
      .populate("product", "title images price")
      .populate("buyer", "name profileImage department isEmailVerified")
      .populate("seller", "name profileImage department isEmailVerified");

    if (completedTransactions.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Find all reviews written by the current user
    const submittedReviews = await Review.find({
      reviewer: currentUserId,
      transaction: { $in: completedTransactions.map((t) => t._id) },
    }).select("transaction");

    const reviewedTxnIds = new Set(
      submittedReviews.map((r) => r.transaction.toString())
    );

    // Filter to transactions where current user hasn't submitted a review yet
    const pending = completedTransactions
      .filter((t) => !reviewedTxnIds.has(t._id.toString()))
      .map((t) => {
        const buyerId = t.buyer?._id ? t.buyer._id.toString() : t.buyer?.toString();
        const isBuyer = buyerId === currentUserId.toString();
        const otherParty = isBuyer ? t.seller : t.buyer;
        const targetRole = isBuyer ? "seller" : "buyer";

        return {
          transactionId: t._id,
          amount: t.amount,
          completedAt: t.completedAt,
          product: t.product,
          targetUser: otherParty,
          targetRole,
        };
      });

    res.status(200).json({
      success: true,
      count: pending.length,
      data: pending,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing review
// @route   PUT /api/reviews/:reviewId
// @access  Private
export const updateReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, review } = req.body;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID format.",
      });
    }

    const reviewDoc = await Review.findById(reviewId);
    if (!reviewDoc) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    // Only the reviewer can edit their review
    if (reviewDoc.reviewer.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to edit this review.",
      });
    }

    if (rating !== undefined) {
      const numericRating = Number(rating);
      if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be an integer between 1 and 5.",
        });
      }
      reviewDoc.rating = numericRating;
    }

    if (review !== undefined) {
      const trimmed = review.trim();
      if (trimmed.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Review cannot exceed 500 characters.",
        });
      }
      reviewDoc.review = trimmed;
      reviewDoc.moderationStatus = "APPROVED";
      reviewDoc.moderationReason = "";
    }

    await reviewDoc.save();

    // Recalculate user ratings
    await Review.recalculateUserRatings(reviewDoc.reviewedUser);

    res.status(200).json({
      success: true,
      message: "Review updated successfully.",
      data: reviewDoc,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:reviewId
// @access  Private
export const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID format.",
      });
    }

    const reviewDoc = await Review.findById(reviewId);
    if (!reviewDoc) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    // Only the reviewer can delete their review
    if (reviewDoc.reviewer.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this review.",
      });
    }

    const reviewedUserId = reviewDoc.reviewedUser;
    await reviewDoc.deleteOne();

    // Recalculate rating stats after deletion
    await Review.recalculateUserRatings(reviewedUserId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
