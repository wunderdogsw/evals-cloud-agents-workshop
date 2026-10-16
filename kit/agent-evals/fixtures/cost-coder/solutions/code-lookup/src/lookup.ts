import { COST_CODES, isCostCode, type CostCode } from "./codes.ts";

export function describeCode(code: string): string {
  if (!isCostCode(code)) throw new Error(`unknown cost code ${code}`);
  return COST_CODES[code];
}

export function searchCodes(query: string): CostCode[] {
  const q = query.toLowerCase();
  return (Object.keys(COST_CODES) as CostCode[]).filter((k) => COST_CODES[k].toLowerCase().includes(q));
}
