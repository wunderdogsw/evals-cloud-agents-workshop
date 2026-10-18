# Phase 6 — Turn your rules into expectations

## What you do

1. **List the rules** — write every rule from the instruction files, `.claude/rules/` and hooks as one row in `expectations.md`.
2. **Mark how each is checked** — by code (files touched, tests added, a command passes), by a judge (placement, naming, quality of explanation), or as a hard gate that a hook, lint rule or CI check enforces instead of an eval.
3. **Pick five** — choose the five rules that cause the most damage when broken, at least two of each kind, each with a reason.

## Gate

- [ ] Every rule in `expectations.md` has a check type (`code`, `judge` or `gate`) and a one-line "how".
- [ ] At least one rule is a `gate`, with what enforces it and why one failure is not acceptable.
- [ ] Five rules are picked, at least two code and two judge, each with a reason.

## Learning point

If you can't check a rule, you can't tell whether the agent follows it. If a rule must hold every time, enforce it with a hook, lint rule or CI check instead; evals are for rules where some failures are acceptable and you want to know how often they happen.

## Wanted outcome

You have an `expectations.md` with five picked rules, each marked as checkable by code or by a judge, and Phases 7–11 build the agent tasks and graders from these rules.

---

## 6.1 List the rules

### [LLM]

> Narrate: "Your setup now says what the agent should do. Next, we find out which of those rules we can check."

Collect the files that can contain rules from the committed setup, so you don't miss any:

```bash
cd targets/<name>
cat CLAUDE.md AGENTS.md 2>/dev/null
ls .claude/rules 2>/dev/null && cat .claude/rules/*.md
cat .claude/settings.json 2>/dev/null
```

Don't extract the rules for them. Tell them that a hook from Phase 5 is also a rule.

### [HUMAN]

They create `.workshop/targets/<name>/expectations.md` with this table. They add one row per rule and number the rows R1, R2, …:

| # | Rule | Source | Check | How | Tasks | Picked |
|---|---|---|---|---|---|---|

Rule is one line in their own words. Source is the file the rule came from. Leave Check, How, Tasks and Picked empty for now. Facts that are not rules get no row, for example the project layout or the install command.

## 6.2 Mark how each is checked

### [LLM]

Explain the three kinds of check. Give one example of each from their own list:

- **gate**: the rule must hold every time, and a script can check it. Then don't measure it, enforce it: a `PreToolUse` hook, a lint rule, a typecheck or a CI job that blocks the merge. The test question: "Would one failure be acceptable?" If the answer is no, it's a gate. A skill step such as "run typecheck before you say done" is a typical gate: the agent may skip it, a CI check can't.

- **code**: a script can decide from the diff or from a command result. Examples: which files were touched or not touched, whether a matching test file was added, whether typecheck or tests pass. These checks cost little, run fast and always give the same answer.
- **judge**: a check that needs someone to read the change and decide. Examples: where the logic is placed, whether a name fits the domain, whether a change explains itself. A model grades it against a rubric (a written list of what to look for). In Phase 11 you calibrate that judge: you check its answers against your own labels.

Prefer the cheapest check that works: gate before code, code before judge. A hook is a gate only where it runs. It runs in Claude Code with this project's settings, but not in every tool or cloud agent. A CI check runs on every MR/PR.

### [HUMAN]

They fill **Check** (`code`, `judge` or `gate`) and **How** for every row. How is one line that says what the check looks at. For a `gate` row, How names what enforces it ("hook: protect-data.mjs", "CI: typecheck") and says what breaks if it fails once. If nothing enforces it yet, they write `missing:` and the tool that should. If they can't write a "how" for a rule, they write `none` and a note. The note says one of two things: rewrite the rule to be more specific, or accept it as guidance that nobody will measure.

## 6.3 Pick five

### [HUMAN]

They mark five rows `yes` in **Picked**. Each pick needs a reason: what breaks, and for whom, when the agent ignores this rule. At least two picks must be `code` and at least two must be `judge`. Rows they don't pick get `no` and a short reason ("typecheck already catches it", "cosmetic").

`gate` rows normally get `no: gate` and the tool that enforces it. They don't need an eval, because the gate stops every failure. Question any pick that a gate already covers.

One exception: a gate that runs in only one tool, such as a Claude Code hook. They may pick it as a `code` rule to see what the agent does where the gate doesn't run: in the Phase 8 run without the setup, in Cursor, or in a cloud agent. The reason must say so.

### [BRANCH]

- **Target is `sample`** → compare with `kit/catchup/cost-coder/expectations.md` only **after** they've written their own. Differences are fine if they have reasons.
- **Fewer than two judge rules** → look at their code review history. What do reviewers point out again and again? That is usually a judge rule that nobody wrote down. Add it to the instruction file (and commit) before they pick it.
- **Fewer than five checkable rules in total** → their setup has too few rules to measure. Go back to the instruction file, add the rules that reviewers enforce, commit, then pick.

## 6.4 Gate check

The participant confirms each item, and you verify it:

- [ ] Every rule in `expectations.md` has a check type (`code`, `judge` or `gate`) and a one-line "how". — read `.workshop/targets/<name>/expectations.md`: no empty Check or How cells
- [ ] At least one rule is a `gate`, with what enforces it and why one failure is not acceptable. — find a `gate` row whose How names the hook, lint rule or CI check and what breaks
- [ ] Five rules are picked, at least two code and two judge, each with a reason. — count the `yes` rows by Check type in `expectations.md`

---

## Phase Complete

Mark Phase 6 complete. Preview: "Phase 7 — build 5–10 agent tasks from your own merged changes. The tasks test the five rules you picked."
