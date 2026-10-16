# Backlog — cost-coder

Paste these into GitLab/GitHub issues on Day 2. Each one is small enough for a cloud agent.

## 1. VAT split helper
Add `splitVat(gross: number, ratePercent = 25.5): { net: number; vat: number }` in `src/vat.ts`. Round both to cents. `net + vat` must equal `gross` exactly after rounding (put any rounding difference into `vat`). Throw on negative rates.

## 2. Detect credit notes
Add `isCreditNote(line: InvoiceLine): boolean` in `src/credit.ts`. True when `amount < 0`, `quantity < 0`, or the description starts with "Hyvitys" / "Credit" (case-insensitive).

## 3. Import invoice lines from CSV
Add `parseInvoiceCsv(text: string): InvoiceLine[]` in `src/csv.ts`. Semicolon-separated, header row `description;supplier;quantity;unit;amount`, Finnish decimal commas (`1 840,00`), empty cells → field omitted. Skip blank lines.

## 4. Cost-code lookup
Add `describeCode(code: string): string` (throws on unknown code) and `searchCodes(query: string): CostCode[]` (case-insensitive substring match on the label) in `src/lookup.ts`.

## 5. Temporary site power is a site facility
`mockClassify` sends "Sähköliittymä työmaalle, väliaikainen" to 2300 (electrical). Temporary site power and water belong to 3200. Fix the rules without breaking existing tests.

## 6. Low-confidence routing (open-ended)
When the model's confidence is below a threshold, return `9000` with the original suggestion in the rationale. Make the threshold configurable. Measure the effect with the eval suite before and after.

## 7. Finnish rationales (open-ended)
Site managers read the rationale. Make it Finnish when the invoice line is Finnish. Add a judge rubric to the eval suite that checks it.
