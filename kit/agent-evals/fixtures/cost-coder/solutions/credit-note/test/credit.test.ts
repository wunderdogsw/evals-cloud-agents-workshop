import { expect, it } from "vitest";
import { isCreditNote } from "../src/credit.ts";

it("treats a negative amount as a credit note", () => {
  expect(isCreditNote({ description: "Sähkö", amount: -10 } as any)).toBe(true);
});
