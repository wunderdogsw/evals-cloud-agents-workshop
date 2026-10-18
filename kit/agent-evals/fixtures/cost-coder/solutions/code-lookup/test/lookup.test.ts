import { expect, it } from "vitest";
import { describeCode } from "../src/lookup.ts";

it("throws on an unknown code", () => {
  expect(() => describeCode("nope")).toThrow();
});
