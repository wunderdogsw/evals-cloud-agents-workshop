# evals/

Eval suites for this repository.

```bash
cd evals
pnpm install                     # or: npm install
pnpm eval suites/<name>/suite.ts # writes .eval-runs/<timestamp>-<name>/
pnpm compare latest~1 latest     # what got better, what regressed
pnpm label latest                # hand-label outputs PASS/FAIL
pnpm calibrate latest --labels suites/<name>/labels.jsonl --grader judge
```

- `runner/` — vendored eval runner (do not edit here; update from the workshop kit).
- `suites/<name>/suite.ts` — task + graders + threshold.
- `suites/<name>/cases.jsonl` — the dataset. This is the valuable part.

`ANTHROPIC_API_KEY` is read from the environment or a `.env` in this folder or any parent. `EVALS_MOCK=1` runs offline fakes.
