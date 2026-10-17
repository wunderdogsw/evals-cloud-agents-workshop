# Phase 6 — Turn your rules into expectations

## What you do

1. **List the rules** — every rule in the instruction files, `.claude/rules/` and hooks, one row each in `expectations.md`.
2. **Mark how each is checked** — by code (files touched, tests added, a command passes) or by a judge (placement, naming, explanation quality).
3. **Pick five** — the five whose breaking costs most, at least two of each kind, each with a reason.

## Gate

- [ ] Every rule in `expectations.md` has a check type and a one-line "how".
- [ ] Five rules are picked, at least two code and two judge, each with a reason.

## Learning point

A rule you can't check is a wish. Deciding how each rule is checked shows which rules are really specific.

## Wanted outcome

An `expectations.md` with five picked rules marked as code- or judge-checkable, which the agent tasks and graders in Phases 7–11 are built on.

---

## 6.1 List the rules

### [LLM]

> Narrate: "Your setup now says what the agent should do. Next: which of those rules can we actually check?"

Collect the candidate sources from the committed setup, so nothing is missed:

```bash
cd targets/<name>
cat CLAUDE.md AGENTS.md 2>/dev/null
ls .claude/rules 2>/dev/null && cat .claude/rules/*.md
cat .claude/settings.json 2>/dev/null
```

Don't extract the rules for them. Point out that a hook from Phase 5 is a rule too, and that its row checks whether the agent ever *tries* to break it.

### [HUMAN]

They create `.workshop/targets/<name>/expectations.md` with this table and add one row per rule, numbered R1, R2, …:

| # | Rule | Source | Check | How | Tasks | Picked |
|---|---|---|---|---|---|---|

Rule is one line in their words; Source is the file it came from. Leave Check, How, Tasks and Picked empty for now. Facts that aren't rules (project layout, the install command) don't get a row.

## 6.2 Mark how each is checked

### [LLM]

Explain the two kinds, with one example each from their own list:

- **code**: a script can decide from the diff or a command result. Files touched or not touched, a matching test file added, typecheck or tests pass. Cheap, fast, can't be argued with.
- **judge**: needs reading and judgement. Where logic lives, whether a name fits the domain, whether a change explains itself. A model grades it against a rubric, and you calibrate that judge in Phase 11.

If a rule can be checked by code, it's code, even when a judge could also do it.

### [HUMAN]

They fill **Check** (`code` or `judge`) and **How** (one line: what the check looks at) for every row. A rule they can't fill a "how" for gets `none` and a note: rewrite it more specifically, or accept it as guidance that won't be measured.

## 6.3 Pick five

### [HUMAN]

They mark five rows `yes` in **Picked**, each with a reason: what breaks, and for whom, when the agent ignores this rule. At least two must be `code` and two `judge`. Rows not picked get `no` and a short reason ("typecheck already catches it", "cosmetic").

Challenge any pick that's already enforced elsewhere: a rule the CI typecheck catches adds little. A hook-backed rule is fine to keep; it shows whether the agent tries to break it.

### [BRANCH]

- **Target is `sample`** → compare with `kit/catchup/cost-coder/expectations.md` only **after** they've written their own. Differences are fine if they have reasons.
- **Fewer than two judge rules** → look in their code review history: what do reviewers keep pointing out? That's usually a judge rule nobody wrote down. Add it to the instruction file (and commit) before picking it.
- **Fewer than five checkable rules in total** → their setup is too thin to measure. Go back to the instruction file, add the rules reviewers enforce, commit, then pick.

## 6.4 Gate check

The participant confirms, and you verify:

- [ ] Every rule in `expectations.md` has a check type and a one-line "how". — read `.workshop/targets/<name>/expectations.md`: no empty Check or How cells
- [ ] Five rules are picked, at least two code and two judge, each with a reason. — count the `yes` rows by Check type in `expectations.md`

---

## Phase Complete

Mark Phase 6 complete. Preview: "Phase 7 — build 5–10 agent tasks from your own merged changes that exercise the five rules you picked."
