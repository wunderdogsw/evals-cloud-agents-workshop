# Phase 1 — Attach your target

## What you do

1. **Choose a target** — a GitLab/GitHub URL (for production repos, a mirror the facilitators set up), a local checkout, or `sample`.
2. **Prove it runs** — install the target and run its own tests from the workshop repo, then decide on the result of the CI check.

## Gate

- [ ] The target is on `dev-days-workshop/<participant>`, with a `dev-days-workshop/<participant>-start` tag.
- [ ] Its tests passed in this session, or you switched to `sample`.
- [ ] The CI check found no deploy lines, or the participant confirmed its deploy lines are safe, or you switched to a mirror.

## Learning point

If you can't run a repo, you can't measure anything in it. Don't experiment in a repo where a push could reach production.

## Wanted outcome

A target that runs, on its `dev-days-workshop` branch, with a start tag, a backup of the settings files and a CI check.

---

## 1.1 Choose a target

### [LLM]

> Narrate: "First, a quick check of Node, pnpm, git and the coding tools you'll use today."

Run these commands and report the results in one short block:

```bash
node -v && pnpm -v && git --version
claude --version 2>/dev/null || echo "claude CLI: not installed"
agent --version 2>/dev/null || echo "cursor CLI: not installed"
glab --version 2>/dev/null | head -1 || gh --version 2>/dev/null | head -1 || echo "glab/gh: not installed"
```

- Node is older than 22.12, or pnpm is missing → run `corepack enable` (or install Node 22+). Don't continue until this is fixed. If `node_modules/` is missing at the root, run `pnpm install`.
- The agent-setup phases need **Claude Code 2.1.283 or later**. (`/doctor prompt-audit` was added in 2.1.283.) If it is older, run `claude update`. If it is missing, install it: run `curl -fsSL https://claude.ai/install.sh | bash`, then run `claude` to log in. Install it even if they mostly use Cursor, because Phases 2–5 use checks that only Claude Code has.
- Cursor CLI (`agent`) is optional. Test each installed tool with one short prompt: `claude -p "Reply with: ok" --tools ""` or `agent -p "Reply with: ok"`. If you get a login error, they log in from their own terminal.
- Phase 14 and later need `glab` / `gh` to open MRs/PRs. Tell them this, but don't stop the phase for it.
- Never ask them to paste a key or token into the chat.

### [HUMAN]

Show the three options and ask which one they want:

1. **A GitLab or GitHub URL** — if the repo has code in production, use the workshop mirror your facilitators set up. The repo is cloned as a new copy into `targets/`.
2. **A local checkout** — a path like `~/code/my-service`. It is added as a git worktree on a new branch, so their own checkout does not change.
3. **`sample`** — the included `cost-coder` app. It is written in TypeScript, has an LLM feature, and has an agent setup with problems added on purpose. This option always works.

Also ask for a short participant name to use in the branch name. The default is their git user name.

A good target builds in a few minutes and has tests. It also has agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`) and a history of merged changes that changed tests. If they are unsure, use their mirror if they have one. Otherwise, use `sample`.

## 1.2 Prove it runs

### [LLM]

> Narrate: "All your work today happens on a `dev-days-workshop` branch. Your default branch does not change."

```bash
pnpm workshop attach <url | path | sample> --participant <name>
```

This command clones the target, adds it as a worktree, or copies it. It creates `dev-days-workshop/<participant>` and tags the start point as `dev-days-workshop/<participant>-start`. It backs up `~/.claude/settings.json`, `~/.claude/CLAUDE.md` and `~/.cursor/hooks.json`. It writes `.workshop/targets/<name>/profile.json` and runs the CI check.

Summarise the profile in **at most 6 lines**: stack, host, default branch, install/build/test commands, agent instruction files found, and the result of the CI check.

The profile step guesses the commands, and some guesses can be wrong. Check the target's README, CI config and build files. Correct any wrong command **in the profile JSON** (`commands.install`, `commands.build`, `commands.test`). Then run the install and test commands from `targets/<name>/`. Show only the last lines of the output while it runs.

### [HUMAN]

They make two decisions:

- **Tests:** they watch the test run. If the tests fail, and you can't fix them in about 15 minutes, they decide whether to switch to `sample`. Common causes are a missing SDK, a private package registry, or a database the tests need.
- **CI check:** if the result is `REVIEW`, show the lines it listed. Only they (or the repo owner) can confirm that those jobs never run on `dev-days-workshop/*` branches or on their MRs/PRs. If they can't confirm it, they switch to a mirror or `sample`. Nothing is pushed before Phase 14. But if they switch repos at that point, they lose the day's work.

### [BRANCH]

- **Tests fail** → find the cause first: a missing toolchain, registry login, a service the tests need, or environment variables. Fix what you can. For what you can't fix, say exactly what they need and who can give it to them.
- **CI check says REVIEW and they can't confirm** → attach a mirror again (`pnpm workshop attach <mirror-url> --participant <name>`) or `sample`.
- **Target is `sample`** → the tests pass without a network connection, and the CI check reports no remote. They don't need to decide anything.

## 1.3 Gate check

The participant confirms, and you verify:

- [ ] The target is on `dev-days-workshop/<participant>`, with a `dev-days-workshop/<participant>-start` tag. — `git -C targets/<name> branch --show-current` and `git -C targets/<name> tag --list "dev-days-workshop/*"`
- [ ] Its tests passed in this session, or you switched to `sample`. — the test run you showed in 1.2
- [ ] The CI check found no deploy lines, or the participant confirmed its deploy lines are safe, or you switched to a mirror. — `ciCheck.verdict` in the profile, plus their confirmation if it says REVIEW

---

## Phase Complete

Mark Phase 1 complete. Preview: "Phase 2 — before you measure anything, find out which instructions your coding agent gets about this repo."
