# Phase 11 — Calibrate the judge

## What you do

1. **Run the judge** — `pnpm agent-evals regrade` with your rubrics on both baseline runs. This starts no new agent run.
2. **Compare with your labels** — `pnpm evals calibrate` for each judge rule shows agreement, Cohen's kappa and every disagreement.
3. **Fix the rubric or your label** — for each disagreement, decide which one is wrong, fix it, and run again.

## Gate

- [ ] Each judge reaches at least 80 % agreement, or two iterations are done and the remaining gaps are explained.
- [ ] `judge-notes.md` says whether each judge is too lenient or too strict, with the counts.
- [ ] The final rubrics are committed on the workshop branch.

## Learning point

A judge you haven't checked against your own labels can give confident but wrong verdicts. You can trust its score only when it agrees with your labels.

## Wanted outcome

For each judgement rule, you have a judge whose agreement with your labels is known, and you know whether it is too lenient or too strict, so it can grade the runs in Phases 12–14.

---

## 11.1 Run the judge

### [LLM]

> Narrate: "Now the judge reads the same diffs you labelled. Then we see where you and the judge disagree."

Each judge call runs on the participant's own login. Each diff costs a small amount. Tell them this once. Run the judges over both baseline runs. Use ids that match the labels:

```bash
pnpm agent-evals regrade baseline-with baseline-without \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md \
  --judge R6=targets/<name>/evals/suites/agent/rubric-r6.md \
  --label judged-1
```

Report the cost it prints.

### [HUMAN]

They read the `judge:` rows of the summary. Before calibrating, they say whether the scores look like their labels.

## 11.2 Compare with your labels

### [LLM]

Create one report for each judge rule. Calibrating means checking the judge against the participant's own labels:

```bash
pnpm evals calibrate judged-1 --labels .workshop/targets/<name>/labels-r5.jsonl --grader judge:R5
```

Explain the two error cells in one line each. **judge PASS, you FAIL** means the judge is too lenient. This is the dangerous case for a gate, because bad changes pass. **judge FAIL, you PASS** means the judge is too strict. This costs review time. Cohen's kappa is agreement corrected for chance. A kappa above 0.6 is decent.

### [HUMAN]

They read every disagreement together with the judge's reasoning. For each one, they write a line in `.workshop/targets/<name>/judge-notes.md`: the id, who they think is right, and why.

## 11.3 Fix the rubric or your label

### [HUMAN]

For each disagreement, they fix exactly one thing:

- **The rubric** was vague or missed a case → edit `rubric-<rule>.md`.
- **Their label** was wrong, as the judge's reasoning shows → edit that line in `labels-<rule>.jsonl`, and add a note on why.

Never edit a label only to raise agreement. Then they run 11.1 and 11.2 again with `--label judged-2`. They repeat this at most once more.

When they finish, they write the final numbers in `judge-notes.md`. For each judge they also write whether it is too lenient or too strict. Example: "R5: 85 %, κ 0.70, lenient: 2 false passes, 1 false fail". Then they commit the rubrics:

```bash
git -C targets/<name> add evals/suites/agent
git -C targets/<name> commit -m "workshop: calibrated rubrics"
```

### [BRANCH]

- **Agreement stays under 80 % after two iterations** → this result is acceptable. They write which kind of case the judge gets wrong. In Phase 14, that judge gets a low threshold or is left out of the gate.
- **Fewer than 5 labelled diffs for a rule** → first go back to Phase 10's labeller for that rule. Agreement on only 3 cases tells you nothing.

## 11.4 Gate check

The participant confirms, and you verify:

- [ ] Each judge reaches at least 80 % agreement, or two iterations are done and the remaining gaps are explained. — the last `pnpm evals calibrate` output for each rule
- [ ] `judge-notes.md` says whether each judge is too lenient or too strict, with the counts. — read `.workshop/targets/<name>/judge-notes.md`
- [ ] The final rubrics are committed on the workshop branch. — `git -C targets/<name> status --short` shows no changed rubric

## Room Gate

Facilitators show each table's agreement on the shared screen, and whether each judge is too lenient or too strict. Discuss which rules were hard to label, and what that tells you about the rule itself.

---

## Phase Complete

Mark Phase 11 complete. Preview: "Phase 12 — pick one rule the agent breaks, change one agent file, and measure whether the change helped."
