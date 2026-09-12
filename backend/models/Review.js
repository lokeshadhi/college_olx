import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reviewer is required"],
      index: true,
    },
    reviewedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reviewed user is required"],
      index: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: [true, "Transaction reference is required"],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true,
    },
    role: {
      type: String,
      enum: ["seller", "buyer"],
      required: [true, "Reviewed user role (seller or buyer) is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
    },
    review: {
      type: String,
      trim: true,
      maxlength: [500, "Review cannot exceed 500 characters"],
      default: "",
    },
    moderationStatus: {
      type: String,
      enum: ["APPROVED", "FLAGGED", "PENDING"],
      default: "APPROVED",
      index: true,
    },
    moderationReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Database constraint: One review per reviewer per transaction
reviewSchema.index({ reviewer: 1, transaction: 1 }, { unique: true });

// Supporting query indexes
reviewSchema.index({ reviewedUser: 1, role: 1, createdAt: -1 });
reviewSchema.index({ product: 1, createdAt: -1 });

// Authoritative rating aggregation on reviewed User
reviewSchema.statics.recalculateUserRatings = async function (userId) {
  const User = mongoose.model("User");
  if (!userId) return;

  const objectId = new mongoose.Types.ObjectId(userId);

  const stats = await this.aggregate([
    {
      $match: {
        reviewedUser: objectId,
        moderationStatus: { $ne: "FLAGGED" },
      },
    },
    {
      $group: {
        _id: "$role",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  let sellerRating = 0;
  let sellerReviewCount = 0;
  let buyerRating = 0;
  let buyerReviewCount = 0;

  stats.forEach((item) => {
    if (item._id === "seller") {
      sellerRating = Math.round(item.avgRating * 10) / 10;
      sellerReviewCount = item.count;
    } else if (item._id === "buyer") {
      buyerRating = Math.round(item.avgRating * 10) / 10;
      buyerReviewCount = item.count;
    }
  });

  const totalCount = sellerReviewCount + buyerReviewCount;
  let overallRating = 0;

  if (totalCount > 0) {
    const overallAvg = await this.aggregate([
      {
        $match: {
          reviewedUser: objectId,
          moderationStatus: { $ne: "FLAGGED" },
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    if (overallAvg.length > 0) {
      overallRating = Math.round(overallAvg[0].avgRating * 10) / 10;
    }
  }

  await User.findByIdAndUpdate(userId, {
    sellerRating,
    sellerReviewCount,
    buyerRating,
    buyerReviewCount,
    rating: overallRating,
    reviewCount: totalCount,
  });

  return {
    sellerRating,
    sellerReviewCount,
    buyerRating,
    buyerReviewCount,
    rating: overallRating,
    reviewCount: totalCount,
  };
};

const Review = mongoose.model("Review", reviewSchema);

export default Review;
