/**
 * CampusX Web Crypto Utility Engine
 * Browser-native End-to-End Encryption (E2EE) primitives using Web Crypto API (SubtleCrypto)
 * 
 * Standards:
 * - Asymmetric: RSA-OAEP (2048-bit, SHA-256)
 * - Symmetric: AES-256-GCM (12-byte random IV per message, 128-bit auth tag)
 * - Context Binding: AAD (conversationId + senderId + receiverId)
 * - Key Derivation: PBKDF2 (150,000 iterations, SHA-256, 16-byte random salt)
 */

/**
 * Converts ArrayBuffer or Uint8Array to base64 string safely
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

/**
 * Converts base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
export const base64ToBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Converts ArrayBuffer to Hex string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export const bufferToHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

/**
 * Formats a hex string with colon separators (e.g. AA:BB:CC:...)
 * @param {string} hex
 * @returns {string}
 */
export const formatFingerprint = (hex) => {
  return hex.match(/.{1,2}/g)?.join(":") || hex;
};

/**
 * Generates an RSA-OAEP 2048-bit key pair for a user
 * @returns {Promise<CryptoKeyPair>}
 */
export const generateUserKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: "SHA-256",
    },
    true, // extractable (required for export & passphrase backup)
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
};

/**
 * Exports an RSA public key to base64-encoded SPKI format
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
export const exportPublicKey = async (publicKey) => {
  const spkiBuffer = await window.crypto.subtle.exportKey("spki", publicKey);
  return bufferToBase64(spkiBuffer);
};

/**
 * Imports an RSA public key from base64-encoded SPKI format
 * @param {string} base64Spki
 * @returns {Promise<CryptoKey>}
 */
export const importPublicKey = async (base64Spki) => {
  const buffer = base64ToBuffer(base64Spki);
  return await window.crypto.subtle.importKey(
    "spki",
    buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt", "wrapKey"]
  );
};

/**
 * Exports an RSA private key to base64-encoded PKCS#8 format
 * @param {CryptoKey} privateKey
 * @returns {Promise<string>}
 */
export const exportPrivateKey = async (privateKey) => {
  const pkcs8Buffer = await window.crypto.subtle.exportKey("pkcs8", privateKey);
  return bufferToBase64(pkcs8Buffer);
};

/**
 * Imports an RSA private key from base64-encoded PKCS#8 format
 * @param {string} base64Pkcs8
 * @returns {Promise<CryptoKey>}
 */
export const importPrivateKey = async (base64Pkcs8) => {
  const buffer = base64ToBuffer(base64Pkcs8);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt", "unwrapKey"]
  );
};

/**
 * Computes a SHA-256 cryptographic fingerprint for a public key
 * @param {string} base64Spki
 * @returns {Promise<string>} Colon-separated uppercase hex fingerprint
 */
export const computeKeyFingerprint = async (base64Spki) => {
  const buffer = base64ToBuffer(base64Spki);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
  const hex = bufferToHex(hashBuffer);
  return formatFingerprint(hex);
};

/**
 * Generates a random 256-bit AES-GCM session key
 * @returns {Promise<CryptoKey>}
 */
export const generateMessageKey = async () => {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable so it can be RSA wrapped
    ["encrypt", "decrypt"]
  );
};

/**
 * Generates a cryptographically secure random 12-byte IV for AES-GCM
 * @returns {Uint8Array}
 */
export const generateIV = () => {
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);
  return iv;
};

/**
 * Encrypts plaintext string using AES-256-GCM with Additional Authenticated Data (AAD)
 * @param {string} plaintext
 * @param {CryptoKey} aesKey
 * @param {Uint8Array} iv
 * @param {string} aadString
 * @returns {Promise<string>} Base64 ciphertext (includes 128-bit GCM authentication tag)
 */
export const encryptMessageContent = async (plaintext, aesKey, iv, aadString) => {
  const encoder = new TextEncoder();
  const encodedPlaintext = encoder.encode(plaintext);
  const encodedAAD = encoder.encode(aadString);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encodedAAD,
      tagLength: 128,
    },
    aesKey,
    encodedPlaintext
  );

  return bufferToBase64(ciphertextBuffer);
};

/**
 * Decrypts AES-256-GCM ciphertext with Additional Authenticated Data (AAD)
 * @param {string} ciphertextBase64
 * @param {CryptoKey} aesKey
 * @param {string|Uint8Array} iv
 * @param {string} aadString
 * @returns {Promise<string>} Decrypted UTF-8 plaintext string
 */
export const decryptMessageContent = async (ciphertextBase64, aesKey, iv, aadString) => {
  const ciphertextBuffer = base64ToBuffer(ciphertextBase64);
  const ivBuffer = typeof iv === "string" ? base64ToBuffer(iv) : iv;
  const encoder = new TextEncoder();
  const encodedAAD = encoder.encode(aadString);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      additionalData: encodedAAD,
      tagLength: 128,
    },
    aesKey,
    ciphertextBuffer
  );

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(decryptedBuffer);
};

/**
 * Wraps (encrypts) an AES-256 message key using an RSA-OAEP public key
 * @param {CryptoKey} aesKey
 * @param {CryptoKey} recipientPublicKey
 * @returns {Promise<string>} Base64 wrapped key
 */
export const wrapKeyWithRsa = async (aesKey, recipientPublicKey) => {
  const wrappedBuffer = await window.crypto.subtle.wrapKey(
    "raw",
    aesKey,
    recipientPublicKey,
    {
      name: "RSA-OAEP",
    }
  );
  return bufferToBase64(wrappedBuffer);
};

/**
 * Unwraps (decrypts) an AES-256 message key using an RSA-OAEP private key
 * @param {string} wrappedKeyBase64
 * @param {CryptoKey} privateKey
 * @returns {Promise<CryptoKey>}
 */
export const unwrapKeyWithRsa = async (wrappedKeyBase64, privateKey) => {
  const wrappedBuffer = base64ToBuffer(wrappedKeyBase64);
  return await window.crypto.subtle.unwrapKey(
    "raw",
    wrappedBuffer,
    privateKey,
    {
      name: "RSA-OAEP",
    },
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
};

/**
 * Derives an AES-256-GCM Key Encryption Key (KEK) from a passphrase using PBKDF2
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {number} iterations
 * @returns {Promise<CryptoKey>}
 */
export const deriveKekFromPassphrase = async (passphrase, salt, iterations = 150000) => {
  const encoder = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passphraseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Creates an encrypted backup payload of an RSA private key using a user passphrase
 * @param {CryptoKey} privateKey
 * @param {string} passphrase
 * @returns {Promise<{ ciphertext: string, iv: string, salt: string, iterations: number }>}
 */
export const createPassphraseBackup = async (privateKey, passphrase) => {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters long");
  }

  // 1. Generate random 16-byte salt and 12-byte IV
  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);
  const iv = generateIV();
  const iterations = 150000;

  // 2. Derive KEK via PBKDF2
  const kek = await deriveKekFromPassphrase(passphrase, salt, iterations);

  // 3. Export private key as PKCS#8
  const pkcs8Buffer = await window.crypto.subtle.exportKey("pkcs8", privateKey);

  // 4. Encrypt PKCS#8 buffer with AES-GCM
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    kek,
    pkcs8Buffer
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    iterations,
  };
};

/**
 * Restores an RSA private key from an encrypted passphrase backup payload
 * @param {{ ciphertext: string, iv: string, salt: string, iterations?: number }} backupPayload
 * @param {string} passphrase
 * @returns {Promise<CryptoKey>} Restored RSA-OAEP private key
 */
export const restorePassphraseBackup = async (backupPayload, passphrase) => {
  const { ciphertext, iv, salt, iterations = 150000 } = backupPayload;
  if (!ciphertext || !iv || !salt) {
    throw new Error("Incomplete backup payload");
  }

  const saltBuffer = base64ToBuffer(salt);
  const ivBuffer = base64ToBuffer(iv);
  const ciphertextBuffer = base64ToBuffer(ciphertext);

  // 1. Derive KEK via PBKDF2
  const kek = await deriveKekFromPassphrase(passphrase, saltBuffer, iterations);

  // 2. Decrypt PKCS#8 buffer
  const pkcs8Buffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      tagLength: 128,
    },
    kek,
    ciphertextBuffer
  );

  // 3. Import back into CryptoKey
  return await window.crypto.subtle.importKey(
    "pkcs8",
    pkcs8Buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt", "unwrapKey"]
  );
};
