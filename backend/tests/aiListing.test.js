import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../server.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { geminiService } from "../services/geminiService.js";
import { validateAiListing } from "../utils/aiListingValidator.js";

describe("CampusX AI Listing Assistant & Integration Tests", () => {
  let server;
  let baseUrl;
  let validToken;
  const mockUser = {
    _id: "66e01234567890abcdef1234",
    name: "Alex Johnson",
    email: "alex@college.edu",
    phone: "9876543210",
    department: "Computer Science",
  };

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_super_secret_jwt_key_12345";
    process.env.GEMINI_API_KEY = "test_gemini_api_key";

    // Mock User.findById for auth middleware
    User.findById = async (id) => {
      if (id === mockUser._id) return mockUser;
      return null;
    };

    // Generate valid auth token
    validToken = jwt.sign({ userId: mockUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Start ephemeral server on random available port
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    if (server) server.close();
  });

  // Helper to create a fake image blob with valid magic bytes
  const createMockImageBlob = (name = "photo.jpg", type = "image/jpeg", size = 1024) => {
    const buffer = Buffer.alloc(Math.max(size, 16), 0);
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;
    buffer[3] = 0xe0;
    return new Blob([buffer], { type });
  };

  // 1. Unauthenticated request rejected (401)
  it("1. should reject unauthenticated request to AI listing endpoint with 401", async () => {
    const formData = new FormData();
    formData.append("images", createMockImageBlob(), "calc.jpg");

    const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.success, false);
    assert.match(data.message, /Not authorized/i);
  });

  // 2. No image rejected (400)
  it("2. should reject request with no images attached with 400", async () => {
    const formData = new FormData();
    formData.append("sellerContext", "Just some text without photos");

    const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /at least one image/i);
  });

  // 3. Too many images rejected (> 5)
  it("3. should reject request with more than 5 images with 400", async () => {
    const formData = new FormData();
    for (let i = 1; i <= 6; i++) {
      formData.append("images", createMockImageBlob(`img${i}.jpg`), `img${i}.jpg`);
    }

    const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /maximum of 5 images/i);
  });

  // 4. Unsupported image format rejected (400)
  it("4. should reject unsupported file format (e.g. .pdf or .txt) with 400", async () => {
    const formData = new FormData();
    const badBlob = new Blob(["test text content"], { type: "text/plain" });
    formData.append("images", badBlob, "notes.txt");

    const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /supported/i);
  });

  // 5. Valid request reaches Gemini service and receives structured data
  it("5. should successfully accept valid authenticated image request and invoke service", async () => {
    const originalService = geminiService.generateListingFromImages;
    geminiService.generateListingFromImages = async ({ files, sellerContext }) => {
      assert.equal(files.length, 1);
      assert.match(sellerContext, /charger/i);
      return {
        detectedProduct: "Casio FX-991ES Plus",
        category: "Calculators",
        condition: "Like New",
        suggestedTitle: "Casio FX-991ES Plus Scientific Calculator",
        description: "Scientific calculator in like new condition with original slide cover.",
        estimatedPriceMin: 650,
        estimatedPriceMax: 850,
        currency: "INR",
        tags: ["calculator", "casio", "engineering"],
        detectedAttributes: { brand: "Casio", model: "FX-991ES Plus" },
        confidence: 0.93,
        notes: ["Original slide cover intact"],
      };
    };

    try {
      const formData = new FormData();
      formData.append("images", createMockImageBlob("casio.jpg", "image/jpeg"), "casio.jpg");
      formData.append("sellerContext", "Includes charger and cover");

      const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: formData,
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.equal(data.data.detectedProduct, "Casio FX-991ES Plus");
      assert.equal(data.data.category, "Calculators");
      assert.equal(data.data.condition, "Like New");
      assert.equal(data.data.estimatedPriceMin, 650);
      assert.equal(data.data.estimatedPriceMax, 850);
      assert.equal(data.data.confidence, 0.93);
    } finally {
      geminiService.generateListingFromImages = originalService;
    }
  });

  // 6. Valid Gemini response validated and normalized
  it("6. should properly validate and normalize Gemini output against application schemas", () => {
    const rawAiOutput = {
      detectedProduct: "Atlas Mountain Bicycle 26T",
      category: "Cycles",
      condition: "poor", // should map to 'Old'
      suggestedTitle: "  Atlas Mountain Bicycle 26T - Good Commuter   ",
      description: "Used bicycle with 18 gears.",
      estimatedPriceMin: 1800,
      estimatedPriceMax: 2500,
      tags: ["CYCLE", "Bicycle!", "sports", "commute", "cycle"], // duplicate & lowercase test
      confidence: 0.887,
      notes: ["Tire tread is worn"],
    };

    const validated = validateAiListing(rawAiOutput);

    assert.equal(validated.detectedProduct, "Atlas Mountain Bicycle 26T");
    assert.equal(validated.category, "Cycles");
    assert.equal(validated.condition, "Old"); // successfully mapped 'poor' -> 'Old'
    assert.equal(validated.suggestedTitle, "Atlas Mountain Bicycle 26T - Good Commuter");
    assert.equal(validated.estimatedPriceMin, 1800);
    assert.equal(validated.estimatedPriceMax, 2500);
    assert.equal(validated.currency, "INR");
    assert.deepEqual(validated.tags, ["cycle", "bicycle", "sports", "commute"]);
    assert.equal(validated.confidence, 0.89);
  });

  it("6b. should fallback invalid categories to 'Others' and adjust invalid price bounds", () => {
    const invalidOutput = {
      detectedProduct: "Random Widget",
      category: "SpaceCraft", // invalid category
      condition: "Antique", // invalid condition
      suggestedTitle: "A".repeat(150), // exceeds 120 chars
      estimatedPriceMin: 500,
      estimatedPriceMax: 200, // max is lower than min
      tags: "not an array",
    };

    const validated = validateAiListing(invalidOutput);

    assert.equal(validated.category, "Others");
    assert.equal(validated.condition, "Good");
    assert.ok(validated.suggestedTitle.length <= 120);
    assert.ok(validated.estimatedPriceMax >= validated.estimatedPriceMin);
    assert.deepEqual(validated.tags, []);
  });

  // 7. Malformed Gemini response handled
  it("7. should gracefully handle malformed Gemini response", async () => {
    const originalService = geminiService.generateListingFromImages;
    geminiService.generateListingFromImages = async () => {
      const err = new Error("Gemini returned a response that could not be parsed as valid JSON");
      err.statusCode = 503;
      throw err;
    };

    try {
      const formData = new FormData();
      formData.append("images", createMockImageBlob("book.jpg"), "book.jpg");

      const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: formData,
      });

      const data = await res.json();
      assert.equal(res.status, 503);
      assert.equal(data.success, false);
      assert.match(data.message, /valid JSON/i);
    } finally {
      geminiService.generateListingFromImages = originalService;
    }
  });

  // 8. Gemini failure handled (rate limit / network)
  it("8. should handle Gemini API failure or rate limit with friendly error message", async () => {
    const originalService = geminiService.generateListingFromImages;
    geminiService.generateListingFromImages = async () => {
      const err = new Error(
        "AI service rate limit exceeded. Please wait a moment or continue manually."
      );
      err.statusCode = 429;
      throw err;
    };

    try {
      const formData = new FormData();
      formData.append("images", createMockImageBlob("gadget.jpg"), "gadget.jpg");

      const res = await fetch(`${baseUrl}/api/ai/generate-listing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: formData,
      });

      const data = await res.json();
      assert.equal(res.status, 429);
      assert.equal(data.success, false);
      assert.match(data.message, /rate limit exceeded/i);
    } finally {
      geminiService.generateListingFromImages = originalService;
    }
  });

  // 9. Normal product creation still works independently
  it("9. should ensure regular product creation continues to work independently without AI", async () => {
    const originalCreate = Product.create;
    Product.create = async (doc) => {
      return {
        _id: "66e999999999999999999999",
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    };

    try {
      const formData = new FormData();
      formData.append("title", "Engineering Mechanics Textbook");
      formData.append("description", "Standard textbook in good condition with notes.");
      formData.append("category", "Books");
      formData.append("condition", "Good");
      formData.append("price", "450");
      formData.append("location", "Library");
      formData.append("images", createMockImageBlob("book.jpg", "image/jpeg"), "book.jpg");

      const res = await fetch(`${baseUrl}/api/products`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: formData,
      });

      const data = await res.json();
      assert.equal(res.status, 201);
      assert.equal(data.success, true);
      assert.equal(data.data.title, "Engineering Mechanics Textbook");
      assert.equal(Number(data.data.price), 450);
      assert.equal(data.data.category, "Books");
      assert.equal(data.data.condition, "Good");
      assert.equal(data.data.seller.name, mockUser.name);
    } finally {
      Product.create = originalCreate;
    }
  });
});
