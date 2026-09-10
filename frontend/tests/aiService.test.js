import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateAiListing } from "../src/services/aiService.js";
import api from "../src/services/api.js";

describe("Frontend AI Service & Form Integration Logic", () => {
  it("should format FormData properly and invoke /ai/generate-listing", async () => {
    const originalPost = api.post;

    let capturedUrl = "";
    let capturedFormData = null;
    let capturedHeaders = null;

    api.post = async (url, formData, config) => {
      capturedUrl = url;
      capturedFormData = formData;
      capturedHeaders = config?.headers;
      return {
        data: {
          success: true,
          data: {
            detectedProduct: "Casio FX-991ES Plus",
            category: "Calculators",
            condition: "Like New",
            suggestedTitle: "Casio FX-991ES Plus Scientific Calculator",
            description: "Calculator in like new condition.",
            estimatedPriceMin: 650,
            estimatedPriceMax: 850,
            currency: "INR",
            tags: ["calculator", "casio"],
            confidence: 0.92,
          },
        },
      };
    };

    try {
      const mockFile1 = new Blob(["fake-image-bytes-1"], { type: "image/jpeg" });
      const mockFile2 = new Blob(["fake-image-bytes-2"], { type: "image/png" });
      const imageFiles = [mockFile1, mockFile2];
      const context = "Bought 1 year ago, includes cover";

      const result = await generateAiListing(imageFiles, context);

      assert.equal(capturedUrl, "/ai/generate-listing");
      assert.equal(capturedHeaders?.["Content-Type"], "multipart/form-data");
      assert.ok(capturedFormData instanceof FormData);
      assert.equal(capturedFormData.getAll("images").length, 2);
      assert.equal(capturedFormData.get("sellerContext"), context);

      assert.equal(result.detectedProduct, "Casio FX-991ES Plus");
      assert.equal(result.category, "Calculators");
      assert.equal(result.estimatedPriceMin, 650);
      assert.equal(result.estimatedPriceMax, 850);
      assert.equal(result.confidence, 0.92);
    } finally {
      api.post = originalPost;
    }
  });

  it("should omit sellerContext from FormData if empty or whitespace only", async () => {
    const originalPost = api.post;
    let capturedFormData = null;

    api.post = async (url, formData) => {
      capturedFormData = formData;
      return {
        data: {
          success: true,
          data: {
            detectedProduct: "Generic Textbook",
            category: "Books",
            condition: "Good",
            suggestedTitle: "Engineering Textbook",
            description: "Good condition.",
            estimatedPriceMin: 300,
            estimatedPriceMax: 450,
            currency: "INR",
            tags: ["books"],
            confidence: 0.85,
          },
        },
      };
    };

    try {
      const mockFile = new Blob(["img-data"], { type: "image/jpeg" });
      await generateAiListing([mockFile], "   ");

      assert.equal(capturedFormData.get("sellerContext"), null);
    } finally {
      api.post = originalPost;
    }
  });

  it("should propagate backend error message when AI service fails", async () => {
    const originalPost = api.post;

    api.post = async () => {
      throw new Error("AI analysis is temporarily unavailable. You can continue creating your listing manually.");
    };

    try {
      const mockFile = new Blob(["img-data"], { type: "image/jpeg" });
      await assert.rejects(
        async () => {
          await generateAiListing([mockFile]);
        },
        {
          name: "Error",
          message: "AI analysis is temporarily unavailable. You can continue creating your listing manually.",
        }
      );
    } finally {
      api.post = originalPost;
    }
  });
});
