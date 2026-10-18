# @workshop/agent-evals

Run a coding agent on tasks made from a repository's own merged changes, and grade the result.

For each task: a copy of the files at the base commit, **without git history** (so the agent can't look up the real
solution) → setup → agent → diff → **hidden tests** (the tests from the real change, which the agent never sees) are
copied in → the test command decides pass or fail. Results use the eval kit's format, so `pnpm evals compare` works
across agents, models and versions of the agent files.

```bash
pnpm agent-evals mine <repo> --test-command "npx vitest run {files}" --since "12 months ago"
pnpm agent-evals validate <repo> --tasks tasks.jsonl --setup "pnpm install"
pnpm agent-evals run <repo> --tasks tasks.jsonl --agent claude --max-budget-usd 2 --label baseline-with
pnpm agent-evals run <repo> --tasks tasks.jsonl --agent claude --without-setup --label baseline-without
pnpm agent-evals regrade baseline-with baseline-without --rules rules.mjs --judge R5=rubric-r5.md --label judged
pnpm agent-evals label baseline-with baseline-without --out labels-r5.jsonl --rule "R5: …"
pnpm evals calibrate judged --labels labels-r5.jsonl --grader judge:R5
pnpm agent-evals grade-patch <repo> --tasks tasks.jsonl --task <id> --patch planted.diff --rules rules.mjs
pnpm agent-evals run <repo> --tasks tasks.jsonl --agent claude --record <repo>/evals/suites/agent
```

## The agent setup

Every task runs with the agent files (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/`, `.mcp.json`, at any depth)
committed at the target's `HEAD`, even when the task's base commit is older: the run measures the setup you have now.
Claude Code runs with `--setting-sources project,local`, so your own `~/.claude` settings stay out.

`--without-setup` removes those files from the workspace and runs Claude Code with `--safe-mode` (no CLAUDE.md,
skills, hooks, MCP, plugins or auto memory). Compare the two runs to see what the setup adds.
Cursor has no equivalent flag: only the files are removed, so your Cursor user rules still apply.

`evals/suites/agent/` in the target is removed from every workspace: the agent never sees rules, rubrics or recordings.

## Rules and judges

- `--rules rules.mjs` — deterministic graders over the diff, one per rule, reported as `rule:<name>`.
  The file default-exports `[{ name, description?, tasks?, grade(ctx) }]` and imports nothing;
  see `src/rules.ts` for `ctx` (`changes`, `touched(glob)`, `added(glob)`, `patch`, `run(cmd)`).
- `--judge R5=rubric-r5.md` — an LLM judge over the diff, reported as `judge:R5`. Optional frontmatter
  `tasks: a, b` limits it to those tasks.
- `regrade` re-grades stored patches without running the agent. With two or more runs, ids become
  `<run label>/<task>`, and `label` uses the same ids, so `pnpm evals calibrate` lines them up.
- `pnpm evals compare a b` lists per-grader regressions: a rule that broke inside a task that still passes.

## Recording for CI

`run --record <dir>` reads `<dir>/agent-suite.json` (rules, judges, threshold, tracked agent files), refuses
uncommitted tracked files, runs every task, and writes `<dir>/last-run.json` with SHA-256 fingerprints.
In CI, `pnpm verify suites/agent` (vendored runner, no model) fails when a tracked file changed since,
or the recording missed the threshold. Install with `pnpm workshop install <name> agent-suite ci-agent-evals`.

Task format (`tasks.jsonl`):

```json
{"id":"…","base":"<sha|HEAD>","prompt":"issue-style task","testCommand":"… {files}",
 "hiddenTests":{"paths":["test/foo.test.ts"]} | {"dir":"hidden/foo"},
 "reference":"<sha>" | "referenceDir":"solutions/foo"}
```

Agents: `claude` (Claude Code headless, `acceptEdits`, Bash allowed, turn + budget caps, no session persistence), `cursor` (Cursor CLI `agent -p --force`,
needs `CURSOR_API_KEY`), `noop` (baseline). Agents run with real tool access inside throwaway workspaces under
`.agent-runs/` — run on a machine/container you're comfortable with.

`fixtures/cost-coder/` holds 5 validated tasks (hidden tests + reference solutions) for the sample target.
