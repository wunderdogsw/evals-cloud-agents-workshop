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

Model calls go through your Claude Code login by default (`claude -p`, no API key). `EVALS_PROVIDER=cursor` uses the Cursor CLI, `EVALS_PROVIDER=api` uses `ANTHROPIC_API_KEY`. Settings are read from the environment or a `.env` in this folder or any parent. In CI, set `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`). `EVALS_MOCK=1` runs offline fakes.
