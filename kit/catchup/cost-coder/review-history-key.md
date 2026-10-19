# Answer key for the sample review history


This file is for facilitators. It sits outside `review-history/` so that a skill reading that folder never sees it. Participants should build their skill before they read it.

The comments refer to real files in [`samples/cost-coder`](../../../samples/cost-coder). About 25 come from reviewers on merged pull requests. Four kinds of problem come back across several pull requests:

| Problem | Comments | Pull requests | Where a change could help |
|---|---|---|---|
| Tests are not in the matching `test/<module>.test.ts`, or new code has no test | 4 | #104, #105, #106 | `AGENTS.md` already has the rule, so it is not enough. A `.claude/rules/` file with `paths` for `src/**`, or a check in CI |
| Finnish decimal commas are parsed or formatted inside `src/classify.ts` | 6 | #102, #107 | A `.claude/rules/` file for `src/classify.ts`, or one parse function at the input in `src/cli.ts` |
| `CHANGELOG.md` line is missing, or written for developers instead of users | 5 | #101, #103, #105, #106, #109 | A pull request template with a CHANGELOG check box, or an example line in `AGENTS.md` |
| Unit tests call the real model instead of the mock | 4 | #104, #106, #108 | `vitest.config.ts`: set `COST_CODER_MOCK=1` for every test run. One reviewer suggests this in #108 |

The rest is noise that a good report leaves out or lists only once:

- One-off comments: a variable name, a named constant, reuse of `isCostCode`, praise, "LGTM".
- One comment about an edit under `data/` (#109). It happened once, and the Phase 5 hook already blocks it.
- Replies from the pull request's author ("Renamed.", "Moved them to test/codes.test.ts.").
- Empty review bodies (an approval with no text).
- Five bot comments: `github-actions[bot]`, `renovate[bot]` and `copilot-pull-request-reviewer[bot]`. They have `"type": "Bot"`. #110 is also opened by a bot.
- The comments on #111, which was not merged.

Two comments touch two problems each: the #105 review body ("add the CHANGELOG line, and move the tests") and the #106 inline comment about a missing test that should run offline. A skill that files each comment under one problem counts one fewer comment for the tests problem and for the mock problem. Both counts are correct.
