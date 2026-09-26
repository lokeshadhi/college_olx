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
    this.initPromise = null;
    this.initPromiseUserId = null;
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
   * Delegates to authoritative ensureE2eeInitialized flow.
   * 
   * @param {object} user - Logged in user object ({ _id, name, email })
   * @returns {Promise<{ status: string, fingerprint?: string }>}
   */
  async initUserKeys(user) {
    return this.ensureE2eeInitialized(user);
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

    // Await any active key initialization if one is currently in-flight
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch {}
    }

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

    // Verify account matching to prevent cross-account key leakage
    const myId = currentUserId?.toString();
    if (this.currentUserId && myId && this.currentUserId !== myId) {
      return {
        decryptedText: "🔒 [Encrypted Message - Private key belongs to another user]",
        isEncrypted: true,
        error: "ACCOUNT_MISMATCH",
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
   * Backs up the user's private key using their login password (or passphrase)
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async backupWithPassword(password) {
    if (!this.localCryptoKey?.privateKey) {
      throw new Error("No private key loaded to backup");
    }

    const backupPayload = await createPassphraseBackup(this.localCryptoKey.privateKey, password);
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
      let backupData = null;
      try {
        const res = await api.get("/chat/keys/backup");
        if (res.data?.success && res.data?.data?.ciphertext) {
          backupData = res.data.data;
        }
      } catch (err) {
        return { success: false, reason: "NO_BACKUP", error: err.message };
      }

      if (!backupData || !backupData.ciphertext || !backupData.iv || !backupData.salt) {
        return { success: false, reason: "NO_BACKUP" };
      }

      const privateKey = await restorePassphraseBackup(backupData, password);

      // Fetch public key from backend to store complete keypair in IndexedDB
      const pubRes = await api.get(`/chat/keys/public-key/${userId}`);
      const publicKeySpki = pubRes.data?.data?.publicKey;
      const fingerprint = pubRes.data?.data?.fingerprint;

      if (!publicKeySpki) {
        return { success: false, reason: "PUBLIC_KEY_MISSING" };
      }

      const publicKey = await importPublicKey(publicKeySpki);
      const privateKeyPkcs8 = await exportPrivateKey(privateKey);

      // Save to IndexedDB strictly scoped to userId
      await saveLocalKeyPair(userId, {
        publicKeySpki,
        privateKeyPkcs8,
        fingerprint,
      });

      this.currentUserId = userId.toString();
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
   * Authoritative single E2EE initialization & key recovery flow.
   * - Scopes in-memory keys strictly to user._id (clears prior account keys if switching accounts)
   * - Uses in-memory single-flight promise to prevent concurrent race conditions
   * - Loads local key from IndexedDB if present
   * - If not present and password provided: automatically downloads encrypted backup,
   *   derives KEK via PBKDF2 with login password, decrypts AES-GCM payload, and restores
   *   the user's ORIGINAL private key into IndexedDB
   * - If key is in IndexedDB but missing server backup, uploads encrypted backup
   * - Logs fingerprint for verification
   * 
   * @param {object} user - User profile object ({ _id, name, email })
   * @param {string} [optionalPassword] - Ephemeral login password in memory
   * @returns {Promise<{ status: string, fingerprint?: string, hasBackup?: boolean, serverFingerprint?: string, restored?: boolean, isNewKey?: boolean, error?: string }>}
   */
  async ensureE2eeInitialized(user, optionalPassword = null) {
    if (!user || (!user._id && !user.id)) {
      throw new Error("Valid user object required for E2EE setup");
    }

    const userId = (user._id || user.id).toString();

    // 1. Account isolation guard: if another account's keys are in memory, purge immediately
    if (this.currentUserId && this.currentUserId !== userId) {
      console.log(`[E2EE] Switching account from ${this.currentUserId} to ${userId}. Purging previous user's in-memory keys and cache.`);
      this.resetState();
    }
    this.currentUserId = userId;

    // 2. Return active initialization promise if one is already in flight for this exact user
    if (this.initPromise && this.initPromiseUserId === userId) {
      return this.initPromise;
    }

    this.initPromiseUserId = userId;
    this.initPromise = (async () => {
      try {
        // If keys for this user are already active in memory, return ready
        if (
          this.localCryptoKey?.privateKey &&
          this.localCryptoKey?.fingerprint &&
          this.currentUserId === userId
        ) {
          console.log(`[E2EE-FINGERPRINT] Account: ${user.name || user.email} (${userId}) | Fingerprint: ${this.localCryptoKey.fingerprint} (In-Memory)`);
          return { status: "ready", fingerprint: this.localCryptoKey.fingerprint };
        }

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

            console.log(`[E2EE-FINGERPRINT] Account: ${user.name || user.email} (${userId}) | Fingerprint: ${fingerprint} (IndexedDB)`);

            // Ensure backend has current public key registered
            await this.syncPublicKeyWithBackend(local.publicKeySpki, fingerprint);

            // Ensure backup exists on server. If missing and password provided, create one
            if (optionalPassword) {
              try {
                const backupCheck = await api.get("/chat/keys/backup");
                if (!backupCheck.data?.success || !backupCheck.data?.data?.ciphertext) {
                  await this.backupWithPassword(optionalPassword);
                  console.log(`[E2EE] Created missing server backup for ${userId}`);
                }
              } catch {
                try {
                  await this.backupWithPassword(optionalPassword);
                  console.log(`[E2EE] Created missing server backup for ${userId}`);
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
          if (optionalPassword) {
            const restoreRes = await this.restoreWithPassword(userId, optionalPassword);
            if (restoreRes.success) {
              console.log(`[E2EE-RECOVERY] Successfully recovered ORIGINAL private key for ${userId}. Fingerprint: ${restoreRes.fingerprint}`);
              console.log(`[E2EE-FINGERPRINT] Account: ${user.name || user.email} (${userId}) | Fingerprint: ${restoreRes.fingerprint} (Recovered from Backup)`);
              return {
                status: "ready",
                fingerprint: restoreRes.fingerprint,
                restored: true,
              };
            }
            console.error(`[E2EE] Failed to restore private key with password: ${restoreRes.error || restoreRes.reason}`);
          }

          // Private key missing on this device and cannot be restored without password
          return {
            status: "missing_local_keys",
            error: "Private key not found on this device. Login with password to restore keys.",
          };
        }

        // 3. Brand new account: generate RSA key pair, register public key, and back up private key
        const newKeyResult = await this.generateAndRegisterNewKeys(userId);
        console.log(`[E2EE-FINGERPRINT] Account: ${user.name || user.email} (${userId}) | Fingerprint: ${newKeyResult.fingerprint} (Generated New Keypair)`);

        if (optionalPassword) {
          try {
            await this.backupWithPassword(optionalPassword);
            console.log(`[E2EE] Encrypted backup created for new user ${userId}`);
          } catch (e) {
            console.warn("Automatic key backup with password failed:", e.message);
          }
        }

        return {
          status: "ready",
          fingerprint: newKeyResult.fingerprint,
          isNewKey: true,
        };
      } finally {
        this.initPromise = null;
        this.initPromiseUserId = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Compatibility alias for ensureE2eeInitialized with password
   */
  async ensureUserKeysWithPassword(user, password) {
    return this.ensureE2eeInitialized(user, password);
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
   * Clears all sensitive local state, in-memory keys, and caches (e.g. on logout or account switch)
   */
  resetState() {
    this.currentUserId = null;
    this.localCryptoKey = null;
    this.peerKeyCache.clear();
    this.decryptedCache.clear();
    this.initPromise = null;
    this.initPromiseUserId = null;
  }
}

// Export singleton instance
export const e2eeService = new E2EEService();
export default e2eeService;
