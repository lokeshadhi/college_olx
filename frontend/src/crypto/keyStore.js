/**
 * CampusX Client Key Storage
 * Local storage of cryptographic keys in browser IndexedDB (campusx_crypto_db)
 * Private keys NEVER leave the user's browser device in plaintext.
 */

const DB_NAME = "campusx_crypto_db";
const DB_VERSION = 1;
const STORE_NAME = "user_keys";

/**
 * Opens and initializes the IndexedDB key store
 * @returns {Promise<IDBDatabase>}
 */
const openKeyDatabase = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB: ${event.target.error?.message}`));
    };
  });
};

/**
 * Saves a user's cryptographic keys and fingerprint to IndexedDB
 * @param {string} userId
 * @param {{ publicKeySpki: string, privateKeyPkcs8: string, fingerprint: string }} keys
 * @returns {Promise<boolean>}
 */
export const saveLocalKeyPair = async (userId, { publicKeySpki, privateKeyPkcs8, fingerprint }) => {
  if (!userId) throw new Error("userId is required to save keys");
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      userId: userId.toString(),
      publicKeySpki,
      privateKeyPkcs8,
      fingerprint,
      updatedAt: new Date().toISOString(),
    };

    const request = store.put(record);

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(new Error(`Failed to save keys: ${e.target.error?.message}`));
  });
};

/**
 * Retrieves the user's cryptographic key pair from IndexedDB
 * @param {string} userId
 * @returns {Promise<{ publicKeySpki: string, privateKeyPkcs8: string, fingerprint: string } | null>}
 */
export const getLocalKeyPair = async (userId) => {
  if (!userId) return null;
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(userId.toString());

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve({
          publicKeySpki: result.publicKeySpki,
          privateKeyPkcs8: result.privateKeyPkcs8,
          fingerprint: result.fingerprint,
        });
      } else {
        resolve(null);
      }
    };

    request.onerror = (e) => reject(new Error(`Failed to fetch keys: ${e.target.error?.message}`));
  });
};

/**
 * Clears keys for a specific user from IndexedDB (e.g. on manual logout or key reset)
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export const clearLocalKeyPair = async (userId) => {
  if (!userId) return false;
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(userId.toString());

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(new Error(`Failed to delete keys: ${e.target.error?.message}`));
  });
};

/**
 * Lists all stored user IDs in IndexedDB (for diagnostic & account-isolation verification)
 * @returns {Promise<string[]>}
 */
export const getAllStoredUserIds = async () => {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  try {
    const db = await openKeyDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve((request.result || []).map(String));
      request.onerror = (e) => reject(new Error(`Failed to list keys: ${e.target.error?.message}`));
    });
  } catch {
    return [];
  }
};

