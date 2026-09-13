import mongoose from "mongoose";

const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Blocker user ID is required"],
      index: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Blocked user ID is required"],
      index: true,
    },
  },
  { timestamps: true }
);

// Compound unique index prevents duplicate block records
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// Check if communication between two users is blocked in either direction
blockSchema.statics.isBlocked = async function (userA, userB) {
  if (!userA || !userB) return false;
  const aId = userA._id ? userA._id.toString() : userA.toString();
  const bId = userB._id ? userB._id.toString() : userB.toString();
  if (aId === bId) return false;

  const count = await this.countDocuments({
    $or: [
      { blocker: aId, blocked: bId },
      { blocker: bId, blocked: aId },
    ],
  });
  return count > 0;
};

// Get detailed block relationship between two users
blockSchema.statics.getBlockStatus = async function (currentUserId, otherUserId) {
  if (!currentUserId || !otherUserId) {
    return { isBlocked: false, blockedByMe: false, blockedByUser: false };
  }

  const cId = currentUserId._id ? currentUserId._id.toString() : currentUserId.toString();
  const oId = otherUserId._id ? otherUserId._id.toString() : otherUserId.toString();

  if (cId === oId) {
    return { isBlocked: false, blockedByMe: false, blockedByUser: false };
  }

  const blocks = await this.find({
    $or: [
      { blocker: cId, blocked: oId },
      { blocker: oId, blocked: cId },
    ],
  });

  const blockedByMe = blocks.some((b) => b.blocker.toString() === cId);
  const blockedByUser = blocks.some((b) => b.blocker.toString() === oId);

  return {
    isBlocked: blockedByMe || blockedByUser,
    blockedByMe,
    blockedByUser,
  };
};

const Block = mongoose.model("Block", blockSchema);

export default Block;
