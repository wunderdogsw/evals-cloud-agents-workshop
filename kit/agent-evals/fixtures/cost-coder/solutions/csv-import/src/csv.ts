import type { InvoiceLine } from "./classify.ts";

const num = (s: string) => Number(s.replace(/[\s ]/g, "").replace(",", "."));

export function parseInvoiceCsv(text: string): InvoiceLine[] {
  const [header, ...rows] = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!header) return [];
  const cols = header.split(";").map((c) => c.trim());
  return rows.map((row) => {
    const cells = row.split(";");
    const line: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      const v = (cells[i] ?? "").trim();
      if (v === "") return;
      line[c] = c === "quantity" || c === "amount" ? num(v) : v;
    });
    return line as unknown as InvoiceLine;
  });
}
