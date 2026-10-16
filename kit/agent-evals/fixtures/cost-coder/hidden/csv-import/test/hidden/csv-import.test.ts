import { describe, expect, it } from "vitest";
import { parseInvoiceCsv } from "../../src/csv.ts";

const CSV = `description;supplier;quantity;unit;amount
Telinevuokra 4 vk;Ramirent Oy;4;vk;1 840,00

Valmisbetoni C30/37;Rudus Oy;18;m3;2790
Kuljetus;;;;180,5
`;

describe("parseInvoiceCsv", () => {
  it("parses rows, Finnish decimals and thousands separators", () => {
    const rows = parseInvoiceCsv(CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ description: "Telinevuokra 4 vk", supplier: "Ramirent Oy", quantity: 4, unit: "vk", amount: 1840 });
    expect(rows[1]!.amount).toBe(2790);
  });
  it("omits empty cells", () => {
    expect(parseInvoiceCsv(CSV)[2]).toEqual({ description: "Kuljetus", amount: 180.5 });
  });
});
