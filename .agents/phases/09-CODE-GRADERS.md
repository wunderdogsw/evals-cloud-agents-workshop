# Phase 9 — Grade rules with code

## What you do

1. **Write a grader per code rule** — add one entry in `evals/suites/agent/rules.mjs` for each picked rule that code checks.
2. **Prove each grader** — run `pnpm agent-evals grade-patch` to show that a planted violation fails and a clean change passes.
3. **Re-grade the baseline** — run `pnpm agent-evals regrade` to score both Phase 8 runs for each rule, without running the agent again.

## Gate

- [ ] Every picked code rule has a grader, committed on the workshop branch.
- [ ] Each grader failed a planted violation and passed a clean change.
- [ ] Both baseline runs are re-graded with a score per rule.

## Learning point

Use code to check a rule whenever the rule allows it. A code grader costs little, runs fast and always gives the same answer.

## Wanted outcome

You have committed rule graders and a re-graded baseline with a score for each code rule, and Phase 12 compares new runs against this baseline.

---

## 9.1 Write a grader per code rule

### [LLM]

> Narrate: "In Phase 8 you checked the rules by reading the diffs. Now code checks them on every run, in a few seconds."

Create the agent suite folder in the target:

```bash
pnpm workshop install <name> agent-suite
```

It adds `evals/suites/agent/` with `README.md`, `agent-suite.json` and `rules.mjs`. Explain the header of `rules.mjs` with them:
- A grader is `{ name, description, tasks?, grade(ctx) }`.
- It sees the code change, not the agent's messages.
- It returns `{ pass, reason }`.
- `ctx.touched("data/**")`, `ctx.added("src/*.ts")` and `ctx.patch` are enough for most rules. `ctx.run("<command>")` runs a command in the task workspace.
- The file imports nothing, because the kit loads it from the target.

### [HUMAN]

They write one grader for each picked **code** rule from `expectations.md`, named by its id (`R3`, `R4`). `tasks` limits a rule to the tasks where it can apply. They take these from the Tasks column. Each `reason` says what broke, so a failing grade explains itself.

Review each grader for one question: can it pass on a change that breaks the rule? Ask them for the smallest change that breaks the rule but still passes the grader.

### [BRANCH]

- **Target is `sample`** → expected graders: R1 (no real model client in tests), R3 (each new `src/<m>.ts` has `test/<m>.test.ts`), R4 (nothing under `data/`). Compare with `kit/catchup/cost-coder/agent-suite/rules.mjs` only after their graders work.
- **A rule needs a command** (lint clean, typecheck) → use `ctx.run`. Warn them about one limit. A re-grade of an old run can't run commands, because the workspace may no longer exist. These rules only get a score on new runs.

## 9.2 Prove each grader

### [LLM]

A planted violation is a change you make on purpose that breaks the rule. Show how to save one as a patch file without changing the workshop branch:

```bash
cd targets/<name>
# make the violating edit, then:
git diff > ../../.workshop/targets/<name>/planted-r4.diff
git checkout -- .
cd ../..
pnpm agent-evals grade-patch targets/<name> --tasks <tasks-file> --task <id> --setup "<install command>" \
  --rules targets/<name>/evals/suites/agent/rules.mjs --patch .workshop/targets/<name>/planted-r4.diff
```

If you use `--reference` instead of `--patch`, the command grades the real solution. The real solution should pass every rule that applies to it.

### [HUMAN]

For each grader, they make one planted violation and run `grade-patch`. The grader must fail and give its reason. Then they run `grade-patch --reference` on a task the rule applies to. The grader must pass. If a grader fails the reference, there are two possible causes: the grader is wrong, or the reference breaks the rule. They decide which one it is.

When every grader has passed both checks, they commit:

```bash
git -C targets/<name> add evals/suites/agent
git -C targets/<name> commit -m "workshop: rule graders"
```

## 9.3 Re-grade the baseline

### [LLM]

To regrade a run means to score its stored code changes again with the current graders, without running the agent again. Regrade both Phase 8 runs. With two runs, the task ids become `baseline-with/<task>` and `baseline-without/<task>`, so one table shows both runs:

```bash
pnpm agent-evals regrade baseline-with baseline-without --rules targets/<name>/evals/suites/agent/rules.mjs --label graded
pnpm agent-evals regrade baseline-with --rules targets/<name>/evals/suites/agent/rules.mjs --label baseline-graded
```

The second command makes a separate re-graded copy of the "with" run for Phase 12.

### [HUMAN]

They read the `rule:` rows and compare each failure with their `agent-notes.md` from Phase 8. If the grader and their notes disagree, one of them is wrong. They find out which one and fix the grader or the note.

## 9.4 Gate check

The participant confirms each item, and you verify it:

- [ ] Every picked code rule has a grader, committed on the workshop branch. — compare the code rows in `expectations.md` with `rules.mjs`, and `git -C targets/<name> log -1 --stat`
- [ ] Each grader failed a planted violation and passed a clean change. — the `grade-patch` outputs from 9.2
- [ ] Both baseline runs are re-graded with a score per rule. — `ls .eval-runs | grep -e graded` shows `graded` and `baseline-graded`, each with `rule:` rows

---

## Phase Complete

Mark Phase 9 complete. Preview: "Phase 10 — for the rules that code can't check, write a rubric and label the baseline by hand before you build a judge."
