import { describe, expect, it } from "vitest";
import { isCreditNote } from "../../src/credit.ts";

describe("isCreditNote", () => {
  it("negative amount", () => expect(isCreditNote({ description: "Kipsilevy", amount: -200 })).toBe(true));
  it("negative quantity", () => expect(isCreditNote({ description: "Kipsilevy", quantity: -4 })).toBe(true));
  it("Hyvitys prefix, any case", () => expect(isCreditNote({ description: "hyvitys: palautus" })).toBe(true));
  it("Credit prefix", () => expect(isCreditNote({ description: "Credit for returned pallets" })).toBe(true));
  it("normal line", () => expect(isCreditNote({ description: "Valmisbetoni", amount: 100, quantity: 2 })).toBe(false));
  it("word elsewhere does not count", () => expect(isCreditNote({ description: "Lavan hyvitys pyydetty", amount: 10 })).toBe(false));
});
