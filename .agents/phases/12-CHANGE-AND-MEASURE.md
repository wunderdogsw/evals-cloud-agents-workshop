# Phase 12 — Change one agent file, measure it

## What you do

1. **Form a hypothesis** — from `agent-notes.md` and the per-rule scores, one rule the agent breaks, why, and the one change that should fix it.
2. **Change one agent file** — one edit to an instruction file, rule, skill or hook, committed on the workshop branch.
3. **Re-run and compare** — a new agent run with your graders and judges, compared with the baseline per rule.

## Gate

- [ ] A new run exists, compared with the graded baseline.
- [ ] `CHANGELOG.md` records the hypothesis, the numbers and a keep-or-revert decision.
- [ ] The decision is applied: the change is kept, or reverted with a commit.

## Learning point

Agent instructions you haven't measured are just hopes. One change per run is the only way to know which change did it.

## Wanted outcome

A compared run and a recorded keep-or-revert decision in `evals/suites/agent/CHANGELOG.md`.

---

## 12.1 Form a hypothesis

### [LLM]

> Narrate: "Everything you've built so far exists to answer one question: did this change make the agent better at our rules?"

Build the baseline the change will be compared with: the "with" run, graded by every grader. Judges cost a little per task; say so.

```bash
pnpm agent-evals regrade baseline-with --rules targets/<name>/evals/suites/agent/rules.mjs \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md --label baseline-full
```

Add one `--judge` per judge rule. Show the `rule:` and `judge:` rows.

### [HUMAN]

They pick **one** rule the agent broke in the baseline and write the hypothesis at the top of `targets/<name>/evals/suites/agent/CHANGELOG.md`:

```markdown
## <date> — <rule id>: <one-line change>
Hypothesis: the agent breaks <rule> because <reason seen in the diffs>. Changing <file> should fix it.
```

The reason must come from what they saw in a diff, not from a guess about models.

## 12.2 Change one agent file

### [HUMAN]

They make **one** change: a sharper line in `CLAUDE.md` or `AGENTS.md`, a path-scoped rule in `.claude/rules/`, a skill, or a hook. Then they commit it on the workshop branch:

```bash
git -C targets/<name> commit -am "agent: <one-line change>"
```

The run uses the agent files committed at the target's HEAD, so an uncommitted change isn't measured.

### [BRANCH]

- **The rule should never break** → a hook is the stronger change; a hook that blocks also shows in the diff as "never touched".
- **They want to change two things** → pick one now; the second is a stretch run after the gate.

## 12.3 Re-run and compare

### [LLM]

Same tasks, same agent, now with the graders inside the run, one `--judge` per judge rule as in 12.1 (another 10–30 minutes on their login):

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --rules targets/<name>/evals/suites/agent/rules.mjs \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md --label change-1
pnpm evals compare baseline-full change-1
```

Explain how to read it: the target rule's row first, then the per-grader section for anything that broke, then the hidden-tests pass rate. With 5–10 tasks and one trial, a one-task difference can be noise; say so.

### [HUMAN]

They add the numbers under their hypothesis in `CHANGELOG.md` (target rule before → after, hidden tests before → after, anything that broke) and a decision: **keep** or **revert**, with one line why. If they revert, they do it with a commit:

```bash
git -C targets/<name> revert --no-edit HEAD
```

Then they commit the changelog.

## 12.4 Gate check

The participant confirms, and you verify:

- [ ] A new run exists, compared with the graded baseline. — `ls .eval-runs | grep -e change-1 -e baseline-full`, and the compare output from 12.3
- [ ] `CHANGELOG.md` records the hypothesis, the numbers and a keep-or-revert decision. — read `targets/<name>/evals/suites/agent/CHANGELOG.md`
- [ ] The decision is applied: the change is kept, or reverted with a commit. — `git -C targets/<name> log --oneline -3`

---

## Phase Complete

Mark Phase 12 complete. Preview: "Phase 13 — break a rule on purpose and see whether the per-rule comparison catches what the pass rate hides."
