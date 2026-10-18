import { expect, it } from "vitest";
import { splitVat } from "../src/vat.ts";

it("splits 125.50 into 100 + 25.50", () => {
  expect(splitVat(125.5)).toEqual({ net: 100, vat: 25.5 });
});
