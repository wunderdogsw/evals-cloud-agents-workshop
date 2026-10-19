---
name: review-lessons
description: Reads the review comments on this repository's recently merged pull requests or merge requests and reports the problems reviewers keep pointing out, with the one file where a change could stop each problem and links to the comments. Use when asked what reviewers keep saying, which review comments come back, or what to change so they stop.
argument-hint: "[report path] [--data <folder>] [--last <n> | --days <n>]"
---

# Review lessons

Find the problems that reviewers point out again and again, and say where a change could stop them. This skill only reads. It never comments on a pull request or merge request, and it changes no file except the report.

Arguments: $ARGUMENTS

- **Report path** (optional): an absolute path ending in `.md`. Print the report, and also write it to this path.
- `--data <folder>` (optional): read the review history from this folder instead of calling the host's API. The files have the same shapes as the GitHub REST responses: `pulls.json`, `pulls/<n>/comments.json`, `pulls/<n>/reviews.json` and `issues/<n>/comments.json`.
- `--last <n>` or `--days <n>` (optional): the time window. The default is the last 30 merged pull requests or merge requests.

## 1. Collect the comments

Run each API call as one command, without pipes. Use the `--jq` option of `gh api` to filter, not a separate `jq`.

**With `--data`:** read `pulls.json` and the JSON files under `pulls/` and `issues/` with the Read tool. Read no other file in the folder, and call no API.

**GitHub** (the `origin` remote is on GitHub or GitHub Enterprise): take `{owner}/{repo}` and the host from `git remote get-url origin`. On a host other than github.com, add `--hostname <host>` to every call. Use REST calls only, never `gh pr`, because `gh pr` uses GraphQL.

- Merged pull requests: `gh api "repos/{owner}/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100"`. Keep only the ones with `merged_at`. Read the next page only until the window is full.
- Per pull request `<n>`: `gh api repos/{owner}/{repo}/pulls/<n>/comments` (inline comments), `gh api repos/{owner}/{repo}/pulls/<n>/reviews` (review bodies) and `gh api repos/{owner}/{repo}/issues/<n>/comments` (top-level comments).

**GitLab** (the `origin` remote is on GitLab):

- Merged merge requests: `glab api "projects/:fullpath/merge_requests?state=merged&order_by=merged_at&per_page=100"`. On GitLab older than 17.2, use `order_by=updated_at`.
- Per merge request `<iid>`: `glab api projects/:fullpath/merge_requests/<iid>/discussions`. Skip notes with `"system": true`.

## 2. Keep only reviewer comments

Leave out:

- pull requests that were closed without a merge (`merged_at` is empty);
- bots: on GitHub `user.type` is `"Bot"` or the login ends in `[bot]`; on GitLab the username looks like `project_<id>_bot_<random>`;
- comments by the pull request's own author (their replies, such as "Renamed.");
- empty review bodies.

## 3. Group the comments into findings

Group the comments by the kind of problem they point out, across pull requests. A group is a finding when it has comments in **at least two different merged pull requests**. One comment is an opinion. The same comment in several pull requests is a pattern.

For each finding, decide where a change could stop the problem from coming back. Name one file:

- an agent file: `CLAUDE.md`, `AGENTS.md`, a `.claude/rules/` file, a skill or a hook;
- or another file: lint config, test config, a test helper, a pull request template, a CI job;
- or write "no file change would help".

Read that file in the repository first. If it already has the rule, say so: more text in the same file is unlikely to help, so name a file that can check the rule instead. The code files that the comments were on are evidence only. They are never the answer to "where".

## 4. Write the report

Start with one line: the repository, the window, how many merged pull requests and how many reviewer comments were read.

Then one block per finding, the finding with the most comments first:

```markdown
### <short name of the problem>
- What reviewers said: <the kind of problem, in one sentence> (<n> comments, <m> PRs)
- Where a change could help: <one file, and the change in a few words>
- Evidence: <link to one comment> (<file the comment was on>), <link> (<file>), …
```

Each evidence link points at one comment: the comment's `html_url` on GitHub, or the merge request URL with `#note_<id>` on GitLab. Never link a whole pull request.

End with `## Other comments`: one line with the number of reviewer comments that fit no finding, and their topics in a few words. Do not list them one by one.

Print the report. If a report path was given, write the same text to that path, and nothing else.
