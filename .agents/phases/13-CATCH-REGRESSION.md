# Phase 13 — Catch a regression

## What you do

1. **Read the comparison by rule** — the per-grader section of `pnpm evals compare`, not the headline pass rate.
2. **Make a regression on purpose** — loosen one rule or hook in a commit, then run the agent again.
3. **Explain and record it** — what broke and why in `CHANGELOG.md`, then revert the loosening.

## Gate

- [ ] A per-grader regression is found and explained, or its absence is explained with the task that would expose it.
- [ ] `CHANGELOG.md` records the loosening, the numbers and the explanation.
- [ ] The loosening is reverted with a commit.

## Learning point

A pass rate can go up while the rule you care about breaks. Read the comparison per rule, every time.

## Wanted outcome

A recorded regression, or a recorded gap in the tasks, and the habit of reading comparisons per rule before Phase 14 gates on them.

---

## 13.1 Read the comparison by rule

### [LLM]

> Narrate: "The headline number is the least useful line in the comparison. Let's read the rest."

Show the Phase 12 comparison again:

```bash
pnpm evals compare baseline-full change-1
```

Point at the **Per grader** section: it lists each task where a grader passed before and fails now, even when the task still passes its hidden tests.

### [HUMAN]

They read the per-grader section of their own comparison and say whether their Phase 12 change broke anything they didn't target. If it did, they add it to that `CHANGELOG.md` entry.

## 13.2 Make a regression on purpose

### [HUMAN]

They pick one rule the agent followed in `change-1` and loosen it in one commit: delete the line from the instruction file, or take the hook out of `.claude/settings.json`. Good candidates are rules that a task in their set gives the agent a reason to break.

```bash
git -C targets/<name> commit -am "experiment: loosen <rule>"
```

### [LLM]

Run the same command as 12.3 with `--label loosened`, then compare:

```bash
pnpm evals compare change-1 loosened
```

### [BRANCH]

- **Nothing broke** → that's a finding too: none of their tasks tempts the agent to break that rule, so the gate can't protect it. They name the kind of task that would, and add it to the tasks file as a stretch.
- **A different rule broke** → the agent's behaviour varies between runs. Run the loosened setup once more before blaming the change.

## 13.3 Explain and record it

### [HUMAN]

In `CHANGELOG.md` they record the loosening, the per-grader result, and one line on **why** it broke (or didn't), using the diff of the task that changed. Then they undo the loosening and commit:

```bash
git -C targets/<name> revert --no-edit HEAD
git -C targets/<name> add evals/suites/agent/CHANGELOG.md
git -C targets/<name> commit -m "workshop: record the regression"
```

## 13.4 Gate check

The participant confirms, and you verify:

- [ ] A per-grader regression is found and explained, or its absence is explained with the task that would expose it. — the `compare change-1 loosened` output from 13.2
- [ ] `CHANGELOG.md` records the loosening, the numbers and the explanation. — read `targets/<name>/evals/suites/agent/CHANGELOG.md`
- [ ] The loosening is reverted with a commit. — `git -C targets/<name> log --oneline -3` shows the revert

---

## Phase Complete

Mark Phase 13 complete. Preview: "Phase 14 — record a full run with thresholds per rule, and check it in CI without any model or secret."
