# @workshop/agent-evals

Benchmark coding agents on tasks replayed from a repository's own history.

For each task: a **history-free snapshot** of the base commit (so the agent can't `git show` the answer) → setup →
agent → diff → **hidden tests** copied in → test command decides pass/fail. Results use the eval kit's format, so
`pnpm evals compare` works across agents, models and AGENTS.md versions.

```bash
pnpm agent-evals mine <repo> --test-command "npx vitest run {files}" --since "12 months ago"
pnpm agent-evals validate <repo> --tasks tasks.jsonl --setup "pnpm install"
pnpm agent-evals run <repo> --tasks tasks.jsonl --agent claude --max-budget-usd 2 --label baseline
```

Task format (`tasks.jsonl`):

```json
{"id":"…","base":"<sha|HEAD>","prompt":"issue-style task","testCommand":"… {files}",
 "hiddenTests":{"paths":["test/foo.test.ts"]} | {"dir":"hidden/foo"},
 "reference":"<sha>" | "referenceDir":"solutions/foo"}
```

Agents: `claude` (Claude Code headless, `acceptEdits`, Bash allowed, turn + budget caps), `cursor` (Cursor CLI `agent -p --force`,
needs `CURSOR_API_KEY`), `noop` (baseline). Agents run with real tool access inside throwaway workspaces under
`.agent-runs/` — run on a machine/container you're comfortable with.

`fixtures/cost-coder/` holds 5 validated tasks (hidden tests + reference solutions) for the sample target.
