import { describe, expect, it } from "vitest";
import { splitVat } from "../../src/vat.ts";

describe("splitVat", () => {
  it("splits at the default 25.5% rate", () => {
    expect(splitVat(125.5)).toEqual({ net: 100, vat: 25.5 });
  });
  it("net + vat equals gross after rounding", () => {
    for (const g of [0.01, 9.99, 1840, 1234.56, 99999.99]) {
      const r = splitVat(g);
      expect(Math.round((r.net + r.vat) * 100)).toBe(Math.round(g * 100));
    }
  });
  it("supports other rates", () => {
    expect(splitVat(114, 14)).toEqual({ net: 100, vat: 14 });
  });
  it("throws on negative rates", () => {
    expect(() => splitVat(100, -1)).toThrow();
  });
});
