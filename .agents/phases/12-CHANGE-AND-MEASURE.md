# Phase 12 — Change one agent file, measure it

## What you do

1. **Form a hypothesis** — use `agent-notes.md` and the scores for each rule to pick one rule the agent breaks, say why, and name the one change that should fix it.
2. **Change one agent file** — make one edit to an instruction file, rule, skill or hook, and commit it on the workshop branch.
3. **Re-run and compare** — start a new agent run with your graders and judges, and compare it with the baseline rule by rule.

## Gate

- [ ] A new run exists, compared with the graded baseline.
- [ ] `CHANGELOG.md` records the hypothesis, the numbers and a keep-or-revert decision.
- [ ] The decision is applied: the change is kept, or reverted with a commit.

## Learning point

If you don't measure agent instructions, you can't know whether the agent follows them. Make one change per run, because only then do you know which change caused the result.

## Wanted outcome

A compared run and a recorded keep-or-revert decision in `evals/suites/agent/CHANGELOG.md`.

---

## 12.1 Form a hypothesis

### [LLM]

> Narrate: "Everything you built so far answers one question: did this change make the agent follow our rules better?"

Build the baseline that the change will be compared with. This is the "with" run, graded by every grader. Each judge costs a small amount per task. Tell the participant this.

```bash
pnpm agent-evals regrade baseline-with --rules targets/<name>/evals/suites/agent/rules.mjs \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md --label baseline-full
```

Add one `--judge` for each judge rule. Show the `rule:` and `judge:` rows.

### [HUMAN]

They pick **one** rule that the agent broke in the baseline. They write the hypothesis at the top of `targets/<name>/evals/suites/agent/CHANGELOG.md`:

```markdown
## <date> — <rule id>: <one-line change>
Hypothesis: the agent breaks <rule> because <reason seen in the diffs>. Changing <file> should fix it.
```

The reason must come from something they saw in a diff. It must not be a guess about how models behave.

### [BRANCH]

- **The agent broke no rule in the baseline** (common with a setup that was already good) → they test a change that makes the setup smaller instead: remove a section, a rule file or a skill that seems unneeded. The hypothesis is "the agent still follows every rule without <part>". A smaller setup uses less context in every session. If no grader gets worse in 12.3, they keep the smaller setup.
- **The agent broke many rules** → they pick the rule that broke in the most tasks in the run with the setup.

## 12.2 Change one agent file

### [HUMAN]

They make **one** change. It can be a clearer line in `CLAUDE.md` or `AGENTS.md`, a rule for specific paths in `.claude/rules/`, a skill, or a hook. Then they commit it on the workshop branch:

```bash
git -C targets/<name> commit -am "agent: <one-line change>"
```

The run uses the agent files committed at the target's HEAD. A change that is not committed is not measured.

### [BRANCH]

- **The rule should never break** → a hook is the stronger change. A hook that blocks the action also shows in the diff, because the agent never changed those files.
- **They want to change two things** → pick one now. They can try the second one as an extra run after the gate.

## 12.3 Re-run and compare

### [LLM]

Use the same tasks and the same agent. This time the graders run inside the run. Add one `--judge` for each judge rule, as in 12.1. This takes another 10–30 minutes on their login:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --rules targets/<name>/evals/suites/agent/rules.mjs \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md --label change-1
pnpm evals compare baseline-full change-1
```

Explain how to read the output. First read the row for the target rule. Then read the section for each grader, and look for anything that broke. Then read the pass rate of the hidden tests. With 5–10 tasks and one trial, a difference of one task can be random. Say so.

### [HUMAN]

They add the numbers under their hypothesis in `CHANGELOG.md`: the target rule before → after, the hidden tests before → after, and anything that broke. They add a decision, **keep** or **revert**, with one line that explains why. If they revert, they do it with a commit:

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

Mark Phase 12 complete. Preview: "Phase 13 — break a rule on purpose, and see whether the comparison for each rule catches a problem that the overall pass rate does not show."
