# Phase 7 — Build agent tasks from your history

## What you do

1. **Mine candidates** — `pnpm agent-evals mine` lists merged changes that touched tests, as replayable tasks.
2. **Curate 5–10 tasks** — pick ones that exercise your five rules, and write each task prompt yourself, as an issue.
3. **Validate the tasks** — `pnpm agent-evals validate`: the hidden tests fail before the change and pass with it.

## Gate

- [ ] At least 5 tasks pass validation.
- [ ] Each task is mapped to at least one picked rule in `expectations.md`.

## Learning point

Your own merged history is a better benchmark than any public one. Its hidden tests already say what "done" meant in this repo.

## Wanted outcome

A tasks file with 5–10 validated tasks, each mapped to the rules it exercises, ready for the baseline runs in Phase 8.

---

## 7.1 Mine candidates

### [LLM]

> Narrate: "A task is a change that really landed: we rewind to the commit before, hand the agent the issue, and grade with the tests that came with the real change. The agent never sees those tests."

Read the profile's test command. Pick a test command that runs **only** the given test files, with `{files}` where they go: `npx vitest run {files}`, `pytest {files}`, `go test {files}`. For .NET, filter by test class names instead, and explain the trade-off.

```bash
pnpm agent-evals mine targets/<name> --test-command "<cmd with {files}>" --since "12 months ago" --limit 30 \
  --out .workshop/targets/<name>/tasks.candidates.jsonl
```

Mining only reads git history; it changes nothing in the target. Show the candidates as a short table: id, files, lines changed, commit subject.

### [HUMAN]

They read the candidate list and mark the ones they remember: a change they or a colleague made, whose intent they could still explain as an issue.

### [BRANCH]

- **Target is `sample`** → there's no history to mine. Install the prepared tasks instead:

  ```bash
  pnpm workshop install <name> agent-tasks
  ```

  The tasks land in `.workshop/targets/<name>/agent-tasks/tasks.jsonl`, with hidden tests and reference solutions next to them, outside the target.
- **Facilitators committed curated tasks** to `kit/profiles/<name>.tasks.jsonl` → offer those as the candidates.
- **Fewer than 5 candidates** → widen `--since`, or relax the test-file filter. If it's still under 5, use the sample's tasks for Phase 8 and keep their own as a stretch.

## 7.2 Curate 5–10 tasks

### [HUMAN]

They pick 5–10 candidates and **rewrite each `prompt` as an issue a colleague would file**: the problem and the acceptance criteria, not the solution, and not the commit message. They remove the `meta` field and save the result as `.workshop/targets/<name>/tasks.jsonl`.

Good tasks are small, self-contained, and have tests that check behaviour rather than implementation details. Prefer tasks where the agent has a chance to break one of the five picked rules: adding a module (a "tests added" rule), touching protected files, putting logic in the wrong layer.

Then they fill the **Tasks** column in `expectations.md`: for each picked rule, the task ids that exercise it.

Review two prompts against the diff of the real change: does the prompt give away the solution, or leave out something the hidden tests need?

### [BRANCH]

- **Target is `sample`** → they read the five prompts, sharpen one if they like, and map the ids (`vat-split`, `credit-note`, `csv-import`, `code-lookup`, `temp-power`) to their rules.

## 7.3 Validate the tasks

### [LLM]

```bash
pnpm agent-evals validate targets/<name> --tasks <tasks-file> --setup "<install command>"
```

`<tasks-file>` is `.workshop/targets/<name>/tasks.jsonl`, or `.workshop/targets/<name>/agent-tasks/tasks.jsonl` for the sample. Every task must **fail at its base** (otherwise it measures nothing) and **pass with the reference** (otherwise the hidden tests need something the prompt doesn't describe, or the environment is broken).

### [HUMAN]

They decide what happens to each ❌ task: fix the prompt, fix the test command, or drop it. They re-run validation until at least 5 pass, and update the Tasks column if they dropped any.

## 7.4 Gate check

The participant confirms, and you verify:

- [ ] At least 5 tasks pass validation. — the last `pnpm agent-evals validate` output
- [ ] Each task is mapped to at least one picked rule in `expectations.md`. — every task id from the tasks file appears in the Tasks column of a picked row

---

## Phase Complete

Mark Phase 7 complete. Preview: "Phase 8 — run the agent on these tasks twice, with your setup and without it, to see what the setup adds."
