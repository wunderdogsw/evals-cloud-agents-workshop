# REVIEW.md — what review agents check in this repo

Report only real problems, most severe first, each with `file:line` and a one-line fix.

1. **Correctness** — logic errors, unhandled error paths, off-by-ones, wrong units (EUR vs cents, gross vs net).
2. **Tests** — new behaviour without a test; tests that assert nothing; tests changed to fit the code.
3. **Evals** — any change in `evals/suites/agent/` (rule graders, rubrics, thresholds, `last-run.json`) without a stated reason must block the merge.
4. **Repo rules** — changes that break a rule in AGENTS.md, CLAUDE.md or `.claude/rules/`; name the rule.
5. **Scope** — changes unrelated to the MR/PR's stated goal.
6. **Conventions** — anything else AGENTS.md says.

Do not comment on formatting a linter would catch. If there is nothing to report, say so in one sentence.
