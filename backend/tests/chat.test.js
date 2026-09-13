import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { io as ioClient } from "socket.io-client";
import { app, httpServer } from "../server.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { isUserOnline } from "../sockets/chatSocket.js";

describe("CampusX Real-Time Chat & Socket.IO Test Suite", () => {
  let server;
  let baseUrl;
  let socketUrl;

  const mockBuyer = {
    _id: "66e01234567890abcdef0001",
    name: "Rohan Sharma",
    email: "rohan@college.edu",
    department: "Computer Science",
  };

  const mockSeller = {
    _id: "66e01234567890abcdef0002",
    name: "Priya Patel",
    email: "priya@college.edu",
    department: "Electronics",
    phone: "9876543210",
  };

  const mockStranger = {
    _id: "66e01234567890abcdef0003",
    name: "Vikram Singh",
    email: "vikram@college.edu",
    department: "Mechanical",
  };

  const mockProduct = {
    _id: "66e01234567890abcdef0099",
    title: "Casio FX-991EX Scientific Calculator",
    description: "Good condition, barely used for 1 semester.",
    category: "Calculators",
    price: 950,
    condition: "Like New",
    owner: mockSeller._id,
    seller: {
      name: mockSeller.name,
      phone: mockSeller.phone,
      department: mockSeller.department,
    },
    images: ["/uploads/calc.jpg"],
    status: "Available",
  };

  let buyerToken;
  let sellerToken;
  let strangerToken;

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "chat_test_secret_key_123456789";

    buyerToken = jwt.sign({ userId: mockBuyer._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    sellerToken = jwt.sign({ userId: mockSeller._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    strangerToken = jwt.sign({ userId: mockStranger._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Mock User.findById
    User.findById = (id) => {
      const idStr = id?.toString();
      let found = null;
      if (idStr === mockBuyer._id) found = mockBuyer;
      else if (idStr === mockSeller._id) found = mockSeller;
      else if (idStr === mockStranger._id) found = mockStranger;

      return {
        select: () => Promise.resolve(found),
        then: (fn) => Promise.resolve(found).then(fn),
        catch: (fn) => Promise.resolve(found).catch(fn),
      };
    };

    // Mock Product.findById
    Product.findById = async (id) => {
      if (id?.toString() === mockProduct._id) return mockProduct;
      return null;
    };

    // Start ephemeral server
    server = httpServer.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    socketUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    if (server) server.close();
  });

  // ==========================================================
  // 1. SOCKET.IO HANDSHAKE AUTHENTICATION
  // ==========================================================
  describe("1. Socket.IO Handshake Authentication", () => {
    it("should reject connection without token", (t, done) => {
      const client = ioClient(socketUrl, {
        transports: ["websocket"],
        reconnection: false,
      });

      client.on("connect_error", (err) => {
        assert.ok(err.message.includes("Authentication error"));
        client.disconnect();
        done();
      });

      client.on("connect", () => {
        client.disconnect();
        done(new Error("Should not have connected without token"));
      });
    });

    it("should reject connection with invalid token", (t, done) => {
      const client = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: "invalid.jwt.token" },
        reconnection: false,
      });

      client.on("connect_error", (err) => {
        assert.ok(err.message.includes("Authentication error"));
        client.disconnect();
        done();
      });

      client.on("connect", () => {
        client.disconnect();
        done(new Error("Should not have connected with invalid token"));
      });
    });

    it("should successfully authenticate and connect with valid JWT", (t, done) => {
      const client = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: buyerToken },
        reconnection: false,
      });

      client.on("connect", () => {
        assert.ok(client.connected);
        client.disconnect();
        done();
      });

      client.on("connect_error", (err) => {
        done(err);
      });
    });
  });

  // ==========================================================
  // 2. CONVERSATION MANAGEMENT & AUTHORIZATION REST APIS
  // ==========================================================
  describe("2. Conversation Management & REST APIs", () => {
    let createdConv;

    beforeEach(() => {
      // In-memory conversation store for mock
      createdConv = {
        _id: "66e01234567890abcdef1001",
        participants: [mockBuyer, mockSeller],
        product: mockProduct,
        lastMessageContent: "",
        lastMessageAt: new Date(),
        save: async function () { return this; },
      };

      Conversation.findOne = (query) => {
        let result = null;
        if (
          query?.product === mockProduct._id &&
          query?.participants?.$all?.includes(mockBuyer._id)
        ) {
          result = createdConv;
        }
        return {
          populate: () => ({
            populate: () => Promise.resolve(result),
            then: (fn) => Promise.resolve(result).then(fn),
          }),
          then: (fn) => Promise.resolve(result).then(fn),
        };
      };

      Conversation.create = async (data) => {
        return {
          ...createdConv,
          ...data,
        };
      };

      Conversation.findById = (id) => {
        let result = null;
        if (id?.toString() === createdConv._id) {
          result = createdConv;
        }
        return {
          populate: () => ({
            populate: () => ({
              lean: () => Promise.resolve(result),
              then: (fn) => Promise.resolve(result).then(fn),
            }),
            then: (fn) => Promise.resolve(result).then(fn),
          }),
          then: (fn) => Promise.resolve(result).then(fn),
        };
      };

      Conversation.find = () => {
        return {
          sort: () => ({
            populate: () => ({
              populate: () => ({
                lean: () => Promise.resolve([createdConv]),
              }),
            }),
          }),
        };
      };

      Message.countDocuments = async () => 0;
    });

    it("should prevent a seller from chatting on their own listing", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({ productId: mockProduct._id }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.ok(body.message.includes("own product listing"));
    });

    it("should allow buyer to create or retrieve conversation with seller", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({ productId: mockProduct._id }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(body.data);
    });

    it("should return user conversations with unread count", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${buyerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].unreadCount, 0);
    });

    it("should prevent stranger from accessing conversation where they are not a participant", async () => {
      const res = await fetch(`${baseUrl}/api/chat/conversations/${createdConv._id}`, {
        headers: {
          Authorization: `Bearer ${strangerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.ok(body.message.includes("Not authorized"));
    });
  });

  // ==========================================================
  // 3. REAL-TIME SOCKET MESSAGING & PERSISTENCE
  // ==========================================================
  describe("3. Real-Time Socket Messaging & Room Isolation", () => {
    let buyerClient;
    let sellerClient;
    const testConvId = "66e01234567890abcdef1001";

    before((t, done) => {
      // Mock Conversation.findById for socket handlers
      Conversation.findById = async (id) => {
        if (id?.toString() === testConvId) {
          return {
            _id: testConvId,
            participants: [mockBuyer._id, mockSeller._id],
          };
        }
        return null;
      };

      Conversation.findByIdAndUpdate = async () => {};

      Message.create = async (data) => {
        return {
          _id: "66e01234567890abcdef5001",
          createdAt: new Date(),
          ...data,
        };
      };

      Message.findById = (id) => ({
        populate: () => ({
          lean: () =>
            Promise.resolve({
              _id: id,
              conversation: testConvId,
              sender: { _id: mockBuyer._id, name: mockBuyer.name },
              receiver: mockSeller._id,
              content: "Hi Priya, is the calculator still available?",
              messageType: "text",
              createdAt: new Date(),
              read: false,
            }),
        }),
      });

      buyerClient = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: buyerToken },
      });

      sellerClient = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: sellerToken },
      });

      let connected = 0;
      const onConnect = () => {
        connected++;
        if (connected === 2) done();
      };

      buyerClient.on("connect", onConnect);
      sellerClient.on("connect", onConnect);
    });

    after(() => {
      if (buyerClient) buyerClient.disconnect();
      if (sellerClient) sellerClient.disconnect();
    });

    it("should allow participants to join the conversation room", (t, done) => {
      sellerClient.emit("join_conversation", { conversationId: testConvId }, (res) => {
        try {
          assert.ok(res.success);
          buyerClient.emit("join_conversation", { conversationId: testConvId }, (res2) => {
            try {
              assert.ok(res2.success);
              done();
            } catch (err) {
              done(err);
            }
          });
        } catch (err) {
          done(err);
        }
      });
    });

    it("should deliver new messages in real-time to participants in room", (t, done) => {
      sellerClient.once("new_message", (message) => {
        try {
          assert.equal(message.conversation, testConvId);
          assert.equal(message.content, "Hi Priya, is the calculator still available?");
          done();
        } catch (err) {
          done(err);
        }
      });

      buyerClient.emit(
        "send_message",
        {
          conversationId: testConvId,
          content: "Hi Priya, is the calculator still available?",
          messageType: "text",
        },
        (res) => {
          try {
            assert.ok(res.success);
          } catch (err) {
            done(err);
          }
        }
      );
    });

    it("should reject empty text messages", (t, done) => {
      buyerClient.emit(
        "send_message",
        {
          conversationId: testConvId,
          content: "    ",
          messageType: "text",
        },
        (res) => {
          try {
            assert.equal(res.success, false);
            assert.ok(res.error.toLowerCase().includes("empty"));
            done();
          } catch (err) {
            done(err);
          }
        }
      );
    });

    it("should broadcast typing indicators between participants", (t, done) => {
      sellerClient.once("user_typing", (data) => {
        try {
          assert.equal(data.conversationId, testConvId);
          assert.equal(data.userId, mockBuyer._id);
          done();
        } catch (err) {
          done(err);
        }
      });

      buyerClient.emit("typing_start", { conversationId: testConvId });
    });

    it("should broadcast message read receipt when recipient views messages", (t, done) => {
      Message.updateMany = async () => ({ modifiedCount: 1 });

      buyerClient.once("messages_read", (data) => {
        try {
          assert.equal(data.conversationId, testConvId);
          assert.equal(data.readerId, mockSeller._id);
          done();
        } catch (err) {
          done(err);
        }
      });

      sellerClient.emit("message_read", { conversationId: testConvId });
    });
  });

  // ==========================================================
  // 4. MULTI-TAB PRESENCE TRACKING
  // ==========================================================
  describe("4. Multi-Tab Presence Tracking", () => {
    it("should accurately report user online status with multiple connections", (t, done) => {
      const tab1 = ioClient(socketUrl, {
        transports: ["websocket"],
        auth: { token: strangerToken },
      });

      tab1.on("connect", () => {
        assert.ok(isUserOnline(mockStranger._id));

        // Open second tab for same user
        const tab2 = ioClient(socketUrl, {
          transports: ["websocket"],
          auth: { token: strangerToken },
        });

        tab2.on("connect", () => {
          assert.ok(isUserOnline(mockStranger._id));

          // Disconnect tab 1: user should STILL be online because tab 2 is active
          tab1.disconnect();

          setTimeout(() => {
            assert.ok(isUserOnline(mockStranger._id), "User should remain online with 1 active tab");

            // Disconnect tab 2: user should now be offline
            tab2.disconnect();

            setTimeout(() => {
              assert.ok(!isUserOnline(mockStranger._id), "User should be offline when all tabs close");
              done();
            }, 50);
          }, 50);
        });
      });
    });
  });
});
