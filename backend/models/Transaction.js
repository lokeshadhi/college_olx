import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer is required"],
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Seller is required"],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Transaction amount is required"],
      min: [0, "Amount must be a non-negative number"],
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "PAYMENT_PENDING",
        "PAID",
        "MEETUP_SCHEDULED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "COMPLETED",
      index: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    buyerConfirmed: {
      type: Boolean,
      default: false,
    },
    sellerConfirmed: {
      type: Boolean,
      default: false,
    },
    meetupLocation: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound indexes for user deal lookups
transactionSchema.index({ buyer: 1, status: 1 });
transactionSchema.index({ seller: 1, status: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
