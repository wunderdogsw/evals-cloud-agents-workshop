import { describe, expect, it } from "vitest";
import { describeCode, searchCodes } from "../../src/lookup.ts";

describe("lookup", () => {
  it("describes a known code", () => expect(describeCode("1500")).toBe("Roofing"));
  it("throws on unknown", () => expect(() => describeCode("7777")).toThrow());
  it("searches case-insensitively", () => {
    expect(searchCodes("SCAFFOLD")).toEqual(["3100"]);
    expect(searchCodes("concrete")).toContain("1200");
  });
  it("returns empty for no match", () => expect(searchCodes("zzz")).toEqual([]));
});
