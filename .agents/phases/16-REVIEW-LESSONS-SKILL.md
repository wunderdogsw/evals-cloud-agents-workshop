# Phase 16 — Build a review-lessons skill

## What you do

1. **Install skill-creator** — run `/plugin install skill-creator@claude-plugins-official` in the target session.
2. **Build the skill** — with skill-creator, build `.claude/skills/review-lessons/`, which reads merged PRs/MRs and their review comments and writes a findings report.
3. **Test it** — use skill-creator's eval mode to run the same prompts with and without the skill, and read the difference.

## Gate

- [ ] `.claude/skills/review-lessons/SKILL.md` is committed on the workshop branch.
- [ ] The with/without benchmark ran, and its result is noted.
- [ ] The first report exists, and each finding has its three parts: what the comments were about, where a change could help, and the evidence.

## Learning point

The review-comment reading you did by hand in Phases 4 and 6 can be a skill. skill-creator shows whether the skill really changes the result before you depend on it.

## Wanted outcome

A committed `review-lessons` skill and its first report, which Phase 17 acts on.

---

## 16.1 Install skill-creator

### [LLM]

> Narrate: "In Phases 4 and 6 you read review comments by hand to find rules. Today an agent does that reading for you. First we install the tool that helps build and test the skill."

Run `pnpm workshop status` and read the profile. This phase needs only the target on its workshop branch. It does not need evals, so it also works for a target that skipped Day 1. Check which tools are installed and say so in one line:

```bash
claude --version 2>/dev/null; agent --version 2>/dev/null; python3 --version 2>/dev/null
```

Explain, from the Claude Code skills and plugin docs:

- **skill-creator** is a plugin from Anthropic's official marketplace, `claude-plugins-official`. It interviews you, writes a skill, and tests it. Its test scripts need Python 3.
- A plugin has an install **scope**, which decides which settings file turns it on. **User** scope writes `~/.claude/settings.json`. **Project** scope writes `.claude/settings.json`, which is committed and turns the plugin on for the whole team. **Local** scope writes `.claude/settings.local.json`, which is only for you, in this repo.
- Use **local** scope. It changes no user-level settings and commits nothing. Claude Code still keeps the downloaded plugin files in its own cache in your home folder. That is not a setting.

Claude Code keeps `.claude/settings.local.json` out of git. If the repo doesn't ignore the file yet, Claude Code adds it to your global git excludes file, which is a user-level file. Prevent that with a local exclude in the target, which is never committed:

```bash
git -C targets/<name> check-ignore -q .claude/settings.local.json || echo ".claude/settings.local.json" >> targets/<name>/.git/info/exclude
```

If `check-ignore` already matches, for example through a global ignore file, nothing needs to change.

This phase uses two sessions. The guide stays in this session, in the workshop repo. The participant opens a second Claude Code session with `targets/<name>` as its folder: in a terminal `cd targets/<name> && claude`, or in the Desktop app a new session on that folder. This is the **target session**. The plugin and the skill must be set up there, not here: local scope in this session would write the workshop repo's settings, not the target's. When the target session asks whether to trust the folder, they accept. Without that, later runs without the interactive screen (Phase 17) ignore the target's own permission settings.

When the workshop is over, they can remove the plugin with `claude plugin uninstall skill-creator@claude-plugins-official --scope local`, run in `targets/<name>`.

### [HUMAN]

In the target session they run:

```text
/plugin install skill-creator@claude-plugins-official
```

This command opens the plugin's details. It doesn't install anything yet. They read what the plugin adds, then choose **Install for you, in this repo only (local scope)**. They check the scope in the **Installed** tab of `/plugin`. They can also run `claude plugin list` in `targets/<name>`, which prints a `Scope` line for each plugin.

From a terminal instead of the session, the scope must be given, because the CLI installs at user scope by default. Run it in `targets/<name>`:

```bash
claude plugin install skill-creator@claude-plugins-official --scope local
```

### [BRANCH]

- **Claude Code says `Marketplace "claude-plugins-official" not found`** → `/plugin marketplace add anthropics/claude-plugins-official` fixes it, but it registers the marketplace in user settings. Ask the participant first. If they say no, they pair with someone who has the plugin, or take the Cursor path below.
- **Claude Code says the plugin is not found in the marketplace** → run `/plugin marketplace update claude-plugins-official` and install again.
- **Desktop app** → click **+** next to the prompt box, then **Plugins** and **Add plugin**. Select skill-creator and choose the local-only scope.
- **Only Cursor, no Claude Code** → skill-creator is a Claude Code plugin, so they don't install it. They save its instructions outside the target and give them to Cursor's agent in 16.2:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md -o .workshop/targets/<name>/skill-creator.md
  ```

  Cursor loads skills from `.claude/skills/` too, so the skill they build works in both tools.

## 16.2 Build the skill

### [LLM]

> Narrate: "You write what the skill must do. skill-creator turns that into a skill and asks you about what is missing."

Explain the requirements the skill must meet. Don't write the request for them.

- **Data source on GitHub:** `gh api` REST calls only. Merged PRs from `repos/{owner}/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100` (keep the ones with `merged_at`, and read more pages only until the time window is full). Per PR: inline review comments from `repos/{owner}/{repo}/pulls/<n>/comments`, review bodies from `repos/{owner}/{repo}/pulls/<n>/reviews`, and top-level comments from `repos/{owner}/{repo}/issues/<n>/comments`. Not `gh pr …`: it uses GitHub's GraphQL API, and Claude Code cloud sessions block GraphQL. Later in this section the same skill runs in a cloud session.
- **Data source on GitLab:** `glab api`. Merged MRs from `projects/:fullpath/merge_requests?state=merged&order_by=merged_at` (`merged_at` ordering needs GitLab 17.2 or later; on older GitLab use `updated_at`). Per MR: `projects/:fullpath/merge_requests/<iid>/discussions`. Skip notes with `"system": true`.
- **Time window:** by default the last 30 merged PRs/MRs. An argument can change it, for example to 90 days.
- **Who counts:** leave out bots (on GitHub `user.type` is `"Bot"` or the login ends in `[bot]`; on GitLab, access-token bots have usernames like `project_<id>_bot_<random>`), the PR/MR author's own replies, and empty review bodies.
- **Report:** one block per finding, in this format:

  ```markdown
  ### Tests placed in the wrong folder
  - What reviewers said: new tests go into test/ instead of next to the code (4 comments, 3 PRs)
  - Where a change could help: .claude/rules/tests.md (new rule for src/**), or vitest.config.ts include pattern
  - Evidence: <PR link>#discussion_r… (src/billing/invoice.test.ts), <PR link>#discussion_r… (src/billing/tax.test.ts)
  ```

  "What reviewers said" is the kind of problem the comments pointed out, grouped across PRs. "Where a change could help" is the one file where a change could stop the problem from coming back. It can be an agent file (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, a skill, a hook), another file (lint config, test helper, PR template), or "no file change would help". The code files the comments were on are evidence only. They are never the answer to "where".
- **Output:** print the report. When a file path is given, also write the report there. Phase 17 runs the skill on a schedule, so it needs the file. In the workshop, the path is `.workshop/targets/<name>/review-lessons/<YYYY-MM-DD>.md` in the workshop repo, never inside the target. Give the skill the absolute path.
- **Read-only:** the skill never comments on a PR/MR and never changes any file except the report.

### [HUMAN]

In the target session they ask skill-creator for the skill in their own words. For example, they start with "Use skill-creator to create a new skill called review-lessons in .claude/skills/review-lessons/" and add the requirements as they understand them. They also tell it where to keep its test workspace: `<absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons-workspace`. Then nothing from the tests ends up in the target.

Claude Code asks before it writes inside `.claude/`. They approve the writes to `.claude/skills/review-lessons/`.

skill-creator interviews them. They answer the questions themselves. Three decisions are theirs:

- How many comments, in how many PRs/MRs, make a finding? One comment is an opinion. The same comment in three PRs is a pattern.
- What happens to comments that fit no finding? Drop them, or list them once at the end?
- When one group of comments needs two different changes (for example a missing CHANGELOG line, and a line written for the wrong readers), is it one finding or two? A fixed rule keeps the report the same shape from week to week.

They read the `SKILL.md` it writes before they accept it. Then they run the skill once and save the first report:

```text
/review-lessons <absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons/<YYYY-MM-DD>.md
```

For the sample or a catch-up target, the data folder comes first:

```text
/review-lessons <absolute path of the workshop repo>/.workshop/targets/<name>/review-history <absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons/<YYYY-MM-DD>.md
```

The report path is outside the target, so Claude Code asks before it writes there. They approve the write to `.workshop/targets/<name>/review-lessons/`.

They read the report and check each finding against the format. Does it have all three parts? Does "where" name one file that could stop the problem? Is a code file listed only as evidence? They open two evidence links and check that the comments say what the finding says. On the sample the links don't open. The number at the end of a link is the comment's `id`, which they find in the review history: `grep -rh -A20 '"id": <id>' .workshop/targets/<name>/review-history/ | grep -m1 '"body"'`.

### [BRANCH]

- **GitHub** (`host: github`) → the skill uses `gh api`. Check `gh auth status` first. On GitHub Enterprise, `gh` needs to be logged in to that host.
- **GitLab** (`host: gitlab`) → the skill uses `glab api`. Check `glab auth status` first.
- **Target is `sample` or a catch-up target** → it has no PRs. This path applies even though the profile says `host: none`. For `sample`, run `pnpm workshop install <name> review-history`; a catch-up target already has it. It copies a made-up review history to `.workshop/targets/<name>/review-history/`, in the same shapes `gh api` returns. They tell skill-creator: "when a data folder is given, read these files instead of calling `gh api`". They pass the folder's absolute path when they run the skill. Each file matches one endpoint, with `repos/{owner}/{repo}/` replaced by the folder:

  | File | `gh api` endpoint |
  |---|---|
  | `pulls.json` | `pulls?state=closed` |
  | `pulls/<n>/comments.json` | `pulls/<n>/comments` (inline review comments) |
  | `pulls/<n>/reviews.json` | `pulls/<n>/reviews` (review bodies) |
  | `issues/<n>/comments.json` | `issues/<n>/comments` (top-level comments) |

  The dates are fixed, between July and October 2026, so the skill uses a count window ("the last 30 merged PRs"), not a day window.
- **Own repo with no remote** (`host: none`) → there is no PR/MR history to read. Build the skill for the host the team uses, and test it against `kit/catchup/cost-coder/review-history/` in the workshop repo, read in place.
- **Very few review comments** → widen the window (for example the last 100 merged PRs/MRs, or 180 days), and make sure the skill reads review bodies and top-level comments too. If there are still fewer than about 10 comments, say so: a report from so few comments shows little. They also test the skill against `kit/catchup/cost-coder/review-history/`, read in place.
- **Only Cursor, no Claude Code** → in Cursor's agent chat, in the target, they attach `.workshop/targets/<name>/skill-creator.md` and ask the agent to follow those instructions to build `.claude/skills/review-lessons/`. They answer its questions themselves. To run the skill they type `/review-lessons` in Cursor's agent chat, with the same path argument.

## 16.3 Test it

### [LLM]

> Narrate: "A skill can look good and still change nothing. skill-creator runs the same prompts twice: once with the skill and once without it. Then we see what the skill adds."

Explain, from skill-creator's own instructions:

- Test prompts are saved in `evals/evals.json` inside the skill folder. Checks on the output (skill-creator calls them assertions) are added to the same file.
- For each prompt it starts two subagents: one with the skill and one without it. The run without the skill has the same tools, so it can call `gh api` too. The difference shows what the skill adds: the filtering, the grouping and the format.
- skill-creator's default place for the results is a `review-lessons-workspace/` folder next to the skill folder, inside the target. In 16.2 they told it to use `.workshop/targets/<name>/review-lessons-workspace/` instead. `iteration-1/` holds the first run, `iteration-2/` the run after a change. `benchmark.md` and `benchmark.json` show the pass rate, time and tokens with and without the skill. A viewer opens the outputs in the browser.
- Each prompt costs two agent runs. Three prompts use about 0.5 million tokens. Report the token figures from `benchmark.md`. It runs each prompt once, so the "±" is the spread across prompts, not across repeats of one prompt.

Check the workspace before the participant reads the results, because skill-creator's own files don't always agree on the folder layout:

- `benchmark.md` shows no runs → its script reads only `eval-<n>/<with_skill|without_skill>/run-1/grading.json`. Ask skill-creator to move each run into a `run-1/` folder and build the benchmark again.
- The viewer shows "(No prompt found)" → the viewer looks for `eval_metadata.json` in the run folder or the folder above it. Ask skill-creator to copy it into each `with_skill/` and `without_skill/` folder and build the viewer again.
- The run without the skill takes place in the target session, where the new skill is already a project skill. Check in its transcript or output that it did not read `.claude/skills/review-lessons/`. If it did, the comparison is not with and without. Ask skill-creator to tell the baseline subagents not to use the skill, and run again.

### [HUMAN]

They write 2–3 test prompts themselves. Each prompt is a question a teammate would ask, without the report format and without the skill's name. For example: "What did reviewers keep pointing out in our last 30 merged PRs?" For the sample, the prompt gives the review-history folder.

They write the assertions themselves too. Examples:

- Every finding has the three lines: what reviewers said, where a change could help, evidence.
- Every evidence link points at a single comment, not at a whole PR/MR.
- No bot comment is used as evidence.
- For the sample: nothing from #111 is used, because it was not merged.

Before the run, ask: "What difference do you expect between with and without?" Then they ask skill-creator to run the eval: "Test the review-lessons skill with my prompts, with and without the skill, and show the benchmark." They skip the description optimization step that skill-creator may offer: it runs many `claude -p` calls, and Phase 17 starts the skill by name.

They read `benchmark.md` and the viewer. They look at which assertions passed in both runs: those don't measure the skill. Often the run without the skill finds the same problems, and the skill mostly adds the fixed format and the links to single comments. That is what a weekly job needs, because the team reads the same shape every week. They write one line in `.workshop/targets/<name>/findings.md` (create the file if it doesn't exist) under `## review-lessons benchmark`: the pass rate with and without, the tokens, and what they changed in the skill because of it. If they changed the skill, they run 16.2's command again, so the saved report comes from the final skill.

Then they commit only the skill. `evals/evals.json` in the skill folder holds the test prompts. If it contains absolute paths from their machine, they replace them with a placeholder such as `<data folder>` first. If skill-creator put the workspace inside the target after all, they move it out before the commit:

```bash
[ -d targets/<name>/.claude/skills/review-lessons-workspace ] && mv targets/<name>/.claude/skills/review-lessons-workspace .workshop/targets/<name>/review-lessons-workspace
git -C targets/<name> add .claude/skills/review-lessons
git -C targets/<name> status --short
git -C targets/<name> commit -m "workshop: review-lessons skill"
```

If the workspace is in neither place, they ask skill-creator where it wrote it. Don't commit `.claude/settings.local.json`. Don't push: Phase 17 uses the skill locally.

### [BRANCH]

- **Only Cursor, no Claude Code** → they compare by hand. The same prompt runs twice with the Cursor CLI, once with the skill folder and once without it:

  ```bash
  mkdir -p .workshop/targets/<name>/review-lessons
  agent -p --force --trust --workspace targets/<name> "<their prompt>" > .workshop/targets/<name>/review-lessons/with-skill.md
  mv targets/<name>/.claude/skills/review-lessons .workshop/targets/<name>/review-lessons-aside
  agent -p --force --trust --workspace targets/<name> "<their prompt>" > .workshop/targets/<name>/review-lessons/without-skill.md
  mv .workshop/targets/<name>/review-lessons-aside targets/<name>/.claude/skills/review-lessons
  git -C targets/<name> status --short
  ```

  `--force` lets the agent run `gh api` without asking, so `git status` must show no changes. They check both reports against their own assertions and write the result in `findings.md` in the same way.
- **No Python 3** → skill-creator can't run its benchmark script or viewer. They ask it to show the with/without comparison in the chat instead, and note that in `findings.md`.
- **With and without look the same** → the prompt probably asks for the format, so the run without the skill can copy it. They make the prompt a plain question and run again.
- **A run has no output file** → Claude Code may have stopped the subagent from writing a report file. Ask skill-creator to save the run's final message as its output, then grade it.

## 16.4 Gate check

The participant confirms, and you verify:

- [ ] `.claude/skills/review-lessons/SKILL.md` is committed on the workshop branch. — `git -C targets/<name> log --stat -1 -- .claude/skills/review-lessons` on `dev-days-workshop/<participant>`, and `git -C targets/<name> ls-files | grep -e review-lessons-workspace -e settings.local.json` prints nothing
- [ ] The with/without benchmark ran, and its result is noted. — read `## review-lessons benchmark` in `.workshop/targets/<name>/findings.md` and the latest `.workshop/targets/<name>/review-lessons-workspace/iteration-*/benchmark.md`; on the Cursor path, the `with-skill.md` and `without-skill.md` reports
- [ ] The first report exists, and each finding has its three parts: what the comments were about, where a change could help, and the evidence. — read `.workshop/targets/<name>/review-lessons/<YYYY-MM-DD>.md`: every `###` finding has the three lines, and each evidence entry is a link to one comment

---

## Phase Complete

Mark Phase 16 complete. Preview: "Phase 17 — run the skill, decide which findings are worth a change, and schedule it on your own machine."
