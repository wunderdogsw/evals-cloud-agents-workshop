import { describe, expect, it } from "vitest";
import { formatLine, mockClassify, parseClassification } from "../src/classify.ts";

describe("parseClassification", () => {
  it("accepts a valid result and clamps confidence", () => {
    expect(parseClassification({ costCode: "1200", confidence: 1.4, rationale: "concrete" })).toEqual({ costCode: "1200", confidence: 1, rationale: "concrete" });
  });
  it("rejects unknown codes", () => {
    expect(() => parseClassification({ costCode: "7777", confidence: 0.5, rationale: "" })).toThrow(/invalid cost code/);
  });
});

describe("formatLine", () => {
  it("includes optional fields when present", () => {
    expect(formatLine({ description: "Valmisbetoni C30/37", quantity: 12, unit: "m3", amount: 1980 })).toBe(
      "Description: Valmisbetoni C30/37\nQuantity: 12 m3\nAmount: 1980.00 EUR",
    );
  });
});

describe("mockClassify", () => {
  it("routes scaffolding rental to 3100", () => {
    expect(mockClassify({ description: "Telinevuokra 4 vk" }).costCode).toBe("3100");
  });
  it("falls back to 9000", () => {
    expect(mockClassify({ description: "Sekalaista" }).costCode).toBe("9000");
  });
});
