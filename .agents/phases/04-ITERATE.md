# Phase 4 — Iterate without regressing

## Overview

Now you change the feature — prompt, model, parsing — and use the eval to decide whether the change is an improvement. You'll learn to read a comparison by its regressions, not its headline score: a pass rate can go up while the cases you care most about break.

---

## 4.1 [LLM] Lock the baseline

Run the full suite once with the current code and label it:

```bash
pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --label v1
```

If the suite runs in under a minute, also run `--trials 3 --label v1-x3` and show how much the pass rate moves between identical runs. That spread is the noise floor — any "improvement" smaller than it is not an improvement.

## 4.2 [HUMAN] Form a hypothesis

From the failures, they pick one failure pattern and write one sentence: *"The feature gets X wrong because Y; changing Z should fix it."* (For `cost-coder`, typical: equipment rental vs work with an operator; design services classified as the trade they design; credit notes.)

## 4.3 [HUMAN] Make one change

One change only: a prompt edit, a few-shot example, a schema tweak, or a model swap. They make it themselves (pairing with you is fine). Keep it small enough to explain.

## 4.4 [LLM] Compare

```bash
pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --label v2
pnpm --dir targets/<name>/evals compare v1 v2
```

(Run refs can be labels — safer than `latest~1` once you've made extra runs.)

Read the comparison top-down: pass rate delta vs the noise floor, **regressions** (named cases that passed before and fail now), fixes, cost delta. Ask: "Would you ship v2?"

## 4.5 [LLM] Make a regression on purpose

If v2 had no regressions, demonstrate one: make a plausible-looking "cleanup" of the prompt (e.g. remove the cost-code descriptions and keep only the numbers, or drop a rule that seemed redundant), run `--label v3`, `compare v2 v3`. Show that the headline can look fine while specific `critical` cases break. Then revert.

## 4.6 [HUMAN] Decide

They keep the version they'd defend in code review and write a 3-line note in the suite folder `CHANGELOG.md`: what changed, pass rate before → after, regressions accepted (if any) and why.

## Gate 4

- [ ] At least two labelled runs with a `compare` between them
- [ ] They've seen at least one regression (organic or deliberate)
- [ ] `CHANGELOG.md` exists in the suite folder with the decision

Commit the feature change and the changelog together:

```bash
git -C targets/<name> add -A && git -C targets/<name> commit -m "feature: <change> (evals: <before>→<after>)"
```

---

## Phase Complete

Mark Phase 4 complete. Preview: "Phase 5 — an eval that doesn't block anything is just a dashboard. You'll make it a merge gate."
