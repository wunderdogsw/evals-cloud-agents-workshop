# Review lessons — workshop/cost-coder

Window: the last 30 merged pull requests. The history has 10 (#101–#110, July–October 2026), with 26 reviewer comments. Left out: #111 (closed without a merge), 5 bot comments, 3 replies by the pull request's author and 9 empty review bodies.

### Finnish decimal commas handled inside the classifier
- What reviewers said: amounts are parsed from or formatted to the Finnish "1 840,00" form inside `src/classify.ts`, but the core code should only see plain numbers (6 comments, 2 PRs)
- Where a change could help: `.claude/rules/llm.md`, which already loads for `src/classify.ts`: add "amounts are numbers here; parse and format Finnish commas only in `src/cli.ts`". `AGENTS.md` already has the rule, and it was not enough.
- Evidence: https://github.example.invalid/workshop/cost-coder/pull/102#discussion_r2010200 (src/classify.ts), https://github.example.invalid/workshop/cost-coder/pull/102#discussion_r2010201 (src/classify.ts), https://github.example.invalid/workshop/cost-coder/pull/102#pullrequestreview-4010200 (review), https://github.example.invalid/workshop/cost-coder/pull/107#discussion_r2010700 (src/classify.ts), https://github.example.invalid/workshop/cost-coder/pull/107#discussion_r2010701 (src/classify.ts), https://github.example.invalid/workshop/cost-coder/pull/107#pullrequestreview-4010700 (review)

### CHANGELOG line missing or written for developers
- What reviewers said: the change has no line under `## Unreleased` in `CHANGELOG.md`, or the line describes the code instead of what changes for the people who use cost-coder (5 comments, 5 PRs)
- Where a change could help: `.github/pull_request_template.md` (new), with a check box "CHANGELOG.md has a line under Unreleased, written for users" and one example line. `AGENTS.md` already has the rule, and it was not enough.
- Evidence: https://github.example.invalid/workshop/cost-coder/pull/101#pullrequestreview-4010100 (review), https://github.example.invalid/workshop/cost-coder/pull/103#pullrequestreview-4010300 (review), https://github.example.invalid/workshop/cost-coder/pull/105#pullrequestreview-4010500 (review), https://github.example.invalid/workshop/cost-coder/pull/106#issuecomment-3010601 (top-level comment), https://github.example.invalid/workshop/cost-coder/pull/109#discussion_r2010901 (CHANGELOG.md)

### Unit tests call the real model
- What reviewers said: tests call `classifyLine` or the retry without `COST_CODER_MOCK=1` or a fake client, so they need a login and fail in CI (4 comments, 3 PRs)
- Where a change could help: `vitest.config.ts`: set `COST_CODER_MOCK=1` in `test.env` for every test run. A reviewer suggested this in #108. The rule is already in `AGENTS.md` and `.claude/rules/llm.md`.
- Evidence: https://github.example.invalid/workshop/cost-coder/pull/104#discussion_r2010401 (test/parse-classification.test.ts), https://github.example.invalid/workshop/cost-coder/pull/106#discussion_r2010600 (src/llm/llm.ts), https://github.example.invalid/workshop/cost-coder/pull/108#discussion_r2010800 (test/classify.test.ts), https://github.example.invalid/workshop/cost-coder/pull/108#discussion_r2010801 (test/classify.test.ts)

### Tests in the wrong file, or no test for new code
- What reviewers said: tests for a module go into a new file instead of the matching `test/<module>.test.ts`, or new code comes without a test (4 comments, 3 PRs)
- Where a change could help: `.claude/rules/tests.md` (new), with `paths` for `src/**` and `test/**`: "tests for `src/<module>.ts` go in `test/<module>.test.ts`; add to that file, don't create a second one". `AGENTS.md` already has the rule, and it was not enough.
- Evidence: https://github.example.invalid/workshop/cost-coder/pull/104#discussion_r2010400 (test/parse-classification.test.ts), https://github.example.invalid/workshop/cost-coder/pull/105#discussion_r2010500 (test/classify.test.ts), https://github.example.invalid/workshop/cost-coder/pull/105#pullrequestreview-4010500 (review), https://github.example.invalid/workshop/cost-coder/pull/106#discussion_r2010600 (src/llm/llm.ts)

## Other comments

9 reviewer comments fit no finding: a variable name, a named constant, reuse of `isCostCode`, one edit under `data/` (#109), the vitest release notes, and four approvals or thanks.
