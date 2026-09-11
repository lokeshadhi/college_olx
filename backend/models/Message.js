import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation reference is required"],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Receiver is required"],
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [2000, "Message content cannot exceed 2000 characters"],
      default: "",
    },
    messageType: {
      type: String,
      enum: ["text", "image"],
      default: "text",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    securityAnalysis: {
      risk: {
        type: String,
        enum: ["low", "medium", "high", "unknown"],
        default: "low",
      },
      category: {
        type: String,
        default: "normal",
      },
      reason: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true }
);

// Optimize conversation message retrieval and unread counts
messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, read: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
