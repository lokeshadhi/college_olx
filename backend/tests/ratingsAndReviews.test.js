import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../server.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Transaction from "../models/Transaction.js";
import Review from "../models/Review.js";
import { moderateReview } from "../services/aiReviewModerationService.js";

describe("CampusX Feature #19: Ratings & Reviews Test Suite", () => {
  let server;
  let baseUrl;

  const mockBuyerId = new mongoose.Types.ObjectId("66e01234567890abcdef0001");
  const mockSellerId = new mongoose.Types.ObjectId("66e01234567890abcdef0002");
  const mockStrangerId = new mongoose.Types.ObjectId("66e01234567890abcdef0003");
  const mockProductId = new mongoose.Types.ObjectId("66e01234567890abcdef0099");
  const mockTransactionId = new mongoose.Types.ObjectId("66e01234567890abcdef0100");

  let buyerToken;
  let sellerToken;
  let strangerToken;

  const mockBuyer = {
    _id: mockBuyerId,
    name: "Rohan Sharma",
    email: "20240001@nitkkr.ac.in",
    department: "Computer Engineering",
    year: "3rd Year",
    isEmailVerified: true,
    sellerRating: 0,
    sellerReviewCount: 0,
    buyerRating: 0,
    buyerReviewCount: 0,
    rating: 0,
    reviewCount: 0,
  };

  const mockSeller = {
    _id: mockSellerId,
    name: "Priya Patel",
    email: "20240002@nitkkr.ac.in",
    department: "Electronics",
    year: "4th Year",
    isEmailVerified: true,
    sellerRating: 0,
    sellerReviewCount: 0,
    buyerRating: 0,
    buyerReviewCount: 0,
    rating: 0,
    reviewCount: 0,
  };

  const mockStranger = {
    _id: mockStrangerId,
    name: "Vikram Singh",
    email: "20240003@nitkkr.ac.in",
    department: "Mechanical",
    year: "2nd Year",
    isEmailVerified: true,
  };

  const mockProduct = {
    _id: mockProductId,
    title: "Casio FX-991EX Calculator",
    description: "Good condition",
    price: 800,
    category: "Calculators",
    condition: "Like New",
    owner: mockSellerId,
    seller: {
      name: mockSeller.name,
      department: mockSeller.department,
      phone: "9876543210",
      isEmailVerified: true,
    },
    status: "Available",
  };

  // In-memory mock storage for collections during test runs
  let transactionsDb = [];
  let reviewsDb = [];
  let usersDb = [];

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_super_secret_jwt_key_reviews_98765";

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    buyerToken = jwt.sign({ userId: mockBuyerId.toString(), id: mockBuyerId.toString() }, process.env.JWT_SECRET, { expiresIn: "1d" });
    sellerToken = jwt.sign({ userId: mockSellerId.toString(), id: mockSellerId.toString() }, process.env.JWT_SECRET, { expiresIn: "1d" });
    strangerToken = jwt.sign({ userId: mockStrangerId.toString(), id: mockStrangerId.toString() }, process.env.JWT_SECRET, { expiresIn: "1d" });
  });

  after(() => {
    if (server) server.close();
  });

  beforeEach(() => {
    usersDb = [
      { ...mockBuyer },
      { ...mockSeller },
      { ...mockStranger },
    ];

    transactionsDb = [
      {
        _id: mockTransactionId,
        buyer: mockBuyerId,
        seller: mockSellerId,
        product: mockProductId,
        amount: 800,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    ];

    reviewsDb = [];

    // Mock User queries
    User.findById = (id) => {
      const idStr = id?.toString();
      const user = idStr ? usersDb.find((u) => u._id.toString() === idStr) : null;
      return {
        select: () => Promise.resolve(user || null),
        then: (fn) => Promise.resolve(user || null).then(fn),
        catch: (fn) => Promise.resolve(user || null).catch(fn),
      };
    };

    User.findByIdAndUpdate = async (id, update) => {
      const user = usersDb.find((u) => u._id.toString() === id.toString());
      if (user) {
        Object.assign(user, update);
      }
      return user;
    };

    // Mock Product queries
    Product.findById = (id) => {
      const p = id?.toString() === mockProductId.toString() ? mockProduct : null;
      return {
        populate: () => Promise.resolve(p),
        then: (fn) => Promise.resolve(p).then(fn),
        catch: (fn) => Promise.resolve(p).catch(fn),
      };
    };

    Product.find = (query) => {
      let results = [mockProduct];
      if (query?.owner) {
        results = results.filter((p) => (p.owner?._id || p.owner).toString() === query.owner.toString());
      }
      const chain = {
        sort: () => chain,
        then: (fn) => Promise.resolve(results).then(fn),
        catch: (fn) => Promise.resolve(results).catch(fn),
      };
      return chain;
    };

    // Mock Transaction queries
    Transaction.findById = (id) => {
      let txn = transactionsDb.find((t) => t._id.toString() === id.toString());
      const chain = {
        populate: (field) => {
          if (txn) {
            const item = txn.toObject ? txn.toObject() : (txn._doc ? { ...txn._doc } : { ...txn });
            if (field === "buyer") {
              const buyerIdStr = (item.buyer?._id || item.buyer)?.toString();
              item.buyer = buyerIdStr ? usersDb.find((u) => u._id.toString() === buyerIdStr) || item.buyer : item.buyer;
            }
            if (field === "seller") {
              const sellerIdStr = (item.seller?._id || item.seller)?.toString();
              item.seller = sellerIdStr ? usersDb.find((u) => u._id.toString() === sellerIdStr) || item.seller : item.seller;
            }
            if (field === "product") {
              item.product = mockProduct;
            }
            txn = item;
          }
          return chain;
        },
        then: (fn) => Promise.resolve(txn || null).then(fn),
        catch: (fn) => Promise.resolve(txn || null).catch(fn),
      };
      return chain;
    };

    Transaction.find = (query) => {
      let results = [...transactionsDb];
      if (query?.status) {
        results = results.filter((t) => (t.status || t._doc?.status) === query.status);
      }
      if (query?.product) {
        results = results.filter((t) => {
          const prod = t.product || t._doc?.product;
          return (prod?._id || prod).toString() === query.product.toString();
        });
      }
      if (query?.$or) {
        results = results.filter((t) => {
          const buyer = t.buyer || t._doc?.buyer;
          const seller = t.seller || t._doc?.seller;
          return query.$or.some((cond) =>
            (cond.buyer && (buyer?._id || buyer).toString() === cond.buyer.toString()) ||
            (cond.seller && (seller?._id || seller).toString() === cond.seller.toString())
          );
        });
      }

      const chain = {
        sort: (sortCriteria) => {
          if (sortCriteria?.amount === -1) {
            results.sort((a, b) => {
              const aAmt = a.amount ?? a._doc?.amount ?? 0;
              const bAmt = b.amount ?? b._doc?.amount ?? 0;
              return bAmt - aAmt;
            });
          }
          return chain;
        },
        skip: () => chain,
        limit: () => chain,
        populate: (field) => {
          results = results.map((t) => {
            const item = t.toObject ? t.toObject() : (t._doc ? { ...t._doc } : { ...t });
            if (field === "buyer") {
              const buyerIdStr = (t.buyer?._id || t.buyer || t._doc?.buyer)?.toString();
              item.buyer = buyerIdStr ? usersDb.find((u) => u._id.toString() === buyerIdStr) || item.buyer : item.buyer;
            }
            if (field === "seller") {
              const sellerIdStr = (t.seller?._id || t.seller || t._doc?.seller)?.toString();
              item.seller = sellerIdStr ? usersDb.find((u) => u._id.toString() === sellerIdStr) || item.seller : item.seller;
            }
            if (field === "product") {
              item.product = mockProduct;
            }
            return item;
          });
          return chain;
        },
        then: (fn) => Promise.resolve(results).then(fn),
        catch: (fn) => Promise.resolve(results).catch(fn),
      };
      return chain;
    };

    Transaction.findOne = (query) => {
      let found = transactionsDb.find((t) => {
        const prod = t.product || t._doc?.product;
        const buyer = t.buyer || t._doc?.buyer;
        const status = t.status || t._doc?.status;
        let match = true;
        if (query?.product && (prod?._id || prod).toString() !== query.product.toString()) match = false;
        if (query?.buyer && (buyer?._id || buyer).toString() !== query.buyer.toString()) match = false;
        if (query?.status && status !== query.status) match = false;
        if (query?.$or) {
          const seller = t.seller || t._doc?.seller;
          const satisfiesOr = query.$or.some((cond) =>
            (cond.buyer && (buyer?._id || buyer).toString() === cond.buyer.toString()) ||
            (cond.seller && (seller?._id || seller).toString() === cond.seller.toString())
          );
          if (!satisfiesOr) match = false;
        }
        return match;
      });

      const chain = {
        populate: (field) => {
          if (found) {
            const item = found.toObject ? found.toObject() : (found._doc ? { ...found._doc } : { ...found });
            if (field === "buyer") {
              const buyerIdStr = (item.buyer?._id || item.buyer)?.toString();
              item.buyer = buyerIdStr ? usersDb.find((u) => u._id.toString() === buyerIdStr) || item.buyer : item.buyer;
            }
            if (field === "seller") {
              const sellerIdStr = (item.seller?._id || item.seller)?.toString();
              item.seller = sellerIdStr ? usersDb.find((u) => u._id.toString() === sellerIdStr) || item.seller : item.seller;
            }
            if (field === "product") {
              item.product = mockProduct;
            }
            found = item;
          }
          return chain;
        },
        then: (fn) => Promise.resolve(found || null).then(fn),
        catch: (fn) => Promise.resolve(found || null).catch(fn),
      };
      return chain;
    };

    Transaction.prototype.save = async function () {
      this._id = this._id || new mongoose.Types.ObjectId();
      this.createdAt = this.createdAt || new Date();
      const existingIdx = transactionsDb.findIndex((t) => t._id.toString() === this._id.toString());
      if (existingIdx >= 0) {
        transactionsDb[existingIdx] = this;
      } else {
        transactionsDb.push(this);
      }
      return this;
    };

    Transaction.prototype.populate = async function (field) {
      if (field === "buyer") {
        const buyerIdStr = (this.buyer?._id || this.buyer)?.toString();
        this.buyer = buyerIdStr ? usersDb.find((u) => u._id.toString() === buyerIdStr) || this.buyer : this.buyer;
      }
      if (field === "seller") {
        const sellerIdStr = (this.seller?._id || this.seller)?.toString();
        this.seller = sellerIdStr ? usersDb.find((u) => u._id.toString() === sellerIdStr) || this.seller : this.seller;
      }
      if (field === "product") {
        this.product = mockProduct;
      }
      return this;
    };

    Transaction.updateMany = async (query, update) => {
      let count = 0;
      transactionsDb.forEach((t) => {
        let match = true;
        if (query?.product && t.product.toString() !== query.product.toString()) match = false;
        if (query?._id?.$ne && t._id.toString() === query._id.$ne.toString()) match = false;
        if (query?.status && t.status !== query.status) match = false;
        if (match) {
          if (update?.status) t.status = update.status;
          if (update?.notes) t.notes = update.notes;
          count++;
        }
      });
      return { modifiedCount: count };
    };

    Transaction.countDocuments = async (query) => {
      return transactionsDb.filter((t) => {
        let match = true;
        if (query?.buyer && t.buyer.toString() !== query.buyer.toString()) match = false;
        if (query?.status && t.status !== query.status) match = false;
        return match;
      }).length;
    };

    mockProduct.status = "Available";
    mockProduct.save = async function () {
      return this;
    };

    // Mock Review queries
    Review.findOne = async (query) => {
      return (
        reviewsDb.find((r) => {
          let match = true;
          if (query.reviewer && r.reviewer.toString() !== query.reviewer.toString()) match = false;
          if (query.transaction && r.transaction.toString() !== query.transaction.toString()) match = false;
          return match;
        }) || null
      );
    };

    Review.find = (query) => {
      let results = [...reviewsDb];
      if (query?.reviewedUser) {
        results = results.filter((r) => r.reviewedUser.toString() === query.reviewedUser.toString());
      }
      if (query?.product) {
        results = results.filter((r) => r.product.toString() === query.product.toString());
      }
      if (query?.role) {
        results = results.filter((r) => r.role === query.role);
      }
      if (query?.transaction) {
        if (query.transaction.$in) {
          const ids = query.transaction.$in.map((x) => x.toString());
          results = results.filter((r) => ids.includes(r.transaction.toString()));
        } else {
          results = results.filter((r) => r.transaction.toString() === query.transaction.toString());
        }
      }
      if (query?.moderationStatus?.$ne) {
        results = results.filter((r) => r.moderationStatus !== query.moderationStatus.$ne);
      }

      const chain = {
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        select: () => chain,
        populate: () => chain,
        then: (fn) => Promise.resolve(results).then(fn),
        catch: (fn) => Promise.resolve(results).catch(fn),
      };
      return chain;
    };

    Review.countDocuments = async (query) => {
      let results = [...reviewsDb];
      if (query?.reviewedUser) {
        results = results.filter((r) => r.reviewedUser.toString() === query.reviewedUser.toString());
      }
      if (query?.role) {
        results = results.filter((r) => r.role === query.role);
      }
      return results.length;
    };

    Review.findById = async (id) => {
      const doc = reviewsDb.find((r) => r._id.toString() === id.toString());
      if (!doc) return null;
      return {
        ...doc,
        save: async function () {
          const idx = reviewsDb.findIndex((r) => r._id.toString() === id.toString());
          if (idx !== -1) reviewsDb[idx] = this;
          return this;
        },
        deleteOne: async function () {
          reviewsDb = reviewsDb.filter((r) => r._id.toString() !== id.toString());
        },
      };
    };

    // Mock static recalculateUserRatings
    Review.recalculateUserRatings = async function (userId) {
      const userReviews = reviewsDb.filter(
        (r) => r.reviewedUser.toString() === userId.toString() && r.moderationStatus !== "FLAGGED"
      );

      const sellerRevs = userReviews.filter((r) => r.role === "seller");
      const buyerRevs = userReviews.filter((r) => r.role === "buyer");

      const sellerAvg =
        sellerRevs.length > 0
          ? Math.round((sellerRevs.reduce((acc, r) => acc + r.rating, 0) / sellerRevs.length) * 10) / 10
          : 0;
      const buyerAvg =
        buyerRevs.length > 0
          ? Math.round((buyerRevs.reduce((acc, r) => acc + r.rating, 0) / buyerRevs.length) * 10) / 10
          : 0;

      const totalCount = userReviews.length;
      const overallAvg =
        totalCount > 0
          ? Math.round((userReviews.reduce((acc, r) => acc + r.rating, 0) / totalCount) * 10) / 10
          : 0;

      await User.findByIdAndUpdate(userId, {
        sellerRating: sellerAvg,
        sellerReviewCount: sellerRevs.length,
        buyerRating: buyerAvg,
        buyerReviewCount: buyerRevs.length,
        rating: overallAvg,
        reviewCount: totalCount,
      });
    };

    // Override prototype.save for new Review instances
    Review.prototype.save = async function () {
      this._id = this._id || new mongoose.Types.ObjectId();
      this.createdAt = new Date();
      reviewsDb.push(this);
      return this;
    };

    Review.prototype.populate = async function () {
      return this;
    };
  });

  // ==========================================
  // 1. BASIC REVIEW CREATION (BUYER & SELLER)
  // ==========================================
  describe("1. Review Creation & Authorization", () => {
    it("should allow buyer to rate seller on completed transaction with rating 5 and review text", async () => {
      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
          review: "Great seller, item was in perfect condition!",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.rating, 5);
      assert.equal(body.data.role, "seller");
      assert.equal(body.data.reviewedUser.toString(), mockSellerId.toString());
      assert.equal(body.data.reviewer.toString(), mockBuyerId.toString());

      // Check seller rating updated
      const seller = usersDb.find((u) => u._id.toString() === mockSellerId.toString());
      assert.equal(seller.sellerRating, 5);
      assert.equal(seller.sellerReviewCount, 1);
    });

    it("should allow seller to rate buyer on completed transaction with rating 4 without review text", async () => {
      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 4,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.rating, 4);
      assert.equal(body.data.role, "buyer");
      assert.equal(body.data.reviewedUser.toString(), mockBuyerId.toString());
      assert.equal(body.data.reviewer.toString(), mockSellerId.toString());

      // Check buyer rating updated
      const buyer = usersDb.find((u) => u._id.toString() === mockBuyerId.toString());
      assert.equal(buyer.buyerRating, 4);
      assert.equal(buyer.buyerReviewCount, 1);
    });

    it("should reject review submission without authentication with 401", async () => {
      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
        }),
      });

      assert.equal(res.status, 401);
    });
  });

  // ==========================================
  // 2. SECURITY & TRANSACTION VALIDATION
  // ==========================================
  describe("2. Security, Integrity & Authorization Rules", () => {
    it("should reject review from non-participant with 403", async () => {
      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${strangerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
          review: "Unauthorized stranger review",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.ok(body.message.includes("not a participant"));
    });

    it("should reject rating an uncompleted transaction with 400", async () => {
      const pendingTxnId = new mongoose.Types.ObjectId("66e01234567890abcdef0101");
      transactionsDb.push({
        _id: pendingTxnId,
        buyer: mockBuyerId,
        seller: mockSellerId,
        product: mockProductId,
        amount: 800,
        status: "PAYMENT_PENDING",
      });

      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: pendingTxnId.toString(),
          rating: 5,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.ok(body.message.includes("completed"));
    });

    it("should reject invalid integer ratings (0, 6, -1, 3.5, string) with 400", async () => {
      const invalidRatings = [0, 6, -1, 3.5, "five"];

      for (const r of invalidRatings) {
        const res = await fetch(`${baseUrl}/api/reviews`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${buyerToken}`,
          },
          body: JSON.stringify({
            transactionId: mockTransactionId.toString(),
            rating: r,
          }),
        });

        assert.equal(res.status, 400, `Expected 400 for rating ${r}`);
      }
    });

    it("should reject reviews exceeding 500 characters with 400", async () => {
      const longReview = "A".repeat(501);

      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
          review: longReview,
        }),
      });

      assert.equal(res.status, 400);
    });

    it("should ignore and never trust client-submitted reviewedUser or reviewer in req.body", async () => {
      const fakeReviewedUser = new mongoose.Types.ObjectId("66e01234567890abcdef9999");

      const res = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
          reviewedUser: fakeReviewedUser.toString(),
          reviewer: fakeReviewedUser.toString(),
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      // Backend must authoritatively set reviewedUser to mockSellerId
      assert.equal(body.data.reviewedUser.toString(), mockSellerId.toString());
      assert.equal(body.data.reviewer.toString(), mockBuyerId.toString());
    });
  });

  // ==========================================
  // 3. DUPLICATE REVIEWS PREVENTION
  // ==========================================
  describe("3. Duplicate Review Prevention", () => {
    it("should prevent a participant from reviewing the same transaction twice", async () => {
      // First review succeeds
      const res1 = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
          review: "First review",
        }),
      });
      assert.equal(res1.status, 201);

      // Second review from same buyer on same transaction is rejected
      const res2 = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 4,
          review: "Duplicate review attempt",
        }),
      });

      const body2 = await res2.json();
      assert.equal(res2.status, 400);
      assert.ok(body2.message.includes("already reviewed"));
    });

    it("should allow both buyer and seller to independently review the transaction once", async () => {
      // Buyer reviews
      const buyerRes = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
        }),
      });
      assert.equal(buyerRes.status, 201);

      // Seller reviews same transaction
      const sellerRes = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`,
        },
        body: JSON.stringify({
          transactionId: mockTransactionId.toString(),
          rating: 5,
        }),
      });
      assert.equal(sellerRes.status, 201);

      assert.equal(reviewsDb.length, 2);
    });
  });

  // ==========================================
  // 4. EDIT & DELETE REVIEWS
  // ==========================================
  describe("4. Review Editing & Deletion Permissions", () => {
    let testReviewId;

    beforeEach(async () => {
      testReviewId = new mongoose.Types.ObjectId("66e01234567890abcdef0500");
      reviewsDb.push({
        _id: testReviewId,
        reviewer: mockBuyerId,
        reviewedUser: mockSellerId,
        transaction: mockTransactionId,
        product: mockProductId,
        role: "seller",
        rating: 4,
        review: "Original review",
        moderationStatus: "APPROVED",
        save: async function () {
          return this;
        },
        deleteOne: async function () {
          reviewsDb = reviewsDb.filter((r) => r._id.toString() !== testReviewId.toString());
        },
      });
      await Review.recalculateUserRatings(mockSellerId);
    });

    it("should allow review owner to edit rating and text", async () => {
      const res = await fetch(`${baseUrl}/api/reviews/${testReviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          rating: 5,
          review: "Updated review text: Absolutely wonderful seller!",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.rating, 5);
      assert.equal(body.data.review, "Updated review text: Absolutely wonderful seller!");

      // Seller average rating should recalculate to 5
      const seller = usersDb.find((u) => u._id.toString() === mockSellerId.toString());
      assert.equal(seller.sellerRating, 5);
    });

    it("should prevent stranger or reviewed user from editing someone else's review with 403", async () => {
      const res = await fetch(`${baseUrl}/api/reviews/${testReviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`, // Seller is reviewedUser, NOT reviewer
        },
        body: JSON.stringify({
          rating: 1,
        }),
      });

      assert.equal(res.status, 403);
    });

    it("should prevent stranger or reviewed user from deleting someone else's review with 403", async () => {
      const res = await fetch(`${baseUrl}/api/reviews/${testReviewId}`, {
        method: "DELETE",
        headers: {
          Cookie: `token=${strangerToken}`,
        },
      });

      assert.equal(res.status, 403);
    });

    it("should allow review owner to delete review and recalculate rating stats", async () => {
      const res = await fetch(`${baseUrl}/api/reviews/${testReviewId}`, {
        method: "DELETE",
        headers: {
          Cookie: `token=${buyerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);

      // Seller review count should be 0 after deletion
      const seller = usersDb.find((u) => u._id.toString() === mockSellerId.toString());
      assert.equal(seller.sellerReviewCount, 0);
      assert.equal(seller.sellerRating, 0);
    });
  });

  // ==========================================
  // 5. PENDING REVIEWS ENDPOINT
  // ==========================================
  describe("5. Pending Reviews API", () => {
    it("should return completed transactions waiting for user's review", async () => {
      const res = await fetch(`${baseUrl}/api/reviews/me/pending`, {
        headers: {
          Cookie: `token=${buyerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.count, 1);
      assert.equal(body.data[0].targetRole, "seller");
      assert.equal(body.data[0].targetUser.name, "Priya Patel");
    });
  });

  // ==========================================
  // 6. GEMINI AI REVIEW MODERATION & FAIL-OPEN
  // ==========================================
  describe("6. AI Content Moderation & Resilience", () => {
    it("should approve normal review and fail-open gracefully when Gemini is offline or mock API key used", async () => {
      const mod = await moderateReview("Super friendly student, easy pickup near Library.");
      assert.equal(mod.status, "APPROVED");
    });
  });

  // ==========================================
  // 7. END-TO-END PURCHASE → TRANSACTION → TWO-WAY REVIEW FLOW
  // ==========================================
  describe("7. End-to-End Purchase → Transaction → Two-Way Review Flow", () => {
    it("should allow buyer to send purchase request (PENDING), prevent buyer from approving, and complete deal when seller approves", async () => {
      mockProduct.status = "Available";
      transactionsDb = [];
      reviewsDb = [];

      // 1. Buyer creates purchase request
      const res = await fetch(`${baseUrl}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          productId: mockProductId.toString(),
          amount: 800,
          meetupLocation: "Central Library",
          notes: "Will meet at 5 PM",
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.status, "PENDING");
      assert.equal((body.data.buyer?._id || body.data.buyer).toString(), mockBuyerId.toString());
      assert.equal((body.data.seller?._id || body.data.seller).toString(), mockSellerId.toString());
      assert.equal(mockProduct.status, "Available");

      const txnId = body.data._id;

      // 2. Buyer attempts to approve own request -> rejected with 403
      const buyerApproveRes = await fetch(`${baseUrl}/api/transactions/${txnId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          status: "COMPLETED",
        }),
      });
      assert.equal(buyerApproveRes.status, 403);

      // 3. Seller approves the purchase request -> completed & product marked Sold
      const sellerApproveRes = await fetch(`${baseUrl}/api/transactions/${txnId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`,
        },
        body: JSON.stringify({
          status: "COMPLETED",
        }),
      });
      const sellerApproveBody = await sellerApproveRes.json();
      assert.equal(sellerApproveRes.status, 200);
      assert.equal(sellerApproveBody.data.status, "COMPLETED");
      assert.equal(mockProduct.status, "Sold");
    });

    it("should reject purchase when buyer attempts to buy their own product", async () => {
      mockProduct.status = "Available";
      const res = await fetch(`${baseUrl}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`, // Seller owns mockProduct
        },
        body: JSON.stringify({
          productId: mockProductId.toString(),
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.match(body.message, /cannot purchase your own product/i);
    });

    it("should reject purchase when product is already marked Sold", async () => {
      mockProduct.status = "Sold";
      const res = await fetch(`${baseUrl}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          productId: mockProductId.toString(),
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.match(body.message, /already sold/i);
    });

    it("should return transaction and review status via GET /api/transactions/product/:productId", async () => {
      const newTxnId = new mongoose.Types.ObjectId();
      transactionsDb = [
        {
          _id: newTxnId,
          buyer: mockBuyerId,
          seller: mockSellerId,
          product: mockProductId,
          amount: 800,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      ];
      reviewsDb = [];

      const res = await fetch(`${baseUrl}/api/transactions/product/${mockProductId}`, {
        headers: {
          Cookie: `token=${buyerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.isBuyer, true);
      assert.equal(body.data.targetRole, "seller");
      assert.equal(body.data.hasReviewed, false);
    });

    it("should execute complete two-way review: buyer rates seller (5★) and seller rates buyer (4★)", async () => {
      const e2eTxnId = new mongoose.Types.ObjectId();
      transactionsDb = [
        {
          _id: e2eTxnId,
          buyer: mockBuyerId,
          seller: mockSellerId,
          product: mockProductId,
          amount: 800,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      ];
      reviewsDb = [];

      // 1. Buyer rates Seller 5 stars
      const buyerRes = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: e2eTxnId.toString(),
          rating: 5,
          review: "Excellent seller, item was perfect!",
        }),
      });
      const buyerBody = await buyerRes.json();
      assert.equal(buyerRes.status, 201);
      assert.equal(buyerBody.data.role, "seller");
      assert.equal(buyerBody.data.rating, 5);

      // Verify seller's sellerRating updated
      const sellerUser = usersDb.find((u) => u._id.toString() === mockSellerId.toString());
      assert.equal(sellerUser.sellerRating, 5);
      assert.equal(sellerUser.sellerReviewCount, 1);

      // 2. Seller rates Buyer 4 stars
      const sellerRes = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`,
        },
        body: JSON.stringify({
          transactionId: e2eTxnId.toString(),
          rating: 4,
          review: "Smooth meetup and prompt payment.",
        }),
      });
      const sellerBody = await sellerRes.json();
      assert.equal(sellerRes.status, 201);
      assert.equal(sellerBody.data.role, "buyer");
      assert.equal(sellerBody.data.rating, 4);

      // Verify buyer's buyerRating updated
      const buyerUser = usersDb.find((u) => u._id.toString() === mockBuyerId.toString());
      assert.equal(buyerUser.buyerRating, 4);
      assert.equal(buyerUser.buyerReviewCount, 1);

      // 3. Buyer tries to review seller again on same transaction -> reject with 400
      const duplicateBuyerRes = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${buyerToken}`,
        },
        body: JSON.stringify({
          transactionId: e2eTxnId.toString(),
          rating: 5,
        }),
      });
      assert.equal(duplicateBuyerRes.status, 400);

      // 4. Seller tries to review buyer again on same transaction -> reject with 400
      const duplicateSellerRes = await fetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${sellerToken}`,
        },
        body: JSON.stringify({
          transactionId: e2eTxnId.toString(),
          rating: 4,
        }),
      });
      assert.equal(duplicateSellerRes.status, 400);
      });
    });

    describe("8. Multi-Bid Offers & Acceptance / Profile 'No. of Buys' Metric", () => {
      it("should execute full multi-bid flow: multiple buyers submit bids, update bids, seller inspects sorted offers, accepts preferred bid, auto-cancels competing bids, and updates boughtCount in profile", async () => {
        // Clear previous test state
        mockProduct.status = "Available";
        transactionsDb = [];

        // 1. Buyer 1 submits bid with amount: 700
        const res1 = await fetch(`${baseUrl}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${buyerToken}`,
          },
          body: JSON.stringify({
            productId: mockProductId.toString(),
            amount: 700,
            meetupLocation: "NIT KKR Admin Block",
            notes: "I can pick up today at 5pm",
          }),
        });
        const body1 = await res1.json();
        assert.equal(res1.status, 201);
        assert.equal(body1.success, true);
        assert.equal(body1.data.amount, 700);
        assert.equal(body1.data.status, "PENDING");
        const buyer1TxnId = body1.data._id;

        // 2. Buyer 2 (Stranger) submits higher bid with amount: 850
        const res2 = await fetch(`${baseUrl}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${strangerToken}`,
          },
          body: JSON.stringify({
            productId: mockProductId.toString(),
            amount: 850,
            meetupLocation: "NIT KKR Sports Complex",
            notes: "Ready with cash immediately",
          }),
        });
        const body2 = await res2.json();
        assert.equal(res2.status, 201);
        assert.equal(body2.success, true);
        assert.equal(body2.data.amount, 850);
        assert.equal(body2.data.status, "PENDING");
        const buyer2TxnId = body2.data._id;

        // 3. Buyer 1 updates their existing bid from 700 to 750
        const updateRes = await fetch(`${baseUrl}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${buyerToken}`,
          },
          body: JSON.stringify({
            productId: mockProductId.toString(),
            amount: 750,
            meetupLocation: "NIT KKR Library",
            notes: "Updated my offer to 750",
          }),
        });
        const updateBody = await updateRes.json();
        assert.equal(updateRes.status, 200);
        assert.equal(updateBody.success, true);
        assert.equal(updateBody.data.amount, 750);
        assert.equal(updateBody.data._id.toString(), buyer1TxnId.toString());

        // 4. Seller inspects incoming bids via GET /api/transactions/product/:productId
        const getBidsRes = await fetch(`${baseUrl}/api/transactions/product/${mockProductId}`, {
          method: "GET",
          headers: {
            Cookie: `token=${sellerToken}`,
          },
        });
        const getBidsBody = await getBidsRes.json();
        assert.equal(getBidsRes.status, 200);
        assert.equal(getBidsBody.success, true);
        assert.equal(getBidsBody.data.isSeller, true);
        assert(Array.isArray(getBidsBody.data.pendingRequests));
        assert.equal(getBidsBody.data.pendingRequests.length, 2);
        // Sorted highest bid first: 850 (Buyer 2), then 750 (Buyer 1)
        assert.equal(getBidsBody.data.pendingRequests[0].amount, 850);
        assert.equal(getBidsBody.data.pendingRequests[1].amount, 750);

        // 5. Seller accepts Buyer 2's offer (850)
        const acceptRes = await fetch(`${baseUrl}/api/transactions/${buyer2TxnId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${sellerToken}`,
          },
          body: JSON.stringify({
            status: "COMPLETED",
          }),
        });
        const acceptBody = await acceptRes.json();
        assert.equal(acceptRes.status, 200);
        assert.equal(acceptBody.success, true);
        assert.equal(acceptBody.data.status, "COMPLETED");
        assert.equal(acceptBody.data.amount, 850);

        // Product status must be updated to Sold
        assert.equal(mockProduct.status, "Sold");

        // Competing bid from Buyer 1 should now be auto-CANCELLED with note
        const cancelledTxn = transactionsDb.find((t) => t._id.toString() === buyer1TxnId.toString());
        assert.equal(cancelledTxn.status, "CANCELLED");
        assert.equal(cancelledTxn.notes, "Product sold to another buyer");

        // 6. Verify profile stats: boughtCount
        // Buyer 2 (Stranger) has boughtCount = 1
        const resBuyer2 = await fetch(`${baseUrl}/api/products/user/me`, {
          method: "GET",
          headers: {
            Cookie: `token=${strangerToken}`,
          },
        });
        const bodyBuyer2 = await resBuyer2.json();
        assert.equal(resBuyer2.status, 200);
        assert.equal(bodyBuyer2.success, true);
        assert.equal(bodyBuyer2.stats.boughtCount, 1);

        // Buyer 1 (whose bid was cancelled) has boughtCount = 0
        const resBuyer1 = await fetch(`${baseUrl}/api/products/user/me`, {
          method: "GET",
          headers: {
            Cookie: `token=${buyerToken}`,
          },
        });
        const bodyBuyer1 = await resBuyer1.json();
        assert.equal(resBuyer1.status, 200);
        assert.equal(bodyBuyer1.success, true);
        assert.equal(bodyBuyer1.stats.boughtCount, 0);
      });

      it("should allow seller to decline a specific bid while leaving other pending bids active", async () => {
        mockProduct.status = "Available";
        transactionsDb = [];

        // Buyer 1 bids 600
        const res1 = await fetch(`${baseUrl}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${buyerToken}`,
          },
          body: JSON.stringify({
            productId: mockProductId.toString(),
            amount: 600,
            meetupLocation: "Hostel 1",
          }),
        });
        const body1 = await res1.json();
        const buyer1TxnId = body1.data._id;

        // Buyer 2 bids 700
        const res2 = await fetch(`${baseUrl}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${strangerToken}`,
          },
          body: JSON.stringify({
            productId: mockProductId.toString(),
            amount: 700,
            meetupLocation: "Hostel 2",
          }),
        });
        const body2 = await res2.json();
        const buyer2TxnId = body2.data._id;

        // Seller declines Buyer 1's bid (status: CANCELLED)
        const declineRes = await fetch(`${baseUrl}/api/transactions/${buyer1TxnId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `token=${sellerToken}`,
          },
          body: JSON.stringify({
            status: "CANCELLED",
            notes: "Bid is too low",
          }),
        });
        const declineBody = await declineRes.json();
        assert.equal(declineRes.status, 200);
        assert.equal(declineBody.data.status, "CANCELLED");

        // Product is STILL Available
        assert.equal(mockProduct.status, "Available");

        // Buyer 2's bid is STILL PENDING
        const remainingTxn = transactionsDb.find((t) => t._id.toString() === buyer2TxnId.toString());
        assert.equal(remainingTxn.status, "PENDING");
      });
    });
  });
