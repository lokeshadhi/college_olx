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

// Map of canonical extensions by MIME type
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
    // Generate cryptographically unpredictable random filenames.
    // Never trust or use original user-provided filenames directly.
    const randomHex = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `product-${Date.now()}-${randomHex}${safeExt}`);
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
    const err = new Error("Only JPEG, JPG, PNG, and WebP image files are allowed");
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 images per listing
  },
});

/**
 * Middleware wrapper that executes multer upload AND performs deep magic bytes
 * (file signature) inspection on every file written to disk.
 * If any file fails binary inspection, all uploaded files from the request are purged.
 */
export const secureProductUpload = (req, res, next) => {
  const uploadHandler = upload.array("images", 5);

  uploadHandler(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      logSecurityEvent(SECURITY_EVENTS.BLOCKED_UPLOAD, {
        req,
        userId: req.user?._id,
        metadata: { reason: `Multer: ${err.code}`, message: err.message },
      });

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Image too large. Maximum allowed size is 10MB per image.",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          message: "Too many images. You can upload a maximum of 5 images per listing.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    if (err) {
      logSecurityEvent(SECURITY_EVENTS.BLOCKED_UPLOAD, {
        req,
        userId: req.user?._id,
        metadata: { reason: "FileFilter rejection", message: err.message },
      });
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to process uploaded images",
      });
    }

    // If files were uploaded, verify their true binary file signatures
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const magicCheck = await validateDiskFileMagicBytes(file.path);
        if (!magicCheck.valid) {
          logSecurityEvent(SECURITY_EVENTS.BLOCKED_UPLOAD, {
            req,
            userId: req.user?._id,
            metadata: {
              filename: file.originalname,
              reason: "Magic bytes mismatch / disguised file",
              detail: magicCheck.error,
            },
          });

          // Clean up all files from disk for this failed request
          req.files.forEach((f) => {
            try {
              if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            } catch (unlinkErr) {
              console.error("Failed to delete suspicious file:", unlinkErr);
            }
          });

          return res.status(400).json({
            success: false,
            message: magicCheck.error || "Uploaded file is not a valid image",
          });
        }
      }
    }

    next();
  });
};

export default upload;
