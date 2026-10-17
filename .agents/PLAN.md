# Workshop Plan — Evals & Cloud Agents

## Audience and format

- Experienced developers working on their own product codebase.
- 1.5 days, facilitated, in a room. Participants work solo or in pairs.
- Day 1 (full day): evaluations. Day 2 (half day): cloud agents.
- Each participant works on a **target** repo: their own (preferably a mirror in a workshop group) or the bundled `samples/cost-coder`.

## The through-line

> You can only delegate to agents what you can measure, and you can only measure an agent against rules you've written down.

The evals section starts with the target's agent setup: discover what the agent is actually told, audit it with Claude Code's own checks, and fix it. That setup becomes the spec. The rest of the section measures the agent against it: tasks from the repo's own history, code graders, a calibrated judge, a measured change, and a CI gate. The cloud agents section delegates real work and lets that measurement decide what gets merged.

## Learning objectives

By the end, a participant can:

1. Find out what a coding agent actually loads in a repo, and audit it with `/doctor` and `/doctor prompt-audit`.
2. Write instruction files that load, agree with each other and stay short, and enforce must-never-break rules with hooks.
3. Turn written rules into expectations checked by code or by a judge.
4. Build a coding-agent benchmark from merged changes (hidden tests from the reference commit), and measure what the setup adds.
5. Calibrate an LLM judge against human labels and report agreement and lean.
6. Change one agent file, compare runs per rule, and catch a regression.
7. Gate merges on a fingerprinted eval recording in GitLab CI or GitHub Actions, without a model or secrets in CI.
8. Delegate a task to a coding agent (locally or as a cloud agent) and review the resulting MR/PR.
9. Run several agents in parallel and triage their output by evidence.

## Evals section (Day 1)

About 28 minutes per phase, including Room Gates.

| Part | Phase | Core idea | Wanted outcome |
|---|---|---|---|
| A. Foundation | 1 Attach your target | You can't measure a repo you can't run | Runnable target on its workshop branch |
| A. Foundation | 2 Discover your agent setup | What's on disk is not what the agent gets | Inventory of what the agent is told |
| A. Foundation | 3 Check the setup with Claude Code | An unaudited instruction file is untested | Ranked findings; fix or "already good" path |
| A. Foundation | 4 Fix the instruction files | Instructions are context, not enforcement | Instruction files that load and agree, committed |
| A. Foundation | 5 Add skills, hooks and permissions | Rules that must never break belong in hooks | Complete agent setup, committed |
| B. Measure | 6 Turn your rules into expectations | A rule you can't check is a wish | Five rules marked code or judge |
| B. Measure | 7 Build agent tasks from your history | Your history beats public benchmarks | 5–10 validated tasks |
| B. Measure | 8 Baseline the agent | Measure what the setup adds | Pass rates with and without the setup |
| B. Measure | 9 Grade rules with code | Code where a rule allows it | Per-rule scores for code rules |
| B. Measure | 10 Write the judge rubric | If you can't label it, a judge can't | Rubric and 15+ blind labels |
| B. Measure | 11 Calibrate the judge | Judges need judging | ≥ 80 % agreement, known lean |
| C. Improve | 12 Change one agent file, measure it | Unmeasured instructions are hopes | Compared run and recorded decision |
| C. Improve | 13 Catch a regression | Pass rates hide broken rules | A regression explained |
| D. Protect | 14 Record evals for CI | No model or secret in CI | Recording and CI job on the branch |
| D. Protect | 15 Make the gate block | An eval that blocks nothing is a dashboard | A working merge gate |

Phases 8–15 use `pnpm agent-evals` for runs with and without the setup (`--without-setup`), rule graders (`--rules`), judges over diffs (`--judge`, `label`, `regrade`) and CI recordings (`--record`).

## Cloud agents section (Day 2)

| Phase | Core idea | Gate |
|---|---|---|
| 16 Delegate | An issue becomes an MR while you do something else | Agent-authored MR/PR exists and the eval gate ran on it |
| 17 Cloud agents | Same delegation, someone else's machine | Second MR/PR; side-by-side comparison written |
| 18 Guardrails | Instructions are code; measure them | Review agent on the MR/PR; agent-evals rerun, delta reported |
| 19 Capstone | Parallel agents, evidence-based merge | Retro: which MRs would you merge and why |

## Tools

Participants use any coding tool — Claude Code, Cursor, or both — at any point; there are no tracks. Every model call (feature under test, judge, agents) runs on the participant's own login, auto-detected. CI never holds a model credential: the eval gate verifies a committed, fingerprinted recording of a local run.

## Hosts

Phase 1 records `host`: `gitlab`, `github`, or `none` (local only). Phases 14–19 branch on it. `none` can complete Phases 1–13 locally but needs a pushed remote from Phase 14 on.

## Safety

Targets may be production repos. All work stays on `dev-days-workshop/<participant>` branches with a start tag; a push guard blocks anything else. See AGENTS.md → Target safety, and `pnpm workshop cleanup`.

## Out of scope

Fine-tuning, RAG evaluation depth, production observability platforms. Mention them, don't teach them.
