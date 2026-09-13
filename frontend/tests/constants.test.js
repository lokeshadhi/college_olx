import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, CONDITIONS, YEARS, SORT_OPTIONS } from "../src/utils/constants.js";

describe("Frontend Core Constants Test Suite", () => {
  it("should contain standard campus marketplace categories", () => {
    assert.ok(Array.isArray(CATEGORIES));
    assert.ok(CATEGORIES.includes("Books"));
    assert.ok(CATEGORIES.includes("Electronics"));
    assert.ok(CATEGORIES.includes("Cycles"));
    assert.ok(CATEGORIES.includes("Calculators"));
    assert.ok(CATEGORIES.includes("Others"));
  });

  it("should contain standard item conditions", () => {
    assert.ok(Array.isArray(CONDITIONS));
    assert.deepEqual(CONDITIONS, ["New", "Like New", "Good", "Fair", "Old"]);
  });

  it("should contain standard college year designations", () => {
    assert.ok(Array.isArray(YEARS));
    assert.equal(YEARS.length, 5);
    assert.equal(YEARS[0], "1st Year");
  });

  it("should define standard sort options", () => {
    assert.ok(Array.isArray(SORT_OPTIONS));
    const values = SORT_OPTIONS.map((opt) => opt.value);
    assert.ok(values.includes("newest"));
    assert.ok(values.includes("price_low"));
  });
});
