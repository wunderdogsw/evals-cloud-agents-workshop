# @workshop/evals

A small eval runner. It is short on purpose, so you can read all of it and see exactly what it does.

The agent evals (`kit/agent-evals`) use it for judges, `compare`, `calibrate`, `record` and `verify`. The suite format below is for evals of an app's own LLM feature.

```ts
import { defineSuite, exactMatch, hasShape, llmJudge, shellTask } from "./runner/index.ts";

export default defineSuite({
  name: "my-feature",
  cases: "./cases.jsonl",                     // {"id","input","expected","tags","note"} per line
  task: shellTask("dotnet run --project Cli -- --json"),   // or a direct import, or httpTask(url)
  graders: [hasShape({ answer: "string" }), exactMatch("answer"), llmJudge({ rubric })],
  threshold: { passRate: 0.8, graders: { "exact:answer": 0.9 } },
});
```

| Command | |
|---|---|
| `evals run <suite.ts> [--tag t] [--id a,b] [--limit n] [--trials n] [--label x] [--threshold]` | Run; writes `results.json`, `summary.md`, `junit.xml`. `--threshold` exits 1 when not met |
| `evals compare <a> <b> [--fail-on-regression]` | Regressions (pass → fail), fixes, grader deltas, cost |
| `evals label <run> --out labels.jsonl` | Blind PASS/FAIL labelling in the terminal |
| `evals calibrate <run> --labels labels.jsonl --grader judge` | Judge vs human: agreement, Cohen's κ, confusion matrix, disagreements |
| `evals run <suite.ts> --record` | Full run → `last-run.json` next to the suite: results + SHA-256 of the suite folder and `tracks` files |
| `evals verify <suite.ts> [--junit f]` | The CI gate, no model: recording fresh, real, full, over threshold |

Run refs: a `results.json`, a run directory, `latest`, `latest~1`, …

Graders: `exactMatch`, `oneOf`, `includes`, `excludes`, `matches`, `numericClose`, `hasShape`, `custom`, `llmJudge`.
Task adapters: direct function, `shellTask`, `httpTask`.

Model calls: `EVALS_PROVIDER=claude-code` (Claude Code login, `claude -p --json-schema`), `cursor` (Cursor CLI login, `agent -p`), or `api` (`ANTHROPIC_API_KEY`); default = auto-detect.

`EVALS_MOCK=1` replaces judge calls with offline fakes (and the sample app's classifier with a keyword heuristic).
Models: `src/models.ts` (`EVAL_TASK_MODEL`, `EVAL_JUDGE_MODEL`, `EVAL_AGENT_MODEL` override).

This package is the source of truth. `pnpm workshop install <target> evals` vendors `src/` into `<target>/evals/runner/`.
