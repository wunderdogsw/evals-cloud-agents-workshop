# Phase 3 — LLM-as-judge

## Overview

Some qualities — is the explanation grounded, is the tone right, did it refuse when it should — don't fit an exact match. You'll write a rubric, add an LLM judge, then hand-label outputs yourself and measure how often the judge agrees with you. A judge you haven't calibrated is a random number generator with good grammar.

---

## 3.1 [LLM] Pick what to judge

Look at the feature's output and propose **one** quality that deterministic graders can't check. Examples: "the rationale justifies the code using the actual item", "the summary contains no facts absent from the source", "the answer declines when information is missing". Offer two candidates; the participant picks.

Make clear the judge must **not** re-check what a deterministic grader already checks.

## 3.2 [HUMAN] Write the rubric

They write `evals/suites/<suite>/rubric.md`. Coach with this shape, then step back:

```
PASS when ALL of these hold:
1. …observable condition…
2. …
FAIL otherwise. Do not judge <the thing another grader covers>.
```

Push for conditions a stranger could check from the output alone. Flag vague words ("good", "clear", "appropriate") and ask "how would you tell?".

## 3.3 [LLM] Add the judge

In `suite.ts`:

```ts
import { readFileSync } from "node:fs";
const rubric = readFileSync(new URL("./rubric.md", import.meta.url), "utf8");
// …
llmJudge({
  name: "judge",
  rubric,
  showExpected: false,            // reference-free unless the rubric needs the expected answer
  render: (c, o) => `…only what the judge needs…`,
}),
```

Keep `render` minimal — what the judge doesn't see can't bias it. The judge model comes from `runner/models.ts` (`claude-haiku-5-5` by default).

Run: `pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --label judge-v1`. Report the judge's pass rate and cost.

## 3.4 [HUMAN] Label blind

Labelling is interactive — give them this to run **in their own terminal**:

```bash
pnpm --dir targets/<name>/evals label judge-v1 --out suites/<suite>/labels.jsonl --grader judge
```

They label **at least 15** outputs PASS/FAIL against *their own rubric*, without seeing the judge's verdict. Optional note after a space. Remind them: label the quality the rubric describes, nothing else.

## 3.5 [LLM] Calibrate

```bash
pnpm --dir targets/<name>/evals calibrate judge-v1 --labels suites/<suite>/labels.jsonl --grader judge
```

Explain the table in plain words:

- **Agreement** and **Cohen's κ** (agreement beyond chance; > 0.6 decent, > 0.8 strong).
- **Judge PASS / human FAIL** is the dangerous cell: the judge lets bad output through.
- Walk through each disagreement: quote the judge's reasoning, ask whose call was right.

## 3.6 [HUMAN] Fix the rubric — or your label

For each disagreement they decide: the rubric was ambiguous (rewrite it), the judge misread (sharpen the condition or `render`), or their own label was wrong (fix the label — this happens more than people expect).

Re-grade **the same outputs** — don't re-run the feature, or the labels no longer match what's being judged:

```bash
pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --regrade judge-v1 --label judge-v2
pnpm --dir targets/<name>/evals calibrate judge-v2 --labels suites/<suite>/labels.jsonl --grader judge
```

At most two iterations; time-box it.

If agreement stays poor after two iterations, try `EVAL_JUDGE_MODEL=claude-sonnet-5-5` with `--regrade judge-v1` once and compare — that's a legitimate finding too ("a cheap judge isn't good enough for this rubric").

## Gate 3

- [ ] `rubric.md` and `labels.jsonl` (≥ 15 labels) exist in the suite
- [ ] A calibration report shows **≥ 80 % agreement**, **or** the participant has iterated twice and can explain the remaining disagreements
- [ ] They can say which direction their judge errs (too lenient vs too strict)

Commit: `git -C targets/<name> add evals && git -C targets/<name> commit -m "evals: calibrated judge for <suite>"`

## Room Gate 3

Facilitators will put 2–3 judge/human disagreements from the room on screen. Wait for release.

Stretch while waiting: run `pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --trials 3 --label judge-x3` and see whether the judge (and the feature) is *consistent* with itself.

---

## Phase Complete

Mark Phase 3 complete. Preview: "Phase 4 — you finally get to change the feature. The eval tells you whether you made it better or just different."
