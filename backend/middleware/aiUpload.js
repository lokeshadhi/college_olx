import multer from "multer";
import path from "path";

// Memory storage keeps images in RAM buffers during AI processing.
// This prevents orphan image files on disk when generating AI suggestions.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp/;
  const allowedMimes = /image\/(jpeg|jpg|png|webp)/;

  const ext = path.extname(file.originalname).toLowerCase();
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
    fileSize: 5 * 1024 * 1024, // 5MB limit per image
    files: 5, // Maximum 5 images for AI analysis
  },
});

// Middleware wrapper that normalizes Multer errors into standard JSON responses
export const handleAiUpload = (req, res, next) => {
  const uploadHandler = upload.array("images", 5);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Image too large. Maximum allowed size is 5MB per image.",
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
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to process uploaded images",
      });
    }

    next();
  });
};

export default upload;
