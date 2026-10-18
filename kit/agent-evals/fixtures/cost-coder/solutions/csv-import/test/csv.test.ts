import { expect, it } from "vitest";
import { parseInvoiceCsv } from "../src/csv.ts";

it("parses a Finnish decimal comma", () => {
  const [line] = parseInvoiceCsv("description;supplier;quantity;unit;amount\nBetoni;Rudus;1;m3;1 840,00\n");
  expect(line!.amount).toBe(1840);
});
