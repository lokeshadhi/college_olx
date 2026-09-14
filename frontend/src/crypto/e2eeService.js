/**
 * CampusX End-to-End Encryption (E2EE) Orchestration Service
 * 
 * Manages the client-side cryptographic identity:
 * - Key initialization and local persistence (IndexedDB)
 * - Public key registry registration with backend
 * - Peer public key retrieval and fingerprint tracking (key-change warnings)
 * - Symmetric message encryption (AES-256-GCM) + RSA-OAEP dual-wrapping
 * - Message decryption with Additional Authenticated Data (AAD) verification
 * - Decryption caching in-memory
 * - Passphrase backup and restoration
 */

import api from "../services/api";
import {
  generateUserKeyPair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKey,
  importPrivateKey,
  computeKeyFingerprint,
  generateMessageKey,
  generateIV,
  encryptMessageContent,
  decryptMessageContent,
  wrapKeyWithRsa,
  unwrapKeyWithRsa,
  createPassphraseBackup,
  restorePassphraseBackup,
  bufferToBase64,
} from "./webCryptoUtils";
import { saveLocalKeyPair, getLocalKeyPair, clearLocalKeyPair } from "./keyStore";

class E2EEService {
  constructor() {
    this.currentUserId = null;
    this.localCryptoKey = null; // { privateKey, publicKey, publicKeySpki, fingerprint }
    this.peerKeyCache = new Map(); // userId -> { publicKey, fingerprint }
    this.decryptedCache = new Map(); // messageId -> string
    this.knownFingerprintsKey = "campusx_known_fingerprints";
  }

  /**
   * Reads known peer fingerprints from localStorage
   * @returns {Record<string, string>}
   */
  getKnownFingerprints() {
    try {
      const data = localStorage.getItem(this.knownFingerprintsKey);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Saves a known peer fingerprint
   * @param {string} peerId
   * @param {string} fingerprint
   */
  saveKnownFingerprint(peerId, fingerprint) {
    try {
      const map = this.getKnownFingerprints();
      map[peerId.toString()] = fingerprint;
      localStorage.setItem(this.knownFingerprintsKey, JSON.stringify(map));
    } catch (e) {
      console.warn("Failed to persist peer fingerprint to localStorage", e);
    }
  }

  /**
   * Initializes E2EE for the logged-in user
   * @param {object} user - Logged in user object ({ _id, name, email })
   * @returns {Promise<{ status: string, fingerprint?: string, hasBackup?: boolean }>}
   */
  async initUserKeys(user) {
    if (!user || !user._id) {
      throw new Error("Valid user object required for E2EE initialization");
    }

    const userId = user._id.toString();
    this.currentUserId = userId;

    // 1. Check if user already has local keys in IndexedDB
    const local = await getLocalKeyPair(userId);

    if (local && local.privateKeyPkcs8 && local.publicKeySpki) {
      try {
        const privateKey = await importPrivateKey(local.privateKeyPkcs8);
        const publicKey = await importPublicKey(local.publicKeySpki);
        const fingerprint = local.fingerprint || (await computeKeyFingerprint(local.publicKeySpki));

        this.localCryptoKey = {
          privateKey,
          publicKey,
          publicKeySpki: local.publicKeySpki,
          fingerprint,
        };

        // Ensure backend has current public key registered
        await this.syncPublicKeyWithBackend(local.publicKeySpki, fingerprint);

        return { status: "ready", fingerprint };
      } catch (err) {
        console.error("Failed to restore existing keys from IndexedDB:", err);
      }
    }

    // 2. If no local keys found in IndexedDB, check if an encrypted backup exists on server
    try {
      const backupRes = await api.get("/chat/keys/backup");
      if (backupRes.data?.success && backupRes.data?.data) {
        return { status: "needs_restore", hasBackup: true };
      }
    } catch (err) {
      // 404 means no backup exists, proceed to key generation
    }

    // 3. Generate a brand new RSA-OAEP key pair
    return await this.generateAndRegisterNewKeys(userId);
  }

  /**
   * Generates a new key pair, saves to IndexedDB, and registers with backend
   * @param {string} userId
   * @returns {Promise<{ status: string, fingerprint: string }>}
   */
  async generateAndRegisterNewKeys(userId) {
    const keyPair = await generateUserKeyPair();
    const publicKeySpki = await exportPublicKey(keyPair.publicKey);
    const privateKeyPkcs8 = await exportPrivateKey(keyPair.privateKey);
    const fingerprint = await computeKeyFingerprint(publicKeySpki);

    // Save locally to IndexedDB
    await saveLocalKeyPair(userId, {
      publicKeySpki,
      privateKeyPkcs8,
      fingerprint,
    });

    // Cache in memory
    this.localCryptoKey = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeySpki,
      fingerprint,
    };

    // Register with backend
    await this.syncPublicKeyWithBackend(publicKeySpki, fingerprint);

    return { status: "ready", fingerprint, isNewKey: true };
  }

  /**
   * Syncs public key to backend registry
   * @param {string} publicKeySpki
   * @param {string} fingerprint
   */
  async syncPublicKeyWithBackend(publicKeySpki, fingerprint) {
    try {
      await api.post("/chat/keys/public-key", {
        publicKey: publicKeySpki,
        fingerprint,
        algorithm: "RSA-OAEP-2048",
      });
    } catch (error) {
      console.warn("Public key registration warning:", error.message);
    }
  }

  /**
   * Retrieves peer public key and checks for key-rotation warnings
   * @param {string} peerId
   * @returns {Promise<{ publicKey: CryptoKey, fingerprint: string, keyChanged: boolean, previousFingerprint?: string }>}
   */
  async getPeerPublicKey(peerId) {
    if (!peerId) throw new Error("peerId is required");
    const pid = peerId.toString();

    // Check in-memory cache
    if (this.peerKeyCache.has(pid)) {
      return this.peerKeyCache.get(pid);
    }

    // Fetch from backend
    const response = await api.get(`/chat/keys/public-key/${pid}`);
    if (!response.data?.success || !response.data?.data?.publicKey) {
      throw new Error("Recipient does not have a registered encryption key");
    }

    const { publicKey: base64Spki, fingerprint } = response.data.data;
    const publicKey = await importPublicKey(base64Spki);

    // Check against known fingerprint in localStorage
    const knownMap = this.getKnownFingerprints();
    const knownFingerprint = knownMap[pid];
    let keyChanged = false;

    if (knownFingerprint && knownFingerprint !== fingerprint) {
      keyChanged = true;
    }

    // Update known fingerprint
    this.saveKnownFingerprint(pid, fingerprint);

    const result = {
      publicKey,
      fingerprint,
      keyChanged,
      previousFingerprint: knownFingerprint,
    };

    this.peerKeyCache.set(pid, result);
    return result;
  }

  /**
   * Encrypts outgoing message text for recipient with dual RSA wrapping (sender self-copy)
   * @param {string} conversationId
   * @param {string} senderId
   * @param {string} receiverId
   * @param {string} plaintext
   * @returns {Promise<{ encryptionVersion: number, ciphertext: string, iv: string, encryptedKey: string, senderEncryptedKey: string, keyFingerprint: string }>}
   */
  async encryptMessage(conversationId, senderId, receiverId, plaintext) {
    if (!this.localCryptoKey?.publicKey) {
      throw new Error("Sender cryptographic identity is not initialized");
    }

    // 1. Fetch recipient's public key
    const peerInfo = await this.getPeerPublicKey(receiverId);

    // 2. Generate ephemeral 256-bit AES-GCM session key & random 12-byte IV
    const aesKey = await generateMessageKey();
    const iv = generateIV();

    // 3. Define Context Binding AAD: conversationId:senderId:receiverId
    const aadString = `campusx:e2ee:v1:${conversationId}:${senderId}:${receiverId}`;

    // 4. Encrypt message content with AES-256-GCM
    const ciphertext = await encryptMessageContent(plaintext, aesKey, iv, aadString);

    // 5. Wrap AES session key for recipient (RSA-OAEP)
    const encryptedKey = await wrapKeyWithRsa(aesKey, peerInfo.publicKey);

    // 6. Wrap AES session key for sender self-copy (RSA-OAEP)
    const senderEncryptedKey = await wrapKeyWithRsa(aesKey, this.localCryptoKey.publicKey);

    return {
      encryptionVersion: 1,
      ciphertext,
      iv: bufferToBase64(iv),
      encryptedKey,
      senderEncryptedKey,
      keyFingerprint: peerInfo.fingerprint,
    };
  }

  /**
   * Decrypts an encrypted message in-memory
   * @param {object} message
   * @param {string} currentUserId
   * @returns {Promise<{ decryptedText: string, isEncrypted: boolean, error?: string }>}
   */
  async decryptMessage(message, currentUserId) {
    if (!message) return { decryptedText: "", isEncrypted: false };

    // Legacy plaintext message support (encryptionVersion: 0 or undefined)
    if (!message.encryptionVersion || message.encryptionVersion === 0 || !message.ciphertext) {
      return {
        decryptedText: message.content || "",
        isEncrypted: false,
      };
    }

    const messageId = message._id?.toString() || message.id?.toString();
    if (messageId && this.decryptedCache.has(messageId)) {
      return {
        decryptedText: this.decryptedCache.get(messageId),
        isEncrypted: true,
      };
    }

    if (!this.localCryptoKey?.privateKey) {
      return {
        decryptedText: "🔒 [Encrypted Message - Private key not available on this device]",
        isEncrypted: true,
        error: "NO_PRIVATE_KEY",
      };
    }

    try {
      const myId = currentUserId?.toString();
      const senderId = (message.sender?._id || message.sender)?.toString();
      const receiverId = (message.receiver?._id || message.receiver)?.toString();
      const convId = (message.conversation?._id || message.conversation)?.toString();

      // Determine which wrapped key to unwrap:
      // If current user is sender, use senderEncryptedKey
      // If current user is receiver, use encryptedKey
      const isSender = senderId === myId;
      const wrappedKey = isSender ? message.senderEncryptedKey : message.encryptedKey;

      if (!wrappedKey) {
        throw new Error("Missing encrypted key payload for this recipient");
      }

      // 1. Unwrap AES session key using user's private key
      const aesKey = await unwrapKeyWithRsa(wrappedKey, this.localCryptoKey.privateKey);

      // 2. Reconstruct AAD context binding
      const aadString = `campusx:e2ee:v1:${convId}:${senderId}:${receiverId}`;

      // 3. Decrypt ciphertext with AES-256-GCM + AAD
      const plaintext = await decryptMessageContent(message.ciphertext, aesKey, message.iv, aadString);

      if (messageId) {
        this.decryptedCache.set(messageId, plaintext);
      }

      return {
        decryptedText: plaintext,
        isEncrypted: true,
      };
    } catch (err) {
      console.error("Message decryption failed:", err.message);
      return {
        decryptedText: "🔒 [Decryption failed: Message tampered or key mismatch]",
        isEncrypted: true,
        error: err.message,
      };
    }
  }

  /**
   * Backs up the user's private key with a passphrase to the server
   * @param {string} passphrase
   * @returns {Promise<boolean>}
   */
  async backupPrivateKeyWithPassphrase(passphrase) {
    if (!this.localCryptoKey?.privateKey) {
      throw new Error("No private key loaded to backup");
    }

    const backupPayload = await createPassphraseBackup(this.localCryptoKey.privateKey, passphrase);
    const res = await api.post("/chat/keys/backup", backupPayload);
    return res.data?.success;
  }

  /**
   * Restores user's private key from server backup using passphrase
   * @param {string} userId
   * @param {string} passphrase
   * @returns {Promise<boolean>}
   */
  async restorePrivateKeyWithPassphrase(userId, passphrase) {
    const res = await api.get("/chat/keys/backup");
    if (!res.data?.success || !res.data?.data) {
      throw new Error("No key backup found on server");
    }

    const backupData = res.data.data;
    const privateKey = await restorePassphraseBackup(backupData, passphrase);

    // Also fetch public key to store full pair in IndexedDB
    const pubRes = await api.get(`/chat/keys/public-key/${userId}`);
    const publicKeySpki = pubRes.data?.data?.publicKey;
    const fingerprint = pubRes.data?.data?.fingerprint;

    if (!publicKeySpki) {
      throw new Error("Public key registry mismatch on server");
    }

    const publicKey = await importPublicKey(publicKeySpki);
    const privateKeyPkcs8 = await exportPrivateKey(privateKey);

    await saveLocalKeyPair(userId, {
      publicKeySpki,
      privateKeyPkcs8,
      fingerprint,
    });

    this.localCryptoKey = {
      privateKey,
      publicKey,
      publicKeySpki,
      fingerprint,
    };

    return true;
  }

  /**
   * Clears local state and caches (on logout)
   */
  resetState() {
    this.currentUserId = null;
    this.localCryptoKey = null;
    this.peerKeyCache.clear();
    this.decryptedCache.clear();
  }
}

// Export singleton instance
export const e2eeService = new E2EEService();
export default e2eeService;
