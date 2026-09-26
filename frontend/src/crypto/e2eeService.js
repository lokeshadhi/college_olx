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
  verifyKeyPairMatch,
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
   * Initializes or loads local E2EE keys from IndexedDB for the logged-in user.
   * Password-based restoration and initial key provisioning are handled during login
   * via ensureUserKeysWithPassword(). This method strictly checks and activates
   * locally stored keys without ever prompting for a backup passphrase.
   * 
   * @param {object} user - Logged in user object ({ _id, name, email })
   * @returns {Promise<{ status: string, fingerprint?: string }>}
   */
  async initUserKeys(user) {
    if (!user || !user._id) {
      throw new Error("Valid user object required for E2EE initialization");
    }

    const userId = user._id.toString();
    this.currentUserId = userId;

    // Guard: If in-memory state already has a valid privateKey for this user, do NOT overwrite or downgrade
    if (this.localCryptoKey?.privateKey && this.currentUserId === userId) {
      return { status: "ready", fingerprint: this.localCryptoKey.fingerprint };
    }

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

    // 2. If local keys are not in IndexedDB: check if server already has a registered identity
    try {
      const pubRes = await api.get(`/chat/keys/public-key/${userId}`);
      if (pubRes.data?.success && pubRes.data?.data?.publicKey) {
        const serverKey = pubRes.data.data;
        const publicKey = await importPublicKey(serverKey.publicKey);

        // Check if an encrypted backup exists on the server to recover
        let hasBackup = false;
        try {
          const backupRes = await api.get("/chat/keys/backup");
          hasBackup = !!(backupRes.data?.success && backupRes.data?.data?.ciphertext);
        } catch {
          hasBackup = false;
        }

        // Only set public-key state if no privateKey is currently active in memory
        if (!this.localCryptoKey?.privateKey) {
          this.localCryptoKey = {
            privateKey: null,
            publicKey,
            publicKeySpki: serverKey.publicKey,
            fingerprint: serverKey.fingerprint,
          };
        }

        return {
          status: hasBackup ? "needs_password_recovery" : "ready_sender_only",
          fingerprint: serverKey.fingerprint,
          hasBackup,
        };
      }
    } catch {
      // 404 means no public key registered on server yet
    }

    // 3. User has no identity anywhere: generate new keypair, save locally, and register
    try {
      const newKeys = await this.generateAndRegisterNewKeys(userId);
      return newKeys;
    } catch (err) {
      console.error("Failed to generate and register new keys in initUserKeys:", err);
      return { status: "missing_local_keys" };
    }
  }

  /**
   * Ensures sender's cryptographic public key is loaded in memory for outgoing encryption
   * @param {string} senderId
   * @returns {Promise<{ publicKey: CryptoKey, publicKeySpki: string, fingerprint: string }>}
   */
  async ensureSenderIdentity(senderId) {
    if (this.localCryptoKey?.publicKey) {
      return this.localCryptoKey;
    }

    const sid = (senderId || this.currentUserId)?.toString();
    if (!sid) {
      throw new Error("Sender user ID is required to establish cryptographic identity");
    }

    // 1. Try to load from IndexedDB
    try {
      const local = await getLocalKeyPair(sid);
      if (local && local.publicKeySpki) {
        const publicKey = await importPublicKey(local.publicKeySpki);
        let privateKey = null;
        if (local.privateKeyPkcs8) {
          try {
            privateKey = await importPrivateKey(local.privateKeyPkcs8);
          } catch (e) {
            console.warn("Private key import failed during ensureSenderIdentity:", e);
          }
        }
        const fingerprint = local.fingerprint || (await computeKeyFingerprint(local.publicKeySpki));
        this.localCryptoKey = {
          privateKey,
          publicKey,
          publicKeySpki: local.publicKeySpki,
          fingerprint,
        };
        return this.localCryptoKey;
      }
    } catch (err) {
      console.warn("Error restoring from IndexedDB in ensureSenderIdentity:", err);
    }

    // 2. Fetch registered public key from server
    try {
      const pubRes = await api.get(`/chat/keys/public-key/${sid}`);
      if (pubRes.data?.success && pubRes.data?.data?.publicKey) {
        const serverKey = pubRes.data.data;
        const publicKey = await importPublicKey(serverKey.publicKey);
        this.localCryptoKey = {
          privateKey: null,
          publicKey,
          publicKeySpki: serverKey.publicKey,
          fingerprint: serverKey.fingerprint,
        };
        return this.localCryptoKey;
      }
    } catch {
      // 404
    }

    // 3. Generate new keys if none exist
    try {
      const newKeys = await this.generateAndRegisterNewKeys(sid);
      return this.localCryptoKey;
    } catch (e) {
      console.error("Failed to generate new keys in ensureSenderIdentity:", e);
    }

    throw new Error("Unable to establish cryptographic identity for sender");
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
      if (error.response?.status === 409) {
        console.warn("Public key conflict: Account already has a registered cryptographic identity.", error.response?.data?.message);
      } else {
        console.warn("Public key registration warning:", error.message);
      }
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
    if (!conversationId) throw new Error("conversationId is required for encryption");
    if (!senderId) throw new Error("senderId is required for encryption");
    if (!receiverId) throw new Error("receiverId is required for encryption");
    if (typeof plaintext !== "string" || !plaintext.trim()) {
      throw new Error("Message text must not be empty");
    }

    // Guarantee sender has public key loaded
    await this.ensureSenderIdentity(senderId);

    if (!this.localCryptoKey?.publicKey) {
      throw new Error("Sender cryptographic identity is not initialized");
    }

    // 1. Fetch recipient's public key
    const peerInfo = await this.getPeerPublicKey(receiverId);
    if (!peerInfo?.publicKey) {
      throw new Error("Recipient does not have a registered encryption key");
    }

    // 2. Generate ephemeral 256-bit AES-GCM session key & random 12-byte IV
    const aesKey = await generateMessageKey();
    const iv = generateIV();

    // 3. Define Context Binding AAD: conversationId:senderId:receiverId
    const aadString = `campusx:e2ee:v1:${conversationId}:${senderId}:${receiverId}`;

    // 4. Encrypt message content with AES-256-GCM
    const ciphertext = await encryptMessageContent(plaintext.trim(), aesKey, iv, aadString);

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

    if (!this.localCryptoKey?.privateKey && currentUserId) {
      try {
        const local = await getLocalKeyPair(currentUserId.toString());
        if (local && local.privateKeyPkcs8) {
          const privateKey = await importPrivateKey(local.privateKeyPkcs8);
          const publicKey = local.publicKeySpki ? await importPublicKey(local.publicKeySpki) : this.localCryptoKey?.publicKey;
          const fingerprint = local.fingerprint || (local.publicKeySpki ? await computeKeyFingerprint(local.publicKeySpki) : "");
          this.localCryptoKey = {
            privateKey,
            publicKey: publicKey || this.localCryptoKey?.publicKey,
            publicKeySpki: local.publicKeySpki || this.localCryptoKey?.publicKeySpki,
            fingerprint: fingerprint || this.localCryptoKey?.fingerprint,
          };
        }
      } catch (e) {
        console.warn("Auto-loading private key for decryption failed:", e);
      }
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
   * Backs up the user's private key using their login password (or passphrase)
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async backupWithPassword(password) {
    if (!this.localCryptoKey?.privateKey) {
      throw new Error("No private key loaded to backup");
    }

    const backupPayload = await createPassphraseBackup(
      this.localCryptoKey.privateKey,
      password,
      this.currentUserId || ""
    );
    const res = await api.post("/chat/keys/backup", backupPayload);
    return res.data?.success;
  }

  /**
   * Restores user's private key from server backup using login password
   * @param {string} userId
   * @param {string} password
   * @returns {Promise<{ success: boolean, fingerprint?: string, reason?: string, error?: string }>}
   */
  async restoreWithPassword(userId, password) {
    try {
      const res = await api.get("/chat/keys/backup");
      if (!res.data?.success || !res.data?.data || !res.data?.data?.ciphertext) {
        return { success: false, reason: "NO_BACKUP" };
      }

      const backupData = res.data.data;
      const privateKey = await restorePassphraseBackup(backupData, password, userId);

      // Fetch public key from backend to store complete keypair in IndexedDB
      const pubRes = await api.get(`/chat/keys/public-key/${userId}`);
      const publicKeySpki = pubRes.data?.data?.publicKey;
      const fingerprint = pubRes.data?.data?.fingerprint;

      if (!publicKeySpki) {
        return { success: false, reason: "PUBLIC_KEY_MISSING" };
      }

      const publicKey = await importPublicKey(publicKeySpki);

      // Cryptographically verify restored private key matches registered public key!
      const isMatch = await verifyKeyPairMatch(privateKey, publicKey);
      if (!isMatch) {
        console.error("Cryptographic verification failed: Restored private key does not match registered public key.");
        return { success: false, reason: "KEY_MISMATCH", error: "Restored private key does not match registered public key" };
      }

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

      return { success: true, fingerprint };
    } catch (err) {
      return { success: false, reason: "DECRYPTION_FAILED", error: err.message };
    }
  }

  /**
   * Unlocks the user's private key from remote backup using account login password
   * on devices where IndexedDB was missing or cleared.
   * @param {string} password
   * @returns {Promise<{ success: boolean, fingerprint?: string, error?: string }>}
   */
  async unlockWithPassword(password) {
    if (!this.currentUserId) {
      throw new Error("No user initialized for key unlocking");
    }
    return await this.restoreWithPassword(this.currentUserId, password);
  }

  /**
   * Automatically initializes or recovers user's E2EE identity during login
   * using the provided account login password.
   * 
   * @param {object} user - User profile object ({ _id, name, email })
   * @param {string} password - Account login password (ephemeral, not persisted)
   * @returns {Promise<{ status: string, fingerprint?: string, hasBackup?: boolean, serverFingerprint?: string, restored?: boolean }>}
   */
  async ensureUserKeysWithPassword(user, password) {
    if (!user || !user._id) {
      throw new Error("Valid user object required for E2EE setup");
    }

    const userId = user._id.toString();
    this.currentUserId = userId;

    // 1. Check if user already has keys stored locally in IndexedDB
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

        // Ensure backup exists on server. If missing, silently create one with password
        try {
          const backupCheck = await api.get("/chat/keys/backup");
          if (!backupCheck.data?.success || !backupCheck.data?.data?.ciphertext) {
            if (password) {
              await this.backupWithPassword(password);
            }
          }
        } catch {
          if (password) {
            try {
              await this.backupWithPassword(password);
            } catch (e) {
              console.warn("Silent key backup creation skipped:", e.message);
            }
          }
        }

        return { status: "ready", fingerprint };
      } catch (err) {
        console.error("Failed to load local keys from IndexedDB:", err);
      }
    }

    // 2. No local keys found in IndexedDB. Check if server already has a registered identity
    let serverIdentity = null;
    try {
      const pubRes = await api.get(`/chat/keys/public-key/${userId}`);
      if (pubRes.data?.success && pubRes.data?.data?.publicKey) {
        serverIdentity = pubRes.data.data;
      }
    } catch {
      // 404 means no public key registered
    }

    if (serverIdentity) {
      // Identity exists on server! Attempt automatic restore with login password
      if (password) {
        const restoreRes = await this.restoreWithPassword(userId, password);
        if (restoreRes.success) {
          return {
            status: "ready",
            fingerprint: restoreRes.fingerprint,
            restored: true,
          };
        }
      }

      // Automatic restore failed (corrupted backup or key mismatch)
      return {
        status: "error",
        error: "Failed to decrypt private key backup with login password.",
      };
    }

    // 3. Brand new account: generate RSA key pair, register public key, and back up private key
    const newKeyResult = await this.generateAndRegisterNewKeys(userId);
    if (password) {
      try {
        await this.backupWithPassword(password);
      } catch (e) {
        console.warn("Automatic key backup with password failed:", e.message);
      }
    }

    return {
      status: "ready",
      fingerprint: newKeyResult.fingerprint,
      isNewKey: true,
    };
  }

  /**
   * Re-encrypts the user's private key with their current login password
   * @param {string} newPassword
   * @returns {Promise<boolean>}
   */
  async reencryptBackupWithPassword(newPassword) {
    return await this.backupWithPassword(newPassword);
  }

  /**
   * Backs up the user's private key with a passphrase to the server (legacy method)
   * @param {string} passphrase
   * @returns {Promise<boolean>}
   */
  async backupPrivateKeyWithPassphrase(passphrase) {
    return await this.backupWithPassword(passphrase);
  }

  /**
   * Restores user's private key from server backup using passphrase (legacy method)
   * @param {string} userId
   * @param {string} passphrase
   * @returns {Promise<boolean>}
   */
  async restorePrivateKeyWithPassphrase(userId, passphrase) {
    const res = await this.restoreWithPassword(userId, passphrase);
    if (!res.success) {
      throw new Error(res.error || "Incorrect passphrase or corrupt backup data");
    }
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
