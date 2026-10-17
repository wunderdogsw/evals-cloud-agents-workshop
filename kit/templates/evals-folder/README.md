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
- `suites/<name>/cases.jsonl` — the dataset. This is the most important part.
- `suites/agent/` — the agent evals: rule graders, judge rubrics, thresholds and the recording CI checks (see its README).

To check the agent eval recording the same way CI does: `pnpm verify suites/agent`.

Model calls use whichever CLI you're logged in to: Claude Code (`claude -p`) or Cursor (`agent -p`) — no API key. Force one with `EVALS_PROVIDER=claude-code|cursor` (or `api` + `ANTHROPIC_API_KEY`). Settings are read from the environment or a `.env` in this folder or any parent. `EVALS_MOCK=1` runs offline fakes.

## The CI gate

CI never calls a model. Record a full run locally and commit it:

```bash
pnpm eval suites/<name>/suite.ts --record   # → suites/<name>/last-run.json (results + file fingerprints)
pnpm verify suites/<name>/suite.ts          # exactly what CI runs
```

`verify` fails if the suite folder or any `tracks` file (the feature's prompt/code) changed since the recording, if it was a mock or partial run, or if it missed the threshold.
