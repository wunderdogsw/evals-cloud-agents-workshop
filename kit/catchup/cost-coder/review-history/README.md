# Review history for the sample target

The sample target `cost-coder` has no pull requests, so a skill that reads review comments has nothing to read. This folder is a made-up review history for it. Phase 16 builds the `review-lessons` skill against it.

`pnpm workshop install <name> review-history` copies this folder to `.workshop/targets/<name>/review-history/`. It works only for the sample and catch-up targets. The files never go into the target repo.

## Files

Each file has the same shape as the `gh api` response for the endpoint in the second column. Replace `repos/{owner}/{repo}/` with this folder:

| File | GitHub REST endpoint |
|---|---|
| `pulls.json` | `repos/{owner}/{repo}/pulls?state=closed` |
| `pulls/<n>/comments.json` | `repos/{owner}/{repo}/pulls/<n>/comments` (inline review comments) |
| `pulls/<n>/reviews.json` | `repos/{owner}/{repo}/pulls/<n>/reviews` (review bodies) |
| `issues/<n>/comments.json` | `repos/{owner}/{repo}/issues/<n>/comments` (top-level comments) |

There are 11 pull requests, #101 to #111. Ten are merged. #111 was closed without a merge, so a skill must leave it out. The host `github.example.invalid` does not exist, so the links don't open. They only need to be correct links in the report.

The dates are fixed, between July and October 2026. Use a count window ("the last 30 merged PRs") with this folder, not a day window, or the comments drop out as the dates get older.

## What a skill should find

This section is for facilitators. Participants should build their skill before they read it.

The comments refer to real files in [`samples/cost-coder`](../../../../samples/cost-coder). About 25 come from reviewers on merged pull requests. Four kinds of problem come back across several pull requests:

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
