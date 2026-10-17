# Phase 9 — Grade rules with code

## What you do

1. **Write a grader per code rule** — one entry in `evals/suites/agent/rules.mjs` for each picked rule checked by code.
2. **Prove each grader** — `pnpm agent-evals grade-patch`: a planted violation fails, a clean change passes.
3. **Re-grade the baseline** — `pnpm agent-evals regrade` scores both Phase 8 runs per rule, without a new agent run.

## Gate

- [ ] Every picked code rule has a grader, committed on the workshop branch.
- [ ] Each grader failed a planted violation and passed a clean change.
- [ ] Both baseline runs are re-graded with a score per rule.

## Learning point

Use code wherever a rule allows it. A code grader is cheap, fast and can't be argued with.

## Wanted outcome

Committed rule graders and a re-graded baseline with a score per code rule, which Phase 12 compares against.

---

## 9.1 Write a grader per code rule

### [LLM]

> Narrate: "In Phase 8 you checked the rules by eye. Now code checks them, every run, in seconds."

Create the agent suite folder in the target:

```bash
pnpm workshop install <name> agent-suite
```

It adds `evals/suites/agent/` with `README.md`, `agent-suite.json` and `rules.mjs`. Walk through the header of `rules.mjs`: a grader is `{ name, description, tasks?, grade(ctx) }`, it sees the change and not the agent's words, and it returns `{ pass, reason }`. `ctx.touched("data/**")`, `ctx.added("src/*.ts")` and `ctx.patch` cover most rules; `ctx.run("<command>")` runs a command in the task workspace. The file imports nothing, because the kit loads it from the target.

### [HUMAN]

They write one grader per picked **code** rule from `expectations.md`, named by its id (`R3`, `R4`). `tasks` limits a rule to the tasks where it can apply, from the Tasks column. Each `reason` says what broke, so a failing grade explains itself.

Review each grader for one thing: can it pass on a change that breaks the rule? Ask them for the cheapest violation that would slip through.

### [BRANCH]

- **Target is `sample`** → expected graders: R1 (no real model client in tests), R3 (each new `src/<m>.ts` has `test/<m>.test.ts`), R4 (nothing under `data/`). Compare with `kit/catchup/cost-coder/agent-suite/rules.mjs` only after theirs work.
- **A rule needs a command** (lint clean, typecheck) → use `ctx.run`. Warn that a re-grade of an old run can't run commands, because the workspace may be gone; those rules only score on fresh runs.

## 9.2 Prove each grader

### [LLM]

Show how to make a planted violation as a patch, without touching the workshop branch:

```bash
cd targets/<name>
# make the violating edit, then:
git diff > ../../.workshop/targets/<name>/planted-r4.diff
git checkout -- .
cd ../..
pnpm agent-evals grade-patch targets/<name> --tasks <tasks-file> --task <id> --setup "<install command>" \
  --rules targets/<name>/evals/suites/agent/rules.mjs --patch .workshop/targets/<name>/planted-r4.diff
```

`--reference` instead of `--patch` grades the real solution, which should pass every rule it applies to.

### [HUMAN]

For each grader, they plant one violation and run `grade-patch`: the grader must fail with its reason. Then they run `grade-patch --reference` on a task the rule applies to: it must pass. A grader that fails the reference is either wrong or catching a real gap in the reference; they decide which.

When all graders are proven, they commit:

```bash
git -C targets/<name> add evals/suites/agent
git -C targets/<name> commit -m "workshop: rule graders"
```

## 9.3 Re-grade the baseline

### [LLM]

Re-grade both Phase 8 runs. With two runs, task ids become `baseline-with/<task>` and `baseline-without/<task>`, so one table shows both:

```bash
pnpm agent-evals regrade baseline-with baseline-without --rules targets/<name>/evals/suites/agent/rules.mjs --label graded
pnpm agent-evals regrade baseline-with --rules targets/<name>/evals/suites/agent/rules.mjs --label baseline-graded
```

The second command gives the "with" run its own re-graded copy for Phase 12.

### [HUMAN]

They read the `rule:` rows and compare each failure with their `agent-notes.md` from Phase 8. Where the grader and their notes disagree, one of them is wrong: they find out which and fix the grader or the note.

## 9.4 Gate check

The participant confirms, and you verify:

- [ ] Every picked code rule has a grader, committed on the workshop branch. — compare the code rows in `expectations.md` with `rules.mjs`, and `git -C targets/<name> log -1 --stat`
- [ ] Each grader failed a planted violation and passed a clean change. — the `grade-patch` outputs from 9.2
- [ ] Both baseline runs are re-graded with a score per rule. — `ls .eval-runs | grep -e graded` shows `graded` and `baseline-graded`, each with `rule:` rows

---

## Phase Complete

Mark Phase 9 complete. Preview: "Phase 10 — for the rules code can't check, write a rubric and label the baseline by hand before any judge exists."
