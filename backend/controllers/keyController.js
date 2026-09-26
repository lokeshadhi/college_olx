import PublicKey from "../models/PublicKey.js";

/**
 * @desc    Register or rotate the authenticated user's public key
 * @route   POST /api/chat/keys/public-key
 * @access  Private
 */
export const registerPublicKey = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { publicKey, fingerprint, algorithm = "RSA-OAEP-2048" } = req.body;

    if (!publicKey || typeof publicKey !== "string" || !publicKey.trim()) {
      return res.status(400).json({ success: false, message: "Valid public key string is required" });
    }

    if (!fingerprint || typeof fingerprint !== "string" || !fingerprint.trim()) {
      return res.status(400).json({ success: false, message: "Valid fingerprint string is required" });
    }

    const trimmedPublicKey = publicKey.trim();
    const trimmedFingerprint = fingerprint.trim();

    let record = await PublicKey.findOne({ user: userId });

    if (record && record.publicKey && record.publicKey !== "PENDING") {
      // If the fingerprint matches, it's an idempotent registration of the user's existing identity
      if (record.fingerprint === trimmedFingerprint) {
        return res.status(200).json({
          success: true,
          data: {
            userId: record.user,
            publicKey: record.publicKey,
            fingerprint: record.fingerprint,
            keyVersion: record.keyVersion || 1,
            algorithm: record.algorithm,
          },
        });
      }

      // If fingerprint is different, reject registration!
      // A user must have ONLY ONE cryptographic identity across all their devices.
      return res.status(409).json({
        success: false,
        code: "IDENTITY_ALREADY_EXISTS",
        message:
          "A cryptographic identity is already registered for this account. Each user has only one cryptographic identity across all devices. Please restore your existing key using your backup passphrase.",
      });
    }

    if (record) {
      // Record was pre-created (e.g., backup was stored first with PENDING public key)
      record.publicKey = trimmedPublicKey;
      record.fingerprint = trimmedFingerprint;
      record.algorithm = algorithm;
      record.keyVersion = 1;
      await record.save();
    } else {
      // Initial registration of the user's single cryptographic identity
      record = await PublicKey.create({
        user: userId,
        publicKey: trimmedPublicKey,
        fingerprint: trimmedFingerprint,
        algorithm,
        keyVersion: 1,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: record.user,
        publicKey: record.publicKey,
        fingerprint: record.fingerprint,
        keyVersion: record.keyVersion,
        algorithm: record.algorithm,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Retrieve public key and fingerprint for a specific user
 * @route   GET /api/chat/keys/public-key/:userId
 * @access  Private
 */
export const getPublicKeyByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId parameter is required" });
    }

    const record = await PublicKey.findOne({ user: userId }).lean();

    if (!record || !record.publicKey) {
      return res.status(404).json({ success: false, message: "Encryption public key not found for this user" });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: record.user,
        publicKey: record.publicKey,
        fingerprint: record.fingerprint,
        keyVersion: record.keyVersion || 1,
        algorithm: record.algorithm || "RSA-OAEP-2048",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Store an encrypted private key backup blob
 * @route   POST /api/chat/keys/backup
 * @access  Private
 */
export const storeEncryptedBackup = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { ciphertext, iv, salt, iterations = 150000, version = 1 } = req.body;

    if (!ciphertext || !iv || !salt) {
      return res.status(400).json({
        success: false,
        message: "ciphertext, iv, and salt are required for encrypted backup",
      });
    }

    let record = await PublicKey.findOne({ user: userId });

    if (!record) {
      record = await PublicKey.create({
        user: userId,
        publicKey: "PENDING",
        fingerprint: "PENDING",
        encryptedBackup: {
          version: Number(version) || 1,
          ciphertext: ciphertext.trim(),
          iv: iv.trim(),
          salt: salt.trim(),
          iterations: Number(iterations) || 150000,
          createdAt: new Date(),
        },
      });
    } else {
      record.encryptedBackup = {
        version: Number(version) || 1,
        ciphertext: ciphertext.trim(),
        iv: iv.trim(),
        salt: salt.trim(),
        iterations: Number(iterations) || 150000,
        createdAt: new Date(),
      };
      await record.save();
    }

    res.status(200).json({
      success: true,
      message: "Encrypted key backup saved successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Retrieve user's encrypted private key backup blob
 * @route   GET /api/chat/keys/backup
 * @access  Private
 */
export const getEncryptedBackup = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const record = await PublicKey.findOne({ user: userId }).lean();

    if (!record || !record.encryptedBackup || !record.encryptedBackup.ciphertext) {
      return res.status(404).json({
        success: false,
        message: "No encrypted key backup found for this account",
      });
    }

    res.status(200).json({
      success: true,
      data: record.encryptedBackup,
    });
  } catch (error) {
    next(error);
  }
};
