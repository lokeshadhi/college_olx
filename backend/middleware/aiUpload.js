import multer from "multer";
import path from "path";
import { validateImageBufferMagicBytes } from "../utils/magicBytesValidator.js";
import { logSecurityEvent, SECURITY_EVENTS } from "../utils/securityLogger.js";

// Memory storage keeps images in RAM buffers during AI processing.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp/;
  const allowedMimes = /image\/(jpeg|jpg|png|webp)/;

  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const extValid = allowedExts.test(ext);
  const mimeValid = allowedMimes.test(file.mimetype);

  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    const err = new Error("Only JPEG, JPG, PNG, and WEBP image files are supported for AI analysis");
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per image
    files: 5, // Maximum 5 images for AI analysis
  },
});

// Middleware wrapper that normalizes Multer errors and validates binary magic bytes
export const handleAiUpload = (req, res, next) => {
  const uploadHandler = upload.array("images", 5);

  uploadHandler(req, res, (err) => {
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
          message: "Too many images. You can upload a maximum of 5 images for AI analysis.",
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

    // Inspect magic bytes of memory buffers
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const check = validateImageBufferMagicBytes(file.buffer);
        if (!check.valid) {
          logSecurityEvent(SECURITY_EVENTS.BLOCKED_UPLOAD, {
            req,
            userId: req.user?._id,
            metadata: {
              filename: file.originalname,
              reason: "Magic bytes mismatch / disguised file",
              detail: check.error,
            },
          });
          return res.status(400).json({
            success: false,
            message: check.error || "Uploaded file is not a valid image format",
          });
        }
      }
    }

    next();
  });
};

export default upload;
