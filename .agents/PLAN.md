# Workshop Plan — Evals & Cloud Agents

## Audience and format

- Experienced developers working on their own product codebase.
- 1.5 days, facilitated, in a room. Participants work solo or in pairs.
- Day 1 (full day): evaluations. Day 2 (half day): cloud agents.
- Each participant works on a **target** repo: their own (preferably a mirror in a workshop group) or the bundled `samples/cost-coder`.

## The through-line

> You can only delegate to agents what you can measure.

Day 1 builds measurement: a dataset, graders, a calibrated judge, a CI gate, and a benchmark of coding-agent tasks taken from the target's own history. Day 2 delegates real work to cloud agents and lets that measurement decide what gets merged.

## Learning objectives

By the end, a participant can:

1. Write a golden dataset that reflects what "good" means for a feature, including edge cases and known-bad cases.
2. Choose between deterministic graders and LLM-as-judge, and explain why most suites need both.
3. Calibrate an LLM judge against human labels and report the agreement rate.
4. Compare two runs and identify regressions, not just score deltas.
5. Gate merges on eval results in GitLab CI or GitHub Actions — without a model or secrets in CI.
6. Build a coding-agent benchmark from merged changes (hidden tests from the reference commit).
7. Delegate a task to a coding agent (Claude Code or Cursor, locally or as a cloud agent) and review the resulting MR/PR.
8. Write agent-facing instructions (AGENTS.md / CLAUDE.md / rules) and measure whether they help.
9. Run several agents in parallel and triage their output by evidence.

## Day 1 — Evals

| Phase | Time | Core idea | Gate |
|---|---|---|---|
| 1 Attach target | 09:30–10:15 | Know your repo before you measure it | Target tests run green from the control room |
| 2 First eval | 10:15–11:30 | The dataset is the product | Baseline score with ≥20 cases, ≥12 written or labelled by the participant |
| 3 LLM-as-judge | 11:30–13:30 (incl. lunch) | Judges need judging | ≥80% agreement with own labels, or rubric revised and re-measured |
| 4 Iterate | 13:30–14:30 | Score deltas lie, regressions don't | A deliberate change is shown to regress ≥1 case |
| 5 Evals in CI | 14:30–15:30 | Measurement that doesn't block is a dashboard | A bad MR/PR is blocked by the eval job |
| 6 Agent evals | 15:30–16:45 | Benchmark the agent on *your* code | ≥5 replay tasks run, pass rate reported |

## Day 2 — Cloud agents

| Phase | Time | Core idea | Gate |
|---|---|---|---|
| 7 Delegate | 09:00–10:00 | An issue becomes an MR while you do something else | Agent-authored MR/PR exists and the eval gate ran on it |
| 8 Cloud agents | 10:00–10:45 | Same delegation, someone else's machine | Second MR/PR; side-by-side comparison written |
| 9 Guardrails | 10:45–11:30 | Instructions are code; measure them | Agent-evals rerun with improved AGENTS.md, delta reported |
| 10 Capstone | 11:30–12:30 | Parallel agents, evidence-based merge | Retro: which MRs would you merge and why |

## Tools

Participants use any coding tool — Claude Code, Cursor, or both — at any point; there are no tracks. Every model call (feature under test, judge, agents) runs on the participant's own login, auto-detected. CI never holds a model credential: the eval gate verifies a committed, fingerprinted recording of a local run.

## Eval subject

Phases 2–5 need an LLM-powered feature to evaluate. Phase 1 decides `evalSubject`:

- `target-feature` — the target already calls an LLM; evaluate that feature through a task adapter (`shellTask`, `httpTask`, or a direct import for TS targets).
- `sample-feature` — the target has no LLM feature; vendor the bundled cost-coder classifier into the target under `evals/subject/cost-coder/` and evaluate that. Phase 6 still benchmarks agents on the target's own code.

## Hosts

Phase 1 records `host`: `gitlab`, `github`, or `none` (local only). Phases 5, 7, 8, 9, 10 branch on it. `none` can complete Day 1 locally but needs a pushed remote before Day 2 — facilitators should resolve this during the Phase 5 room gate.

## Out of scope

Fine-tuning, RAG evaluation depth, production observability platforms. Mention them, don't teach them.
