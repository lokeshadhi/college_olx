import mongoose from "mongoose";

export const REPORT_REASONS = [
  "harassment",
  "spam",
  "scam",
  "inappropriate_content",
  "other",
];

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter user ID is required"],
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reported user ID is required"],
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      enum: {
        values: REPORT_REASONS,
        message: "{VALUE} is not a valid report reason category",
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes to assist admin moderation queries and prevent duplicate spamming
reportSchema.index({ reporter: 1, reportedUser: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
