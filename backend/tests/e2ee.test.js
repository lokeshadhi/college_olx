import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { io as ioClient } from "socket.io-client";
import { app, httpServer } from "../server.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Block from "../models/Block.js";
import PublicKey from "../models/PublicKey.js";

describe("CampusX Phase 2: End-to-End Encryption (E2EE) & Public Key Registry Test Suite", () => {
  let server;
  let baseUrl;
  let socketUrl;

  const mockAlice = {
    _id: "66e01234567890abcdef0101",
    name: "Alice Johnson",
    email: "alice@college.edu",
    department: "Computer Science",
  };

  const mockBob = {
    _id: "66e01234567890abcdef0102",
    name: "Bob Williams",
    email: "bob@college.edu",
    department: "Electronics",
  };

  const mockEve = {
    _id: "66e01234567890abcdef0103",
    name: "Eve Attacker",
    email: "eve@college.edu",
    department: "Mechanical",
  };

  const mockProduct = {
    _id: "66e01234567890abcdef0199",
    title: "Engineering Mechanics Textbook",
    price: 450,
    owner: mockBob._id,
  };

  const mockConversationId = "66e01234567890abcdef0299";

  let aliceToken;
  let bobToken;
  let eveToken;
  let mockPublicKeys = [];
  let mockMessages = [];
  let mockBlocks = [];

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "e2ee_test_jwt_secret_key_123456789";

    aliceToken = jwt.sign({ userId: mockAlice._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    bobToken = jwt.sign({ userId: mockBob._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    eveToken = jwt.sign({ userId: mockEve._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Mock User.findById
    User.findById = (id) => {
      const idStr = id?.toString();
      let found = null;
      if (idStr === mockAlice._id) found = mockAlice;
      else if (idStr === mockBob._id) found = mockBob;
      else if (idStr === mockEve._id) found = mockEve;

      return {
        select: () => Promise.resolve(found),
        then: (fn) => Promise.resolve(found).then(fn),
        catch: (fn) => Promise.resolve(found).catch(fn),
      };
    };

    // Mock Block.isBlocked
    Block.isBlocked = async (user1Id, user2Id) => {
      const u1 = user1Id?.toString();
      const u2 = user2Id?.toString();
      return mockBlocks.some(
        (b) =>
          (b.blocker === u1 && b.blocked === u2) ||
          (b.blocker === u2 && b.blocked === u1)
      );
    };

    // Mock Conversation.findById
    Conversation.findById = async (id) => {
      if (id?.toString() === mockConversationId) {
        return {
          _id: mockConversationId,
          participants: [mockAlice._id, mockBob._id],
          product: mockProduct._id,
          lastMessageContent: "",
          save: async function () { return this; },
        };
      }
      return null;
    };

    // Mock Conversation.findByIdAndUpdate
    Conversation.findByIdAndUpdate = async (id, update) => {
      return { _id: id, ...update };
    };

    // Mock Message.create
    Message.create = async (data) => {
      const created = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMessages.push(created);
      return created;
    };

    // Mock Message.findById
    Message.findById = (id) => {
      const found = mockMessages.find((m) => m._id === id?.toString());
      return {
        populate: () => ({
          lean: () => Promise.resolve(found ? { ...found, sender: mockAlice } : null),
        }),
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
          return this;
        },
      };
      mockPublicKeys.push(record);
      return record;
    };

    // Start ephemeral HTTP & Socket server
    server = httpServer.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    socketUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    if (server) server.close();
  });

  beforeEach(() => {
    mockPublicKeys = [];
    mockMessages = [];
    mockBlocks = [];
  });

  // ==========================================================
  // 1. PUBLIC KEY REGISTRY & ROTATION
  // ==========================================================
  describe("1. Public Key Registry & Rotation", () => {
    it("should register a user's RSA-OAEP public key and SHA-256 fingerprint", async () => {
      const res = await fetch(`${baseUrl}/api/chat/keys/public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0mockKeyAlice...",
          fingerprint: "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
          algorithm: "RSA-OAEP-2048",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.fingerprint, "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99");
      assert.equal(body.data.keyVersion, 1);
    });

    it("should reject registration with missing public key or fingerprint", async () => {
      const res = await fetch(`${baseUrl}/api/chat/keys/public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          publicKey: "",
          fingerprint: "",
        }),
      });

      assert.equal(res.status, 400);
    });

    it("should allow idempotent re-registration of the same public key and fingerprint", async () => {
      // Initial registration
      await fetch(`${baseUrl}/api/chat/keys/public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          publicKey: "INITIAL_KEY_ALICE",
          fingerprint: "11:11:11:11:11:11:11:11",
        }),
      });

      // Idempotent re-registration
      const res = await fetch(`${baseUrl}/api/chat/keys/public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          publicKey: "INITIAL_KEY_ALICE",
          fingerprint: "11:11:11:11:11:11:11:11",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.fingerprint, "11:11:11:11:11:11:11:11");
    });

    it("should reject conflicting public key registration (single cryptographic identity invariance)", async () => {
      // 1. Register initial key
      await fetch(`${baseUrl}/api/chat/keys/public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          publicKey: "INITIAL_KEY_ALICE",
          fingerprint: "11:11:11:11:11:11:11:11",
        }),
      });

      // 2. Attempt to register conflicting key
      const conflictRes = await fetch(`${baseUrl}/api/chat/keys/public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          publicKey: "CONFLICTING_KEY_ALICE_PHONE",
          fingerprint: "22:22:22:22:22:22:22:22",
        }),
      });

      const body = await conflictRes.json();
      assert.equal(conflictRes.status, 409);
      assert.equal(body.success, false);
      assert.equal(body.code, "IDENTITY_ALREADY_EXISTS");

      // Verify the original key remains unchanged
      const checkRes = await fetch(`${baseUrl}/api/chat/keys/public-key/${mockAlice._id}`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      const checkBody = await checkRes.json();
      assert.equal(checkBody.data.fingerprint, "11:11:11:11:11:11:11:11");
    });

    it("should allow any authenticated user to retrieve a peer's public key", async () => {
      mockPublicKeys.push({
        user: mockBob._id,
        publicKey: "BOB_PUBLIC_KEY_SPKI",
        fingerprint: "BB:BB:BB:BB:BB:BB:BB:BB",
        keyVersion: 1,
        algorithm: "RSA-OAEP-2048",
      });

      const res = await fetch(`${baseUrl}/api/chat/keys/public-key/${mockBob._id}`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.publicKey, "BOB_PUBLIC_KEY_SPKI");
      assert.equal(body.data.fingerprint, "BB:BB:BB:BB:BB:BB:BB:BB");
    });

    it("should return 404 when requested peer has no registered public key", async () => {
      const res = await fetch(`${baseUrl}/api/chat/keys/public-key/${mockEve._id}`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });

      assert.equal(res.status, 404);
    });
  });

  // ==========================================================
  // 2. ENCRYPTED PASSPHRASE KEY BACKUP & RECOVERY
  // ==========================================================
  describe("2. Passphrase Key Backup & Recovery Endpoints", () => {
    it("should allow a user to store their PBKDF2-encrypted private key backup", async () => {
      const res = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          ciphertext: "ENCRYPTED_PKCS8_CIPHERTEXT",
          iv: "RANDOM_IV_12_BYTES",
          salt: "RANDOM_SALT_16_BYTES",
          iterations: 150000,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
    });

    it("should allow user to retrieve their stored encrypted backup", async () => {
      mockPublicKeys.push({
        user: mockAlice._id,
        publicKey: "ALICE_PUB_KEY",
        fingerprint: "AA:AA:AA:AA",
        encryptedBackup: {
          ciphertext: "ENCRYPTED_PKCS8_BLOB",
          iv: "BASE64_IV",
          salt: "BASE64_SALT",
          iterations: 150000,
        },
      });

      const res = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.ciphertext, "ENCRYPTED_PKCS8_BLOB");
      assert.equal(body.data.iterations, 150000);
    });

    it("should reject backup submission if required crypto parameters are missing", async () => {
      const res = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          ciphertext: "SOME_CIPHERTEXT",
          // missing iv and salt
        }),
      });

      assert.equal(res.status, 400);
    });
  });

  // ==========================================================
  // 3. E2EE MESSAGE PERSISTENCE & REST ENDPOINT
  // ==========================================================
  describe("3. E2EE Message Transmission via REST API", () => {
    it("should accept and persist E2EE message without exposing plaintext content", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations/${mockConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          messageType: "text",
          encryptionVersion: 1,
          ciphertext: "dGhpcyBpcyBhbiBlbmNyeXB0ZWQgY2lwaGVydGV4dAo=",
          iv: "MTIzNDU2Nzg5MDEy",
          encryptedKey: "d3JhcHBlZF9hZXNfa2V5X2Zvcl9ib2IK",
          senderEncryptedKey: "d3JhcHBlZF9hZXNfa2V5X2Zvcl9hbGljZQo=",
          keyFingerprint: "BB:BB:BB:BB:BB:BB:BB:BB",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.encryptionVersion, 1);
      assert.equal(body.data.content, ""); // Server stores empty string for content
      assert.equal(body.data.ciphertext, "dGhpcyBpcyBhbiBlbmNyeXB0ZWQgY2lwaGVydGV4dAo=");
      assert.equal(body.data.encryptedKey, "d3JhcHBlZF9hZXNfa2V5X2Zvcl9ib2IK");
      assert.equal(body.data.senderEncryptedKey, "d3JhcHBlZF9hZXNfa2V5X2Zvcl9hbGljZQo=");
    });

    it("should reject encrypted message if ciphertext or IV is missing", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations/${mockConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          encryptionVersion: 1,
          ciphertext: "",
          iv: "",
        }),
      });

      assert.equal(res.status, 400);
    });

    it("should reject encrypted message from unauthorized non-participant", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations/${mockConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${eveToken}`,
        },
        body: JSON.stringify({
          encryptionVersion: 1,
          ciphertext: "EVE_CIPHERTEXT",
          iv: "EVE_IV",
          encryptedKey: "EVE_KEY",
        }),
      });

      assert.equal(res.status, 403);
    });

    it("should maintain backward compatibility for legacy plaintext messages (version 0)", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations/${mockConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          content: "Hello Bob, this is a legacy plaintext message",
          messageType: "text",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.data.encryptionVersion, 0);
      assert.equal(body.data.content, "Hello Bob, this is a legacy plaintext message");
    });
  });

  // ==========================================================
  // 4. REAL-TIME E2EE SOCKET.IO TRANSMISSION
  // ==========================================================
  describe("4. Real-time E2EE Socket.IO Message Flow", () => {
    let aliceClient;
    let bobClient;

    before((t, done) => {
      aliceClient = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: aliceToken },
      });

      bobClient = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: bobToken },
      });

      let connected = 0;
      const onConnect = () => {
        connected++;
        if (connected === 2) done();
      };

      aliceClient.on("connect", onConnect);
      bobClient.on("connect", onConnect);
    });

    after(() => {
      if (aliceClient) aliceClient.disconnect();
      if (bobClient) bobClient.disconnect();
    });

    it("should route encrypted message payload with wrapped keys to recipient over Socket.IO", (t, done) => {
      bobClient.emit("join_conversation", { conversationId: mockConversationId }, () => {
        bobClient.once("new_message", (receivedMsg) => {
          try {
            assert.equal(receivedMsg.encryptionVersion, 1);
            assert.equal(receivedMsg.ciphertext, "U29ja2V0RW5jcnlwdGVkUGF5bG9hZA==");
            assert.equal(receivedMsg.iv, "U29ja2V0SVYxMkJ5dGVz");
            assert.equal(receivedMsg.encryptedKey, "UmVjaXBpZW50V3JhcHBlZEtleQ==");
            assert.equal(receivedMsg.senderEncryptedKey, "U2VuZGVyV3JhcHBlZEtleQ==");
            assert.equal(receivedMsg.content, ""); // No plaintext exposed
            done();
          } catch (err) {
            done(err);
          }
        });

        // Alice sends encrypted message
        aliceClient.emit(
          "send_message",
          {
            conversationId: mockConversationId,
            encryptionVersion: 1,
            ciphertext: "U29ja2V0RW5jcnlwdGVkUGF5bG9hZA==",
            iv: "U29ja2V0SVYxMkJ5dGVz",
            encryptedKey: "UmVjaXBpZW50V3JhcHBlZEtleQ==",
            senderEncryptedKey: "U2VuZGVyV3JhcHBlZEtleQ==",
            keyFingerprint: "BB:BB:BB:BB:BB:BB:BB:BB",
          },
          (ack) => {
            assert.equal(ack.success, true);
          }
        );
      });
    });

    it("should reject encrypted message missing ciphertext via Socket.IO", (t, done) => {
      aliceClient.emit(
        "send_message",
        {
          conversationId: mockConversationId,
          encryptionVersion: 1,
          ciphertext: "",
          iv: "some_iv",
          encryptedKey: "some_key",
        },
        (ack) => {
          try {
            assert.equal(ack.success, false);
            assert.equal(ack.error, "Ciphertext required");
            done();
          } catch (err) {
            done(err);
          }
        }
      );
    });
  });

  // ==========================================================
  // 5. CRYPTOGRAPHIC INTEGRITY & TAMPER REJECTION (WEB CRYPTO)
  // ==========================================================
  describe("5. Cryptographic Integrity & Tamper Rejection Verification", () => {
    it("should successfully encrypt and decrypt with AES-256-GCM and contextual AAD binding", async () => {
      const subtle = globalThis.crypto.subtle;

      // 1. Generate 256-bit AES-GCM session key
      const key = await subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const iv = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv);

      const plaintext = "Confidential negotiation between students";
      const aad = `campusx:e2ee:v1:${mockConversationId}:${mockAlice._id}:${mockBob._id}`;

      const encoder = new TextEncoder();
      const ciphertext = await subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: encoder.encode(aad),
          tagLength: 128,
        },
        key,
        encoder.encode(plaintext)
      );

      // Decrypt with exact matching AAD
      const decryptedBuffer = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: encoder.encode(aad),
          tagLength: 128,
        },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      assert.equal(decoder.decode(decryptedBuffer), plaintext);
    });

    it("should reject decryption if ciphertext has been tampered with (GCM authentication failure)", async () => {
      const subtle = globalThis.crypto.subtle;

      const key = await subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const iv = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv);

      const plaintext = "Original untouched message";
      const aad = `campusx:e2ee:v1:${mockConversationId}:${mockAlice._id}:${mockBob._id}`;
      const encoder = new TextEncoder();

      const ciphertextBuffer = await subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: encoder.encode(aad),
          tagLength: 128,
        },
        key,
        encoder.encode(plaintext)
      );

      // Tamper with 1 byte in the ciphertext payload
      const tamperedBytes = new Uint8Array(ciphertextBuffer);
      tamperedBytes[2] = tamperedBytes[2] ^ 0xff; // Flip bits

      await assert.rejects(
        async () => {
          await subtle.decrypt(
            {
              name: "AES-GCM",
              iv,
              additionalData: encoder.encode(aad),
              tagLength: 128,
            },
            key,
            tamperedBytes
          );
        },
        /OperationError/
      );
    });

    it("should reject decryption if AAD context binding differs (replay / context splicing defense)", async () => {
      const subtle = globalThis.crypto.subtle;

      const key = await subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const iv = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv);

      const plaintext = "Valid message for conversation A";
      const aadOriginal = `campusx:e2ee:v1:conv_alpha:${mockAlice._id}:${mockBob._id}`;
      const encoder = new TextEncoder();

      const ciphertextBuffer = await subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: encoder.encode(aadOriginal),
          tagLength: 128,
        },
        key,
        encoder.encode(plaintext)
      );

      // Attempt to replay in conversation B or with modified recipient
      const aadTampered = `campusx:e2ee:v1:conv_beta:${mockAlice._id}:${mockBob._id}`;

      await assert.rejects(
        async () => {
          await subtle.decrypt(
            {
              name: "AES-GCM",
              iv,
              additionalData: encoder.encode(aadTampered),
              tagLength: 128,
            },
            key,
            ciphertextBuffer
          );
        },
        /OperationError/
      );
    });
  });

  // ==========================================================
  // 5. PRIVATE KEY RECOVERY UX: LOGIN-PASSWORD-DERIVED KEK
  // ==========================================================
  describe("5. Private Key Recovery UX: Login-Password-Derived KEK", () => {
    const loginPassword = "StudentSecurePassword@2026!";
    const wrongLoginPassword = "WrongPassword#9999!";
    const subtle = globalThis.crypto.subtle;

    // Helper to derive KEK from a password using PBKDF2 (matching webCryptoUtils)
    async function deriveKek(password, salt, iterations = 150000) {
      const encoder = new TextEncoder();
      const pwKey = await subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      return await subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations,
          hash: "SHA-256",
        },
        pwKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }

    it("should encrypt RSA private key with login-password KEK and store backup on server", async () => {
      // 1. Generate RSA keypair for Alice
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

      // 2. Derive AES-256-GCM KEK using Alice's login password
      const salt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(salt);
      const iv = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv);

      const kek = await deriveKek(loginPassword, salt);

      // 3. Export private key as PKCS#8 and encrypt with AES-GCM
      const pkcs8 = await subtle.exportKey("pkcs8", keyPair.privateKey);
      const ciphertextBuffer = await subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        kek,
        pkcs8
      );

      const backupPayload = {
        ciphertext: Buffer.from(ciphertextBuffer).toString("base64"),
        iv: Buffer.from(iv).toString("base64"),
        salt: Buffer.from(salt).toString("base64"),
        iterations: 150000,
      };

      // 4. Save to backend via POST /api/chat/keys/backup
      const res = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify(backupPayload),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    it("should retrieve encrypted backup and restore private key using login password on new device", async () => {
      // First, set up an identity and backup for Alice
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

      const salt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(salt);
      const iv = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv);

      const kek = await deriveKek(loginPassword, salt);
      const pkcs8 = await subtle.exportKey("pkcs8", keyPair.privateKey);
      const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, kek, pkcs8);

      await fetch(`${baseUrl}/api/chat/keys/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
        body: JSON.stringify({
          ciphertext: Buffer.from(ciphertext).toString("base64"),
          iv: Buffer.from(iv).toString("base64"),
          salt: Buffer.from(salt).toString("base64"),
          iterations: 150000,
        }),
      });

      // Simulated new device: Fetch backup from server
      const getRes = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      assert.equal(getRes.status, 200);
      const backupData = (await getRes.json()).data;

      // Restore private key using login password
      const restoredKek = await deriveKek(
        loginPassword,
        Buffer.from(backupData.salt, "base64"),
        backupData.iterations
      );

      const decryptedPkcs8 = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: Buffer.from(backupData.iv, "base64"),
          tagLength: 128,
        },
        restoredKek,
        Buffer.from(backupData.ciphertext, "base64")
      );

      const restoredPrivateKey = await subtle.importKey(
        "pkcs8",
        decryptedPkcs8,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt", "unwrapKey"]
      );

      assert.ok(restoredPrivateKey);

      // Verify restored key functionality: Alice wraps session key with public key, restored private key unwraps it
      const sessionKey = await subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const wrappedKey = await subtle.wrapKey("raw", sessionKey, keyPair.publicKey, { name: "RSA-OAEP" });
      const unwrappedKey = await subtle.unwrapKey(
        "raw",
        wrappedKey,
        restoredPrivateKey,
        { name: "RSA-OAEP" },
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      assert.ok(unwrappedKey);
      assert.equal(unwrappedKey.algorithm.name, "AES-GCM");
    });

    it("should fail decryption when attempting restore with incorrect login password", async () => {
      // Create backup with correct password
      const keyPair = await subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      const salt = new Uint8Array(16);
      globalThis.crypto.getRandomValues(salt);
      const iv = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv);

      const kek = await deriveKek(loginPassword, salt);
      const pkcs8 = await subtle.exportKey("pkcs8", keyPair.privateKey);
      const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, kek, pkcs8);

      // Attempt to decrypt with wrong password
      const wrongKek = await deriveKek(wrongLoginPassword, salt);

      await assert.rejects(
        async () => {
          await subtle.decrypt(
            { name: "AES-GCM", iv, tagLength: 128 },
            wrongKek,
            ciphertext
          );
        },
        /OperationError/
      );
    });

    it("should support legacy backup created with custom passphrase and allow re-encryption", async () => {
      const legacyPassphrase = "MyOldCustomPassphrase2025!";
      const newLoginPassword = "BrandNewLoginPassword2026!";

      const keyPair = await subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      // Create legacy backup
      const salt1 = new Uint8Array(16);
      globalThis.crypto.getRandomValues(salt1);
      const iv1 = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv1);

      const legacyKek = await deriveKek(legacyPassphrase, salt1);
      const pkcs8 = await subtle.exportKey("pkcs8", keyPair.privateKey);
      const legacyCiphertext = await subtle.encrypt(
        { name: "AES-GCM", iv: iv1, tagLength: 128 },
        legacyKek,
        pkcs8
      );

      // Decrypt using legacy passphrase
      const restoredPkcs8 = await subtle.decrypt(
        { name: "AES-GCM", iv: iv1, tagLength: 128 },
        legacyKek,
        legacyCiphertext
      );

      const restoredPrivateKey = await subtle.importKey(
        "pkcs8",
        restoredPkcs8,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
      );
      assert.ok(restoredPrivateKey);

      // Seamless migration: Re-encrypt with new login password
      const salt2 = new Uint8Array(16);
      globalThis.crypto.getRandomValues(salt2);
      const iv2 = new Uint8Array(12);
      globalThis.crypto.getRandomValues(iv2);

      const newKek = await deriveKek(newLoginPassword, salt2);
      const migratedCiphertext = await subtle.encrypt(
        { name: "AES-GCM", iv: iv2, tagLength: 128 },
        newKek,
        restoredPkcs8
      );

      // Verify that future restores with new login password succeed directly
      const decryptedWithNewPassword = await subtle.decrypt(
        { name: "AES-GCM", iv: iv2, tagLength: 128 },
        newKek,
        migratedCiphertext
      );
      assert.equal(decryptedWithNewPassword.byteLength, pkcs8.byteLength);
    });

    it("should ensure backup payload never contains plaintext secrets", async () => {
      const payload = {
        ciphertext: "dGVzdF9jaXBoZXJ0ZXh0",
        iv: "dGVzdF9pdg==",
        salt: "dGVzdF9zYWx0",
        iterations: 150000,
      };

      const res = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 200);

      const getRes = await fetch(`${baseUrl}/api/chat/keys/backup`, {
        headers: { Authorization: `Bearer ${aliceToken}` },
      });
      const data = (await getRes.json()).data;

      // Payload must only contain cryptographic parameters
      assert.ok(data.ciphertext);
      assert.ok(data.iv);
      assert.ok(data.salt);
      assert.ok(data.iterations);
      assert.equal(data.password, undefined);
      assert.equal(data.passphrase, undefined);
      assert.equal(data.privateKey, undefined);
      assert.equal(data.kek, undefined);
    });
  });
});
