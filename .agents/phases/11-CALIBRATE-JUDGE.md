# Phase 11 — Calibrate the judge

## What you do

1. **Run the judge** — `pnpm agent-evals regrade` with your rubrics on both baseline runs: no new agent run.
2. **Compare with your labels** — `pnpm evals calibrate` per judge rule: agreement, Cohen's kappa and every disagreement.
3. **Fix the rubric or your label** — for each disagreement decide which one is wrong, fix it, and run again.

## Gate

- [ ] Each judge reaches at least 80 % agreement, or two iterations are done and the remaining gaps are explained.
- [ ] `judge-notes.md` names each judge's lean, lenient or strict, with the counts.
- [ ] The final rubrics are committed on the workshop branch.

## Learning point

An uncalibrated judge is a random number generator with good grammar. Agreement with your own labels is what makes its score worth reading.

## Wanted outcome

A judge per judgement rule whose agreement and lean you know, ready to grade the runs in Phases 12–14.

---

## 11.1 Run the judge

### [LLM]

> Narrate: "Now the judge reads the same diffs you labelled. Then we see where you two disagree."

Each judge call runs on their own login and costs a little per diff; say so once. Run the judges over both baseline runs, with ids matching the labels:

```bash
pnpm agent-evals regrade baseline-with baseline-without \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md \
  --judge R6=targets/<name>/evals/suites/agent/rubric-r6.md \
  --label judged-1
```

Report the cost it prints.

### [HUMAN]

They read the `judge:` rows of the summary and say, before calibrating, whether the scores look like their labels.

## 11.2 Compare with your labels

### [LLM]

One report per judge rule:

```bash
pnpm evals calibrate judged-1 --labels .workshop/targets/<name>/labels-r5.jsonl --grader judge:R5
```

Explain the two error cells in one line each: **judge PASS, you FAIL** means the judge is too lenient, the dangerous direction for a gate; **judge FAIL, you PASS** means it's too strict, which costs review time. Kappa corrects for chance: above 0.6 is decent.

### [HUMAN]

They read every disagreement with the judge's reasoning. For each one they write a line in `.workshop/targets/<name>/judge-notes.md`: the id, who they think is right, and why.

## 11.3 Fix the rubric or your label

### [HUMAN]

For each disagreement they fix exactly one thing:

- **The rubric** was vague or missed a case → edit `rubric-<rule>.md`.
- **Their label** was wrong once they saw the judge's reasoning → edit that line in `labels-<rule>.jsonl`, with a note on why.

Never edit a label just to raise agreement. Then they run 11.1 and 11.2 again with `--label judged-2`, and repeat once more at most.

When they're done, they write the final numbers and the lean of each judge in `judge-notes.md` (for example "R5: 85 %, κ 0.70, lenient: 2 false passes, 1 false fail"), and commit the rubrics:

```bash
git -C targets/<name> add evals/suites/agent
git -C targets/<name> commit -m "workshop: calibrated rubrics"
```

### [BRANCH]

- **Agreement stays under 80 % after two iterations** → that's an acceptable outcome. They write which kind of case the judge gets wrong, and Phase 14 sets that judge's threshold low or leaves it out of the gate.
- **Fewer than 5 labelled diffs for a rule** → go back to Phase 10's labeller for that rule first; agreement on 3 cases says nothing.

## 11.4 Gate check

The participant confirms, and you verify:

- [ ] Each judge reaches at least 80 % agreement, or two iterations are done and the remaining gaps are explained. — the last `pnpm evals calibrate` output per rule
- [ ] `judge-notes.md` names each judge's lean, lenient or strict, with the counts. — read `.workshop/targets/<name>/judge-notes.md`
- [ ] The final rubrics are committed on the workshop branch. — `git -C targets/<name> status --short` shows no changed rubric

## Room Gate

Facilitators put each table's agreement and lean on screen. Discuss: which rules were hard to label, and what that says about the rule itself.

---

## Phase Complete

Mark Phase 11 complete. Preview: "Phase 12 — pick one rule the agent breaks, change one agent file, and measure whether it helped."
