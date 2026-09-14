import mongoose from "mongoose";

const publicKeySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
      index: true,
    },
    publicKey: {
      type: String,
      required: [true, "Public key SPKI string is required"],
      trim: true,
    },
    fingerprint: {
      type: String,
      required: [true, "Cryptographic fingerprint is required"],
      trim: true,
    },
    keyVersion: {
      type: Number,
      default: 1,
    },
    algorithm: {
      type: String,
      default: "RSA-OAEP-2048",
    },
    previousFingerprints: [
      {
        fingerprint: { type: String, required: true },
        rotatedAt: { type: Date, default: Date.now },
      },
    ],
    encryptedBackup: {
      ciphertext: { type: String, trim: true },
      iv: { type: String, trim: true },
      salt: { type: String, trim: true },
      iterations: { type: Number, default: 150000 },
      createdAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

const PublicKey = mongoose.model("PublicKey", publicKeySchema);

export default PublicKey;
