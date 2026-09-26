import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { app, httpServer } from "../server.js";
import User from "../models/User.js";
import PublicKey from "../models/PublicKey.js";

const { subtle } = globalThis.crypto;

// Client WebCrypto simulation matching frontend/src/crypto/webCryptoUtils.js
async function deriveKek(password, salt, iterations = 150000) {
  const enc = new TextEncoder();
  const passKey = await subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return await subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function createBackup(privateKey, password) {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const kek = await deriveKek(password, salt);
  const pkcs8 = await subtle.exportKey("pkcs8", privateKey);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, kek, pkcs8);
  return {
    ciphertext: Buffer.from(ct).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    salt: Buffer.from(salt).toString("base64"),
    iterations: 150000,
  };
}

async function restoreBackup(backup, password) {
  const salt = Buffer.from(backup.salt, "base64");
  const iv = Buffer.from(backup.iv, "base64");
  const ct = Buffer.from(backup.ciphertext, "base64");
  const kek = await deriveKek(password, salt, backup.iterations || 150000);
  const pkcs8 = await subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, kek, ct);
  return await subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt", "unwrapKey"]);
}

async function computeFingerprint(spkiBase64) {
  const hash = await subtle.digest("SHA-256", Buffer.from(spkiBase64, "base64"));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

async function generateKeyPair() {
  const keyPair = await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
  const spki = await subtle.exportKey("spki", keyPair.publicKey);
  const spkiBase64 = Buffer.from(spki).toString("base64");
  const pkcs8 = await subtle.exportKey("pkcs8", keyPair.privateKey);
  const pkcs8Base64 = Buffer.from(pkcs8).toString("base64");
  const fingerprint = await computeFingerprint(spkiBase64);
  return { keyPair, spkiBase64, pkcs8Base64, fingerprint };
}

// Client simulator with account-scoped IndexedDB and in-memory lifecycle
class SimulatedClient {
  constructor(name) {
    this.name = name;
    this.indexedDb = new Map(); // userId -> { publicKeySpki, privateKeyPkcs8, fingerprint }
    this.currentUserId = null;
    this.localCryptoKey = null;
    this.decryptedCache = new Map();
  }

  resetState() {
    this.currentUserId = null;
    this.localCryptoKey = null;
    this.decryptedCache.clear();
  }

  async ensureE2eeInitialized(user, password, apiFetch, token) {
    const userId = user._id.toString();

    // Account isolation: Purge previous user's keys and cache if switching
    if (this.currentUserId && this.currentUserId !== userId) {
      this.resetState();
    }
    this.currentUserId = userId;

    // Check IndexedDB
    const local = this.indexedDb.get(userId);
    if (local) {
      const privateKey = await subtle.importKey(
        "pkcs8",
        Buffer.from(local.privateKeyPkcs8, "base64"),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt", "unwrapKey"]
      );
      const publicKey = await subtle.importKey(
        "spki",
        Buffer.from(local.publicKeySpki, "base64"),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt", "wrapKey"]
      );
      this.localCryptoKey = {
        privateKey,
        publicKey,
        publicKeySpki: local.publicKeySpki,
        fingerprint: local.fingerprint,
      };
      return { status: "ready", fingerprint: local.fingerprint, source: "indexeddb" };
    }

    // Not in IndexedDB. Check server for identity and backup
    const pubRes = await apiFetch(`/api/chat/keys/public-key/${userId}`, token);
    if (pubRes.status === 200 && password) {
      // Identity exists on server! Restore from encrypted server backup
      const backupRes = await apiFetch("/api/chat/keys/backup", token);
      if (backupRes.status === 200 && backupRes.data?.data?.ciphertext) {
        const restoredPrivateKey = await restoreBackup(backupRes.data.data, password);
        const restoredPublicKey = await subtle.importKey(
          "spki",
          Buffer.from(pubRes.data.data.publicKey, "base64"),
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt", "wrapKey"]
        );
        const pkcs8 = await subtle.exportKey("pkcs8", restoredPrivateKey);
        const pkcs8Base64 = Buffer.from(pkcs8).toString("base64");
        const fingerprint = pubRes.data.data.fingerprint;

        // Save to IndexedDB scoped under userId
        this.indexedDb.set(userId, {
          publicKeySpki: pubRes.data.data.publicKey,
          privateKeyPkcs8: pkcs8Base64,
          fingerprint,
        });

        this.localCryptoKey = {
          privateKey: restoredPrivateKey,
          publicKey: restoredPublicKey,
          publicKeySpki: pubRes.data.data.publicKey,
          fingerprint,
        };

        return { status: "ready", fingerprint, source: "server_backup", restored: true };
      }
    }

    // Brand new account: generate and register
    const { keyPair, spkiBase64, pkcs8Base64, fingerprint } = await generateKeyPair();
    this.indexedDb.set(userId, {
      publicKeySpki: spkiBase64,
      privateKeyPkcs8: pkcs8Base64,
      fingerprint,
    });
    this.localCryptoKey = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeySpki: spkiBase64,
      fingerprint,
    };

    // Register on server
    await apiFetch("/api/chat/keys/public-key", token, "POST", {
      publicKey: spkiBase64,
      fingerprint,
      algorithm: "RSA-OAEP-2048",
    });

    // Create encrypted backup with password
    if (password) {
      const backupPayload = await createBackup(keyPair.privateKey, password);
      await apiFetch("/api/chat/keys/backup", token, "POST", backupPayload);
    }

    return { status: "ready", fingerprint, source: "generated", isNewKey: true };
  }
}

describe("CampusX: E2EE Account-Switching & Login-Password Recovery Verification", () => {
  let server;
  let baseUrl;

  const userA = { _id: "67a00000000000000000000a", name: "User A", email: "userA@nitkkr.ac.in" };
  const userB = { _id: "67a00000000000000000000b", name: "User B", email: "userB@nitkkr.ac.in" };
  const passwordA = "PasswordA123!";
  const passwordB = "PasswordB456!";

  let tokenA;
  let tokenB;

  let mockPublicKeys = [];

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "account_switching_e2ee_test_secret_123";

    tokenA = jwt.sign({ userId: userA._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    tokenB = jwt.sign({ userId: userB._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Mock User.findById for auth middleware
    User.findById = (id) => {
      const idStr = id?.toString();
      let found = null;
      if (idStr === userA._id) found = userA;
      else if (idStr === userB._id) found = userB;
      return {
        select: () => Promise.resolve(found),
        then: (fn) => Promise.resolve(found).then(fn),
        catch: (fn) => Promise.resolve(found).catch(fn),
      };
    };

    // Mock PublicKey model methods for hermetic test execution
    PublicKey.findOne = (filter) => {
      const uId = filter?.user?.toString();
      const match = mockPublicKeys.find((k) => k.user?.toString() === uId);

      return {
        lean: () => Promise.resolve(match ? JSON.parse(JSON.stringify(match)) : null),
        then: (fn) => {
          if (!match) return Promise.resolve(null).then(fn);
          const doc = {
            ...match,
            save: async function () {
              const idx = mockPublicKeys.findIndex((k) => k.user?.toString() === uId);
              if (idx !== -1) mockPublicKeys[idx] = { ...this };
              return this;
            },
          };
          return Promise.resolve(doc).then(fn);
        },
      };
    };

    PublicKey.create = async (data) => {
      const record = {
        _id: `pub_${Date.now()}_${Math.random()}`,
        ...data,
        previousFingerprints: data.previousFingerprints || [],
        save: async function () {
          const idx = mockPublicKeys.findIndex((k) => k.user?.toString() === this.user?.toString());
          if (idx !== -1) mockPublicKeys[idx] = { ...this };
          return this;
        },
      };
      mockPublicKeys.push(record);
      return record;
    };

    await new Promise((resolve) => {
      server = httpServer.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    mockPublicKeys = [];
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function apiFetch(path, token, method = "GET", body = null) {
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, opts);
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data };
  }

  let device1;
  let fingerprintA_original;
  let fingerprintB_original;

  it("Scenario 1: User A login on Device 1 -> key created, E2EE initialized & backed up", async () => {
    device1 = new SimulatedClient("Device 1 (Chrome)");
    const resA = await device1.ensureE2eeInitialized(userA, passwordA, apiFetch, tokenA);

    assert.equal(resA.status, "ready");
    assert.equal(resA.isNewKey, true);
    fingerprintA_original = resA.fingerprint;
    assert.ok(fingerprintA_original);
    assert.equal(device1.currentUserId, userA._id);

    // Verify server received encrypted backup
    const backupRes = await apiFetch("/api/chat/keys/backup", tokenA);
    assert.equal(backupRes.status, 200);
    assert.ok(backupRes.data.data.ciphertext);
    assert.ok(backupRes.data.data.salt);
  });

  it("Scenario 2 & 3: User A logout -> User B login on same browser -> User B initializes fresh & creates backup", async () => {
    // User A logs out
    device1.resetState();
    assert.equal(device1.currentUserId, null);
    assert.equal(device1.localCryptoKey, null);

    // User B logs in on Device 1
    const resB = await device1.ensureE2eeInitialized(userB, passwordB, apiFetch, tokenB);
    assert.equal(resB.status, "ready");
    fingerprintB_original = resB.fingerprint;
    assert.ok(fingerprintB_original);
    assert.equal(device1.currentUserId, userB._id);

    // Verify User A and User B fingerprints differ
    console.log(`\n--- FINGERPRINT COMPARISON ---`);
    console.log(`User A Fingerprint: ${fingerprintA_original}`);
    console.log(`User B Fingerprint: ${fingerprintB_original}`);
    assert.notEqual(fingerprintA_original, fingerprintB_original);
  });

  it("Scenario 4: User A and User B exchange encrypted message and decrypt successfully", async () => {
    // User A encrypts message for User B
    const aesKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = new Uint8Array(12);
    globalThis.crypto.getRandomValues(iv);
    const plaintext = "Hello Girish, campus meetup at 4pm!";
    const ct = await subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("aad_test") },
      aesKey,
      new TextEncoder().encode(plaintext)
    );

    // Wrap AES key with User B's public key
    const pubB = await apiFetch(`/api/chat/keys/public-key/${userB._id}`, tokenA);
    const pubBKey = await subtle.importKey(
      "spki",
      Buffer.from(pubB.data.data.publicKey, "base64"),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["wrapKey"]
    );
    const wrappedKeyForB = await subtle.wrapKey("raw", aesKey, pubBKey, { name: "RSA-OAEP" });

    // User B decrypts the wrapped key using their private key on Device 1
    const unwrappedAesKey = await subtle.unwrapKey(
      "raw",
      wrappedKeyForB,
      device1.localCryptoKey.privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const decryptedBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("aad_test") },
      unwrappedAesKey,
      ct
    );
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    assert.equal(decryptedText, plaintext);
  });

  it("Scenario 5 & 6: Logout User B -> login User A again in same browser -> User A original key reused from IndexedDB", async () => {
    device1.resetState();
    const resA = await device1.ensureE2eeInitialized(userA, passwordA, apiFetch, tokenA);
    assert.equal(resA.status, "ready");
    assert.equal(resA.source, "indexeddb");
    assert.equal(resA.fingerprint, fingerprintA_original);
    assert.equal(device1.currentUserId, userA._id);
  });

  it("Scenario 7: Strict account isolation - User A and User B never share private keys", async () => {
    const keyRecordA = device1.indexedDb.get(userA._id);
    const keyRecordB = device1.indexedDb.get(userB._id);
    assert.ok(keyRecordA);
    assert.ok(keyRecordB);
    assert.notEqual(keyRecordA.privateKeyPkcs8, keyRecordB.privateKeyPkcs8);
    assert.notEqual(keyRecordA.fingerprint, keyRecordB.fingerprint);
  });

  it("Scenario 8: Clear IndexedDB -> login User B -> User B original key recovered from encrypted backup", async () => {
    // Simulate user clearing browser data / IndexedDB
    device1.indexedDb.clear();
    device1.resetState();
    assert.equal(device1.indexedDb.size, 0);

    // Login User B with password -> should recover from server backup!
    const resB = await device1.ensureE2eeInitialized(userB, passwordB, apiFetch, tokenB);
    assert.equal(resB.status, "ready");
    assert.equal(resB.restored, true);
    assert.equal(resB.fingerprint, fingerprintB_original);
    console.log(`Device 1 (after IndexedDB wipe) recovered User B fingerprint: ${resB.fingerprint}`);
    assert.equal(resB.fingerprint, fingerprintB_original);
  });

  it("Scenario 9: Login User B on completely different browser/device (Device 2) -> original key recovered", async () => {
    // Brand new device with empty IndexedDB and clean memory
    const device2 = new SimulatedClient("Device 2 (iPhone Safari)");
    assert.equal(device2.indexedDb.size, 0);

    const resB_device2 = await device2.ensureE2eeInitialized(userB, passwordB, apiFetch, tokenB);
    assert.equal(resB_device2.status, "ready");
    assert.equal(resB_device2.restored, true);
    assert.equal(resB_device2.fingerprint, fingerprintB_original);

    console.log(`\n--- CROSS-DEVICE FINGERPRINT VERIFICATION ---`);
    console.log(`User B on Device 1 Fingerprint: ${fingerprintB_original}`);
    console.log(`User B on Device 2 Fingerprint: ${resB_device2.fingerprint}`);
    assert.equal(resB_device2.fingerprint, fingerprintB_original);
  });

  it("Scenario 10: Rapidly switch accounts -> no stale key from previous account is used", async () => {
    const switcherClient = new SimulatedClient("Device 3 (Rapid Switcher)");

    // Switch to User A
    await switcherClient.ensureE2eeInitialized(userA, passwordA, apiFetch, tokenA);
    assert.equal(switcherClient.currentUserId, userA._id);
    assert.equal(switcherClient.localCryptoKey.fingerprint, fingerprintA_original);

    // Rapidly switch to User B
    await switcherClient.ensureE2eeInitialized(userB, passwordB, apiFetch, tokenB);
    assert.equal(switcherClient.currentUserId, userB._id);
    assert.equal(switcherClient.localCryptoKey.fingerprint, fingerprintB_original);

    // Rapidly switch back to User A
    await switcherClient.ensureE2eeInitialized(userA, passwordA, apiFetch, tokenA);
    assert.equal(switcherClient.currentUserId, userA._id);
    assert.equal(switcherClient.localCryptoKey.fingerprint, fingerprintA_original);
  });
});
