# Phase 7 — Build agent tasks from your history

## What you do

1. **Mine candidates** — `pnpm agent-evals mine` searches git history for merged changes that touched tests and lists them as tasks the agent can repeat.
2. **Curate 5–10 tasks** — choose tasks that test your five rules, and write each task prompt yourself, in the form of an issue.
3. **Validate the tasks** — `pnpm agent-evals validate` checks that the hidden tests fail before the change and pass with it.

## Gate

- [ ] At least 5 tasks pass validation.
- [ ] Each task is mapped to at least one picked rule in `expectations.md`.

## Learning point

Tasks from your own merged changes measure the agent better than a public benchmark (a shared, standard set of test tasks). The tests in each change already define what "done" meant in this repo.

## Wanted outcome

You have a tasks file with 5–10 validated tasks, each mapped to the rules it tests, and Phase 8 uses it for the baseline runs.

---

## 7.1 Mine candidates

### [LLM]

> Narrate: "A task is a change that was merged into the repo. We reset the code to the commit before it and give the agent the issue. Then we grade the result with the tests that came with the real change. These are the hidden tests: the agent never sees them."

Read the test command in the profile. Choose a test command that runs **only** the given test files, with `{files}` where the file names go: `npx vitest run {files}`, `pytest {files}`, `go test {files}`. For .NET, filter by test class names instead, and explain what that costs: the filter may run more or fewer tests than the change added.

```bash
pnpm agent-evals mine targets/<name> --test-command "<cmd with {files}>" --since "12 months ago" --limit 30 \
  --out .workshop/targets/<name>/tasks.candidates.jsonl
```

Mining only reads git history. It changes nothing in the target. Show the candidates as a short table: id, files, lines changed, commit subject.

### [HUMAN]

They read the candidate list and mark the changes they remember. A good one is a change that they or a colleague made, and whose purpose they could still explain as an issue.

### [BRANCH]

- **Target is `sample`** → there's no history to mine. Install the prepared tasks instead:

  ```bash
  pnpm workshop install <name> agent-tasks
  ```

  The tasks are written to `.workshop/targets/<name>/agent-tasks/tasks.jsonl`. The hidden tests and reference solutions (the real changes) are next to them, outside the target.
- **Facilitators committed curated tasks** to `kit/profiles/<name>.tasks.jsonl` → offer those as the candidates.
- **Fewer than 5 candidates** → use an earlier date in `--since`, or make the test-file filter less strict. If there are still fewer than 5, use the sample's tasks for Phase 8. Keep their own tasks as an optional extra task.

## 7.2 Curate 5–10 tasks

### [HUMAN]

They choose 5–10 candidates. They **rewrite each `prompt` as an issue a colleague would file**. The prompt describes the problem and the acceptance criteria. It does not describe the solution, and it is not the commit message. They remove the `meta` field and save the result as `.workshop/targets/<name>/tasks.jsonl`.

Good tasks are small and self-contained. Their tests check behaviour, not implementation details. Prefer tasks where the agent could break one of the five picked rules. Examples: adding a module (for a "tests added" rule), touching protected files, putting logic in the wrong layer.

Then they fill the **Tasks** column in `expectations.md`. For each picked rule, they list the ids of the tasks that test it.

Review two prompts against the diff of the real change. Check two things: does the prompt reveal the solution, and does it leave out something the hidden tests need?

### [BRANCH]

- **Target is `sample`** → they read the five prompts and can make one more precise if they want. They map the ids (`vat-split`, `credit-note`, `csv-import`, `code-lookup`, `temp-power`) to their rules.

## 7.3 Validate the tasks

### [LLM]

```bash
pnpm agent-evals validate targets/<name> --tasks <tasks-file> --setup "<install command>"
```

`<tasks-file>` is `.workshop/targets/<name>/tasks.jsonl`, or `.workshop/targets/<name>/agent-tasks/tasks.jsonl` for the sample. Every task must pass two checks. First, the hidden tests must **fail at its base**, the commit before the change. If they pass there, the task measures nothing. Second, the hidden tests must **pass with the reference**, the real change. If they fail, the hidden tests need something the prompt doesn't describe, or the environment is broken.

### [HUMAN]

They decide what to do with each ❌ task: fix the prompt, fix the test command, or drop the task. They run validation again until at least 5 tasks pass. If they dropped any task, they update the Tasks column.

## 7.4 Gate check

The participant confirms each item, and you verify it:

- [ ] At least 5 tasks pass validation. — the last `pnpm agent-evals validate` output
- [ ] Each task is mapped to at least one picked rule in `expectations.md`. — every task id from the tasks file appears in the Tasks column of a picked row

---

## Phase Complete

Mark Phase 7 complete. Preview: "Phase 8 — run the agent on these tasks twice, once with your setup and once without it, to see what the setup adds."
