# Phase 2 — Your first eval

## Overview

You'll install a small eval runner into your target, connect it to the feature, and write a golden dataset of at least 20 cases with deterministic graders. The output is a baseline score — the number every later change is compared against. The dataset is the product; the code around it is plumbing.

---

## 2.1 [LLM] Install the eval folder

> Narrate: "Installing `evals/` into your repo — a runner, a skeleton suite, nothing else."

```bash
pnpm workshop install <name> evals --suite <suite>
```

Show the resulting tree of `targets/<name>/evals/` (2 levels). Point out: `runner/` is vendored and not theirs to edit; `suites/<suite>/` is theirs.

Check the new folder doesn't break the target's own tooling, and fix what applies:
- a root `tsconfig.json` that includes everything → add `"evals"` to `exclude` (the runner uses `.ts` import extensions);
- ESLint/Prettier → ignore `evals/`;
- a root `pnpm-workspace.yaml` with a broad glob → add `'!evals'`;
- TS path aliases in feature code → run evals with `TSX_TSCONFIG_PATH=../tsconfig.json`.

If `evalSubject` is `sample-feature`, also run:

```bash
pnpm workshop install <name> subject-cost-coder
```

## 2.2 [LLM] Connect the task adapter

Edit `evals/suites/<suite>/suite.ts` so `task` calls the real feature. Pick by profile:

- **TypeScript/JavaScript target feature** → import the function directly from the target's `src/` (relative path from the suite file). Make sure the target's own `node_modules` is installed.
- **Other languages** → `shellTask("<command that reads JSON on stdin and prints JSON>")`. If no such entry point exists, write the smallest possible one in the target (a CLI flag, a console app, a test-only `main`) and say so. Keep it out of production code paths.
- **A running service** → `httpTask(url)`; note that the eval needs the service running.
- **`sample-feature`** → `import { classifyLine } from "../../subject/cost-coder/classify.ts"` and `task: (input) => classifyLine(input)`.

Replace the placeholder in `cases.jsonl` with **one** real case (right input shape), then smoke-test:

```bash
pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --limit 1 --label smoke
```

If that fails, fix the adapter before the participant writes a single case.

## 2.3 [HUMAN] Write the dataset

This is theirs. Explain the format in three lines, then step back:

```jsonl
{"id":"short-stable-name","input":{…what the feature receives…},"expected":{…the right answer…},"tags":["edge"],"note":"why this case exists"}
```

Coach them toward a dataset that *argues*:

- **Typical cases** (~40%) — what the feature sees every day.
- **Edge and ambiguous cases** (~40%) — the ones they'd argue about with a colleague. These are where evals pay off.
- **Must-not-fail cases** — tag them `critical`. Phase 5 can gate on them.
- **"Honest I-don't-know" cases** — inputs where the right answer is to refuse, ask, or route to review.

For `cost-coder`: `samples/cost-coder/data/invoice-lines.jsonl` is an unlabelled pool and `data/seed-cases.jsonl` shows 8 labelled examples. They may copy the seeds, but at least 12 of the 20 must be cases **they** wrote or labelled.

Target: **≥ 20 cases**, ≥ 3 tags, every ambiguous case has a `note`.

You may: point out gaps in coverage ("nothing with a negative amount?"), flag duplicates, and check JSON validity. You may not: write cases for them unless they explicitly ask, and even then propose ≤ 3 and make them edit.

## 2.4 [LLM] Add deterministic graders

Wire graders that need no model:

- `hasShape({...})` first — catches broken parsing early.
- `exactMatch(field)` or `oneOf(field, "acceptable")` for fields with a right answer. If any case has several acceptable answers, use a `custom` grader that accepts `expected.<field>` or any of `expected.acceptable` (show the 4-line version).
- `includes` / `excludes` / `matches` where they apply (required terms, forbidden content, formats).

Explain in one sentence each why these come before any LLM judge: free, fast, deterministic, no calibration needed.

## 2.5 [LLM] Baseline run

```bash
pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --label baseline
```

Walk through the summary: pass rate, per-grader, per-tag, failures. Report the cost line — note it only counts what reports cost (the judge, or a task that returns `{ output, costUsd }`); a direct-import feature's own model calls aren't included unless you return them.

## 2.6 [HUMAN] Read the failures

Ask them to open 3 failures and decide for each: **feature wrong**, **case wrong**, or **grader too strict**. Fix cases/graders accordingly (not the feature — that's Phase 4) and re-run once.

This is the first lesson of the day; say it out loud: *a failing eval is a question, not a verdict.*

## Gate 2

Verify yourself:

- [ ] `evals/suites/<suite>/cases.jsonl` has ≥ 20 cases and ≥ 3 distinct tags
- [ ] A run labelled `baseline` exists in `evals/.eval-runs/` with 0 task errors
- [ ] The participant can state the baseline pass rate and name one failure category

Commit on the workshop branch:

```bash
git -C targets/<name> add evals && git -C targets/<name> commit -m "evals: baseline suite for <suite>"
```

---

## Phase Complete

Mark Phase 2 complete. Preview: "Phase 3 — some things you can't grade with string matching. You'll build an LLM judge and then find out whether to trust it."
