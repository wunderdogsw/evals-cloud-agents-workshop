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

There are 11 pull requests, #101 to #111. The host `github.example.invalid` does not exist, so the links don't open. They only need to be correct links in the report.

The dates are fixed, between July and October 2026. Use a count window ("the last 30 merged PRs") with this folder, not a day window, or the comments drop out as the dates get older.

The answer key for facilitators is in [`review-history-key.md`](../review-history-key.md), outside this folder, so a skill that reads every file here never sees it.
