import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { validateDiskFileMagicBytes } from "../utils/magicBytesValidator.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_MAP = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `chat-${Date.now()}-${randomHex}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const extValid = allowedExts.test(ext);
  const mimeValid = Object.keys(ALLOWED_MIME_MAP).includes(file.mimetype);

  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    const err = new Error("Only JPEG, PNG, and WebP images are allowed in chat");
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for chat images
    files: 1,
  },
});

/**
 * Middleware that accepts a single chat image and performs binary magic bytes inspection
 */
export const secureChatUpload = (req, res, next) => {
  const uploadHandler = upload.single("image");

  uploadHandler(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Image too large. Maximum size for chat images is 5MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Invalid file upload",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Binary magic byte validation on disk
    try {
      const magicCheck = await validateDiskFileMagicBytes(req.file.path);
      if (!magicCheck.valid) {
        fs.unlink(req.file.path, () => {});
        logSecurityEvent(SECURITY_EVENTS.BLOCKED_UPLOAD, {
          req,
          userId: req.user?._id,
          metadata: { reason: "Chat image failed magic bytes validation", file: req.file.originalname },
        });

        return res.status(400).json({
          success: false,
          message: "Uploaded file does not match a valid image signature (JPEG, PNG, or WebP).",
        });
      }

      next();
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({
        success: false,
        message: "Error verifying image integrity",
      });
    }
  });
};

export default secureChatUpload;
