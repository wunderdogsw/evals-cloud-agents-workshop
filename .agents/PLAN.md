# Workshop Plan — Evals & Cloud Agents

## Audience and format

- Experienced developers who work on their own product code.
- 1.5 days, with facilitators, in one room. Participants work alone or in pairs.
- Day 1 (full day): evals. Day 2 (half day): cloud agents.
- Each participant works on a **target** repo: their own (best as a mirror in a workshop group) or the sample `samples/cost-coder`.

## The main idea

> You can only hand work to agents when you can measure how well they do it. You can only measure an agent against rules you have written down.

The evals section starts with the target's agent setup. Participants find out what the agent really loads, check it with Claude Code's own commands, and fix it. That setup is the standard the rest of the section measures against: tasks from the repo's own history, code graders, a judge checked against the participant's labels, one measured change, and a CI gate. The cloud agents section gives real work to agents and uses that measurement to decide what gets merged.

## Learning objectives

By the end, a participant can:

1. Find out what a coding agent really loads in a repo, and check it with `/doctor` and `/doctor prompt-audit`.
2. Write instruction files that load, don't contradict each other and stay short, and block rules that must never break with hooks.
3. Decide for each written rule whether code or a judge checks it.
4. Build agent tasks from merged changes (graded by the tests from the real change), and measure what the setup adds.
5. Check an LLM judge against their own labels, and report the agreement and whether the judge is too lenient or too strict.
6. Change one agent file, compare runs per rule, and find a rule that got worse.
7. Block merges in GitLab CI or GitHub Actions with a recorded eval run, without a model or secrets in CI.
8. Give a task to a coding agent (locally or as a cloud agent) and review the MR/PR it opens.
9. Run several agents at the same time and decide from the evidence which work to merge.

## Evals section (Day 1)

About 28 minutes per phase, including Room Gates.

| Part | Phase | Main point | Wanted outcome |
|---|---|---|---|
| A. Foundation | 1 Attach your target | You can't measure a repo you can't run | Target that runs, on its workshop branch |
| A. Foundation | 2 Discover your agent setup | The agent doesn't get every file on disk, and part of what it gets is personal | Loading gaps with a fix-or-leave decision |
| A. Foundation | 3 Check the setup with Claude Code | An instruction file nobody checked may not work | Ranked findings; "fix" or "already good" path |
| A. Foundation | 4 Fix the instruction files | Instructions are text; they can't force the agent | Instruction files that load and agree, committed |
| A. Foundation | 5 Add skills, hooks and permissions | Rules that must never break go in hooks | Complete agent setup, committed |
| B. Measure | 6 Turn your rules into expectations | If you can't check a rule, you can't measure it | Five rules marked code or judge |
| B. Measure | 7 Build agent tasks from your history | Your own merged changes make the best tasks | 5–10 validated tasks |
| B. Measure | 8 Baseline the agent | Measure what the setup adds | Pass rates with and without the setup |
| B. Measure | 9 Grade rules with code | Use code wherever a rule allows it | A score per code rule |
| B. Measure | 10 Write the judge rubric | If you can't label it, a judge can't either | Rubrics and 15+ labels |
| B. Measure | 11 Calibrate the judge | Check the judge against your labels | ≥ 80 % agreement; known direction of errors |
| C. Improve | 12 Change one agent file, measure it | Measure every instruction change | Compared run and a recorded decision |
| C. Improve | 13 Catch a regression | The pass rate can hide a broken rule | A rule that got worse, explained |
| D. Protect | 14 Record evals for CI | CI needs no model and no secret | Recording and CI job on the branch |
| D. Protect | 15 Make the gate block | A gate must be seen to block | A working merge gate |

Phases 8–15 use `pnpm agent-evals` for runs with and without the setup (`--without-setup`), rule graders (`--rules`), judges over diffs (`--judge`, `label`, `regrade`) and CI recordings (`--record`).

## Cloud agents section (Day 2)

Phases 16–17 use the new phase format. Phases 18–19 still use the old document format.

| Phase | Main point | Gate |
|---|---|---|
| 16 Build a review-lessons skill | Reading review comments by hand can be a skill, tested with and without it | `review-lessons` skill committed; with/without benchmark noted; first findings report |
| 17 Act on review lessons, schedule locally | The agent finds the patterns; you decide which are worth a change. A laptop schedule runs only while the laptop is on | A fix/skip decision per finding; a change committed per finding; the local schedule ran once |
| 18 Guardrails | A review agent comments from the repo's rules | Agent section in AGENTS.md; new run compared; a review posted |
| 19 Capstone | Several agents; merge decisions from evidence | Retro: which MRs/PRs would you merge, and why |

The agent eval gate from Phase 14 checks the agent setup, not the code in an agent's MR/PR. On Day 2 the code is checked by the repo's tests, the participant's review against the picked rules, and the review agent.

## Tools

Participants use any coding tool (Claude Code, Cursor or both) at any time; there are no tracks. Every model call (judges and agents) runs on the participant's own login, detected automatically. CI never holds a model credential: the gate checks a committed recording of a local run.

## Hosts

Phase 1 records `host`: `gitlab`, `github` or `none` (local only). Phases 14–19 choose their path from it. A target with `none` can complete Phases 1–13 locally, but needs a pushed remote from Phase 14 on.

## Safety

Targets may be production repos. All work stays on `dev-days-workshop/<participant>` branches with a start tag, and a push guard blocks everything else. See AGENTS.md → Target safety, and `pnpm workshop cleanup`.

## Out of scope

Fine-tuning, deep RAG evaluation, production monitoring platforms. Mention them, but don't teach them.
