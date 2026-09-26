import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { app, httpServer } from "../server.js";
import User from "../models/User.js";
import PublicKey from "../models/PublicKey.js";

const { subtle } = globalThis.crypto;

// Helper: Derive AES-256-GCM KEK using PBKDF2
async function deriveKek(password, salt, iterations = 150000) {
  const enc = new TextEncoder();
  const passKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return await subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Helper: Create AAD-bound backup matching webCryptoUtils.js
async function createAadBackup(privateKey, password, userId = "") {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const kek = await deriveKek(password, salt);
  const pkcs8 = await subtle.exportKey("pkcs8", privateKey);

  const enc = new TextEncoder();
  const aad = enc.encode(`campusx:e2ee:key-backup:v1:${userId}`);

  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    kek,
    pkcs8
  );

  return {
    version: 1,
    ciphertext: Buffer.from(ct).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    salt: Buffer.from(salt).toString("base64"),
    iterations: 150000,
  };
}

// Helper: Restore AAD-bound backup with legacy fallback
async function restoreAadBackup(backup, password, userId = "") {
  const salt = Buffer.from(backup.salt, "base64");
  const iv = Buffer.from(backup.iv, "base64");
  const ct = Buffer.from(backup.ciphertext, "base64");
  const kek = await deriveKek(password, salt, backup.iterations || 150000);

  const enc = new TextEncoder();
  const aad = enc.encode(`campusx:e2ee:key-backup:v1:${userId}`);

  let pkcs8;
  try {
    pkcs8 = await subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
      kek,
      ct
    );
  } catch (err) {
    // Fallback to non-AAD legacy
    pkcs8 = await subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      kek,
      ct
    );
  }

  return await subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt", "unwrapKey"]
  );
}

// Helper: Verify key pair consistency by test session key wrap/unwrap
async function verifyKeyPairMatch(privateKey, publicKey) {
  try {
    const testKey = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const wrapped = await subtle.wrapKey("raw", testKey, publicKey, { name: "RSA-OAEP" });
    const unwrapped = await subtle.unwrapKey(
      "raw",
      wrapped,
      privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    return !!unwrapped;
  } catch {
    return false;
  }
}

// Helper: Compute public key fingerprint
async function computeFingerprint(spkiBase64) {
  const hash = await subtle.digest("SHA-256", Buffer.from(spkiBase64, "base64"));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

// Helper: Generate RSA-OAEP key pair
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

describe("CampusX Finalized E2EE Architecture Verification Suite", () => {
  let port;
  let testUser;
  let authToken;
  let mockPublicKeys = [];
  let registeredKeyPair;

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "e2ee_final_test_jwt_secret_key_123456789";

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });

    testUser = {
      _id: "67e000000000000000000001",
      name: "E2EE Final Test User",
      email: "e2ee_final@nitkkr.ac.in",
      collegeId: "120099",
      year: "2nd Year",
      department: "Computer Applications",
      phone: "9876543210",
      isEmailVerified: true,
    };

    authToken = jwt.sign(
      { userId: testUser._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Mock User.findById for protect middleware
    User.findById = (id) => {
      const idStr = id?.toString();
      const found = idStr === testUser._id ? testUser : null;
      return {
        select: () => Promise.resolve(found),
        then: (fn) => Promise.resolve(found).then(fn),
        catch: (fn) => Promise.resolve(found).catch(fn),
      };
    };

    // Mock PublicKey methods
    PublicKey.findOne = (filter) => {
      const uId = filter?.user?.toString();
      const match = mockPublicKeys.find((k) => k.user?.toString() === uId);

      return {
        lean: () => Promise.resolve(match || null),
        then: (fn) => Promise.resolve(match || null).then(fn),
        save: async function () { return this; },
      };
    };

    PublicKey.create = async (data) => {
      const record = {
        _id: `pub_${Date.now()}`,
        ...data,
        previousFingerprints: data.previousFingerprints || [],
        save: async function () {
          const idx = mockPublicKeys.findIndex((k) => k.user?.toString() === this.user?.toString());
          if (idx !== -1) mockPublicKeys[idx] = this;
          else mockPublicKeys.push(this);
          return this;
        },
      };
      mockPublicKeys.push(record);
      return record;
    };
  });

  after(async () => {
    mockPublicKeys = [];
    httpServer.close();
  });

  it("1. Single Identity: Registers initial RSA-OAEP public key idempotently and rejects rogue identity changes", async () => {
    registeredKeyPair = await generateKeyPair();
    const { keyPair, spkiBase64, fingerprint } = registeredKeyPair;

    // Initial registration
    const res = await fetch(`http://localhost:${port}/api/chat/keys/public-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        publicKey: spkiBase64,
        fingerprint,
        algorithm: "RSA-OAEP-2048",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.fingerprint, fingerprint);

    // Idempotent re-registration of SAME identity must succeed with 200
    const resIdempotent = await fetch(`http://localhost:${port}/api/chat/keys/public-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        publicKey: spkiBase64,
        fingerprint,
      }),
    });
    assert.equal(resIdempotent.status, 200);

    // Rogue registration with a DIFFERENT key pair must be rejected with 409 IDENTITY_ALREADY_EXISTS
    const rogueKeys = await generateKeyPair();
    const resConflict = await fetch(`http://localhost:${port}/api/chat/keys/public-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        publicKey: rogueKeys.spkiBase64,
        fingerprint: rogueKeys.fingerprint,
      }),
    });
    assert.equal(resConflict.status, 409);
    const conflictBody = await resConflict.json();
    assert.equal(conflictBody.code, "IDENTITY_ALREADY_EXISTS");
  });

  it("2. Versioned AAD-Bound Backup: Stores and retrieves backup with context-bound AAD", async () => {
    const userId = testUser._id.toString();
    const password = "TestPassword123!";

    const backupPayload = await createAadBackup(registeredKeyPair.keyPair.privateKey, password, userId);
    assert.equal(backupPayload.version, 1);
    assert.ok(backupPayload.ciphertext);
    assert.ok(backupPayload.iv);
    assert.ok(backupPayload.salt);

    // Store backup
    const postRes = await fetch(`http://localhost:${port}/api/chat/keys/backup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(backupPayload),
    });
    assert.equal(postRes.status, 200);

    // Retrieve backup
    const getRes = await fetch(`http://localhost:${port}/api/chat/keys/backup`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.success, true);
    assert.equal(getBody.data.version, 1);
    assert.equal(getBody.data.ciphertext, backupPayload.ciphertext);
  });

  it("3. Multi-Device Restoration: Simulates Device B with missing IndexedDB restoring private key", async () => {
    const userId = testUser._id.toString();
    const password = "TestPassword123!";

    // 1. Fetch backup from server (as Device B would)
    const getRes = await fetch(`http://localhost:${port}/api/chat/keys/backup`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const { data: backupData } = await getRes.json();

    // 2. Restore private key using login password and context-bound AAD
    const restoredPrivateKey = await restoreAadBackup(backupData, password, userId);
    assert.ok(restoredPrivateKey);

    // 3. Fetch registered public key from server
    const pubRes = await fetch(`http://localhost:${port}/api/chat/keys/public-key/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const pubBody = await pubRes.json();
    const pubKey = await subtle.importKey(
      "spki",
      Buffer.from(pubBody.data.publicKey, "base64"),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt", "wrapKey"]
    );

    // 4. Verify cryptographic consistency
    const isConsistent = await verifyKeyPairMatch(restoredPrivateKey, pubKey);
    assert.equal(isConsistent, true, "Restored private key must match registered public key");
  });

  it("4. Integrity & Security: Wrong password or tampered ciphertext fails decryption", async () => {
    const userId = testUser._id.toString();
    const getRes = await fetch(`http://localhost:${port}/api/chat/keys/backup`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const { data: backupData } = await getRes.json();

    // Wrong password must throw
    await assert.rejects(async () => {
      await restoreAadBackup(backupData, "WrongPassword999!", userId);
    });

    // Tampered ciphertext must throw
    const tampered = { ...backupData, ciphertext: "AAAA" + backupData.ciphertext.slice(4) };
    await assert.rejects(async () => {
      await restoreAadBackup(tampered, "TestPassword123!", userId);
    });
  });

  it("5. End-to-End Cryptographic Message Encryption & Decryption between Restored Devices", async () => {
    const userId = testUser._id.toString();
    const password = "TestPassword123!";

    // 1. Device A: Encrypts a message
    const pubRes = await fetch(`http://localhost:${port}/api/chat/keys/public-key/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const pubBody = await pubRes.json();
    const pubKey = await subtle.importKey(
      "spki",
      Buffer.from(pubBody.data.publicKey, "base64"),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt", "wrapKey"]
    );

    const plaintext = "Confidential campus transaction details #1234";
    const sessionKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = new Uint8Array(12);
    globalThis.crypto.getRandomValues(iv);

    const convId = "conv_test_final";
    const senderId = userId;
    const receiverId = userId;
    const aadString = `campusx:e2ee:v1:${convId}:${senderId}:${receiverId}`;
    const enc = new TextEncoder();

    const ciphertextBuffer = await subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(aadString), tagLength: 128 },
      sessionKey,
      enc.encode(plaintext)
    );

    const wrappedKeyBuffer = await subtle.wrapKey("raw", sessionKey, pubKey, { name: "RSA-OAEP" });

    const messagePayload = {
      ciphertext: Buffer.from(ciphertextBuffer).toString("base64"),
      iv: Buffer.from(iv).toString("base64"),
      encryptedKey: Buffer.from(wrappedKeyBuffer).toString("base64"),
    };

    // 2. Device B (restored from server backup): Decrypts the message
    const getRes = await fetch(`http://localhost:${port}/api/chat/keys/backup`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const { data: backupData } = await getRes.json();
    const deviceBPrivateKey = await restoreAadBackup(backupData, password, userId);

    const unwrappedSessionKey = await subtle.unwrapKey(
      "raw",
      Buffer.from(messagePayload.encryptedKey, "base64"),
      deviceBPrivateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );

    const decryptedBuffer = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(messagePayload.iv, "base64"),
        additionalData: enc.encode(aadString),
        tagLength: 128,
      },
      unwrappedSessionKey,
      Buffer.from(messagePayload.ciphertext, "base64")
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    assert.equal(decryptedText, plaintext);
  });
});
