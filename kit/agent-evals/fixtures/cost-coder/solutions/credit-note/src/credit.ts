import type { InvoiceLine } from "./classify.ts";

export function isCreditNote(line: InvoiceLine): boolean {
  if ((line.amount ?? 0) < 0 || (line.quantity ?? 0) < 0) return true;
  return /^\s*(hyvitys|credit)\b/i.test(line.description);
}
