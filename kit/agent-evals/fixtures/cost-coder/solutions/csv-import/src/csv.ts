import type { InvoiceLine } from "./classify.ts";

const COLUMNS = ["description", "supplier", "quantity", "unit", "amount"];

const num = (s: string) => {
  const n = Number(s.replace(/[\s\u00a0]/g, "").replace(",", "."));
  if (Number.isNaN(n)) throw new Error(`not a number: ${s}`);
  return n;
};

export function parseInvoiceCsv(text: string): InvoiceLine[] {
  const [header, ...rows] = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!header) return [];
  const cols = header.split(";").map((c) => c.trim());
  const unknown = cols.filter((c) => !COLUMNS.includes(c));
  if (unknown.length) throw new Error(`unknown column: ${unknown.join(", ")}`);
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
