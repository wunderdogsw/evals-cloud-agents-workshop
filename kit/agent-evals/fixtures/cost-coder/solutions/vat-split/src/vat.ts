export function splitVat(gross: number, ratePercent = 25.5): { net: number; vat: number } {
  if (ratePercent < 0) throw new Error("VAT rate must be >= 0");
  const grossCents = Math.round(gross * 100);
  const netCents = Math.round(grossCents / (1 + ratePercent / 100));
  return { net: netCents / 100, vat: (grossCents - netCents) / 100 };
}
