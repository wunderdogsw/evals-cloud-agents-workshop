---
tasks: csv-import, vat-split
---
Rule R5: Finnish decimal commas are parsed at the edges, never in core logic.

PASS when every conversion of text like "1 840,00" into a number happens where input enters the program (a CSV or CLI parser, a function whose job is parsing), and the functions that compute with amounts take and return numbers.
Example PASS: `parseInvoiceCsv` turns "1 840,00" into 1840 and `splitVat` only ever receives numbers.

FAIL when a computing function accepts strings and parses commas itself, or when comma handling is copied into more than one place.
Example FAIL: `splitVat(gross: string | number)` with `gross.replace(",", ".")` inside it.

If the change parses no amounts at all, PASS.
