# Phase 13 — Catch a regression

## What you do

1. **Read the comparison by rule** — read the section for each grader in `pnpm evals compare`, not only the overall pass rate.
2. **Make a regression on purpose** — remove one rule or hook in a commit, then run the agent again.
3. **Explain and record it** — write in `CHANGELOG.md` what broke and why, then revert the removal.

## Gate

- [ ] A regression for one grader is found and explained, or you explain why there is none and name the task that would show it.
- [ ] `CHANGELOG.md` records the removed rule or hook, the numbers and the explanation.
- [ ] The removal is reverted with a commit.

## Learning point

The pass rate can go up while the rule you care about breaks. Read the comparison for each rule, every time.

## Wanted outcome

You have recorded a regression, or a missing kind of task, and you read comparisons rule by rule before Phase 14 uses them to block merges.

---

## 13.1 Read the comparison by rule

### [LLM]

> Narrate: "The overall pass rate is the least useful line in the comparison. Let's read the other lines."

Show the Phase 12 comparison again:

```bash
pnpm evals compare baseline-full change-1
```

Point to the **Per grader** section. It lists each task where a grader passed before and fails now. It lists the task even when the task still passes its hidden tests.

### [HUMAN]

They read the **Per grader** section of their own comparison. They say whether their Phase 12 change broke a rule they didn't intend to change. If it did, they add it to that `CHANGELOG.md` entry.

## 13.2 Make a regression on purpose

### [HUMAN]

They pick one rule that the agent followed in `change-1`. They remove it in one commit: they delete the line from the instruction file, or they take the hook out of `.claude/settings.json`. Pick a rule where at least one task in their set gives the agent a reason to break it.

```bash
git -C targets/<name> commit -am "experiment: loosen <rule>"
```

### [LLM]

Run the same command as in 12.3 with `--label loosened`. Then compare:

```bash
pnpm evals compare change-1 loosened
```

### [BRANCH]

- **Nothing broke** → this is also a result. None of their tasks gives the agent a reason to break that rule, so the gate can't protect it. They describe the kind of task that would give a reason, and add it to the tasks file as an extra task.
- **A different rule broke** → the agent behaves differently from run to run. Run the setup without the rule once more before you decide the change caused it.

## 13.3 Explain and record it

### [HUMAN]

In `CHANGELOG.md` they record the removed rule or hook and the result for each grader. They add one line on **why** the rule broke, or why it didn't. They base this on the diff of the task that changed. Then they undo the removal and commit:

```bash
git -C targets/<name> revert --no-edit HEAD
git -C targets/<name> add evals/suites/agent/CHANGELOG.md
git -C targets/<name> commit -m "workshop: record the regression"
```

## 13.4 Gate check

The participant confirms, and you verify:

- [ ] A regression for one grader is found and explained, or you explain why there is none and name the task that would show it. — the `compare change-1 loosened` output from 13.2
- [ ] `CHANGELOG.md` records the removed rule or hook, the numbers and the explanation. — read `targets/<name>/evals/suites/agent/CHANGELOG.md`
- [ ] The removal is reverted with a commit. — `git -C targets/<name> log --oneline -3` shows the revert

---

## Phase Complete

Mark Phase 13 complete. Preview: "Phase 14 — record a full run with a threshold for each rule, and check it in CI without any model or secret."
