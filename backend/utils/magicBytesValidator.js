import fs from "fs";

/**
 * Validates whether a Buffer or file descriptor contains authentic image magic bytes
 * (file signatures) for JPEG, PNG, or WebP.
 * 
 * Protects against disguised executables, HTML, JavaScript polyglots, and PHP scripts.
 */

const SIGNATURES = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  RIFF: [0x52, 0x49, 0x46, 0x46], // "RIFF"
  WEBP: [0x57, 0x45, 0x42, 0x50], // "WEBP" at offset 8
};

/**
 * Checks a buffer against allowed image signatures.
 * @param {Buffer} buffer - Buffer containing at least the first 16 bytes of the file
 * @returns {{ valid: boolean, format?: string, error?: string }}
 */
export const validateImageBufferMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: "File too small or corrupted to be a valid image" };
  }

  // 1. Check JPEG (FF D8 FF)
  if (
    buffer[0] === SIGNATURES.JPEG[0] &&
    buffer[1] === SIGNATURES.JPEG[1] &&
    buffer[2] === SIGNATURES.JPEG[2]
  ) {
    return { valid: true, format: "jpeg" };
  }

  // 2. Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer.length >= 8 &&
    buffer[0] === SIGNATURES.PNG[0] &&
    buffer[1] === SIGNATURES.PNG[1] &&
    buffer[2] === SIGNATURES.PNG[2] &&
    buffer[3] === SIGNATURES.PNG[3] &&
    buffer[4] === SIGNATURES.PNG[4] &&
    buffer[5] === SIGNATURES.PNG[5] &&
    buffer[6] === SIGNATURES.PNG[6] &&
    buffer[7] === SIGNATURES.PNG[7]
  ) {
    return { valid: true, format: "png" };
  }

  // 3. Check WebP (RIFF at 0..3 and WEBP at 8..11)
  if (
    buffer.length >= 12 &&
    buffer[0] === SIGNATURES.RIFF[0] &&
    buffer[1] === SIGNATURES.RIFF[1] &&
    buffer[2] === SIGNATURES.RIFF[2] &&
    buffer[3] === SIGNATURES.RIFF[3] &&
    buffer[8] === SIGNATURES.WEBP[0] &&
    buffer[9] === SIGNATURES.WEBP[1] &&
    buffer[10] === SIGNATURES.WEBP[2] &&
    buffer[11] === SIGNATURES.WEBP[3]
  ) {
    return { valid: true, format: "webp" };
  }

  // Dangerous polyglots check (e.g. starts with <html, <!DOC, <svg, <?php)
  const headerString = buffer.subarray(0, 50).toString("ascii").toLowerCase();
  if (
    headerString.includes("<html") ||
    headerString.includes("<!doctype") ||
    headerString.includes("<script") ||
    headerString.includes("<?php") ||
    headerString.includes("<svg")
  ) {
    return {
      valid: false,
      error: "File contains dangerous script or markup content disguised as an image",
    };
  }

  return {
    valid: false,
    error: "File signature does not match allowed image formats (JPEG, PNG, WebP)",
  };
};

/**
 * Validates a file on disk by reading its first 32 bytes and checking magic bytes.
 * @param {string} filePath - Absolute path to the file on disk
 * @returns {Promise<{ valid: boolean, format?: string, error?: string }>}
 */
export const validateDiskFileMagicBytes = async (filePath) => {
  return new Promise((resolve) => {
    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        return resolve({ valid: false, error: "Unable to read uploaded file for validation" });
      }

      const buffer = Buffer.alloc(32);
      fs.read(fd, buffer, 0, 32, 0, (readErr, bytesRead) => {
        fs.close(fd, () => {});

        if (readErr || bytesRead < 12) {
          return resolve({ valid: false, error: "Failed to verify file integrity" });
        }

        resolve(validateImageBufferMagicBytes(buffer));
      });
    });
  });
};
