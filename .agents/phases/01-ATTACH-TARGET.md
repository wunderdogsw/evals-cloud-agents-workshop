# Phase 1 — Attach your target

## What you do

1. **Choose a target** — a GitLab/GitHub URL (a facilitator mirror for production repos), a local checkout, or `sample`.
2. **Prove it runs** — install and run the target's own tests from the control room, and settle the CI check.

## Gate

- [ ] The target is on `dev-days-workshop/<participant>`, with a `dev-days-workshop/<participant>-start` tag.
- [ ] Its tests passed in this session, or you switched to `sample`.
- [ ] The CI check is clean, or its deploy lines are confirmed safe, or you switched to a mirror.

## Learning point

You can't measure anything in a repo you can't run. And you shouldn't experiment where a push could reach production.

## Wanted outcome

A runnable target on its `dev-days-workshop` branch, with a start tag, a settings backup and a CI check.

---

## 1.1 Choose a target

### [LLM]

> Narrate: "Quick preflight: Node, pnpm, git, and the coding tools you'll use today."

Run and report in one compact block:

```bash
node -v && pnpm -v && git --version
claude --version 2>/dev/null || echo "claude CLI: not installed"
agent --version 2>/dev/null || echo "cursor CLI: not installed"
glab --version 2>/dev/null | head -1 || gh --version 2>/dev/null | head -1 || echo "glab/gh: not installed"
```

- Node < 22.12 or missing pnpm → `corepack enable` (or install Node 22+) and stop until fixed. If `node_modules/` is missing at the root, run `pnpm install`.
- **Claude Code 2.1.283 or later** is needed for the agent-setup phases (`/doctor prompt-audit` arrived in 2.1.283). Older → `claude update`. Missing → install it (`curl -fsSL https://claude.ai/install.sh | bash`, then `claude` to log in), even if they mainly use Cursor: Phases 2–5 use Claude Code's own checks.
- Cursor CLI (`agent`) is optional. Smoke-test whatever is installed: `claude -p "Reply with: ok" --tools ""` or `agent -p "Reply with: ok"`. An auth error → they log in in their own terminal.
- `glab` / `gh` is needed from Phase 14 on (MRs/PRs). Mention it; don't block.
- Never ask them to paste a key or token into chat.

### [HUMAN]

Present the three options and ask which one:

1. **A GitLab or GitHub URL** — for a repo with code in production, use the workshop mirror your facilitators set up. Cloned fresh into `targets/`.
2. **A local checkout** — a path like `~/code/my-service`. Attached as a git worktree on a new branch, so their own checkout is untouched.
3. **`sample`** — the bundled `cost-coder` app (TypeScript, has an LLM feature and a deliberately imperfect agent setup). Always works.

Also ask for a short participant name for the branch (default: their git user name).

Good targets build in minutes, have tests, have agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`) and a history of merged changes that touched tests. If unsure: their mirror if they have one, otherwise `sample`.

## 1.2 Prove it runs

### [LLM]

> Narrate: "Everything you do today lives on a `dev-days-workshop` branch. Your default branch never changes."

```bash
pnpm workshop attach <url | path | sample> --participant <name>
```

This clones / worktrees / copies the target, creates `dev-days-workshop/<participant>`, tags the start point `dev-days-workshop/<participant>-start`, backs up `~/.claude/settings.json`, `~/.claude/CLAUDE.md` and `~/.cursor/hooks.json`, writes `.workshop/targets/<name>/profile.json`, and runs the CI check.

Summarise the profile in **at most 6 lines**: stack, host, default branch, install/build/test commands, agent instruction files found, CI check verdict.

The profiler guesses commands. Check the target's README, CI config and build files and correct any wrong command **in the profile JSON** (`commands.install`, `commands.build`, `commands.test`). Then run the install and test commands from `targets/<name>/`, streaming only the tail of the output.

### [HUMAN]

Two decisions are theirs:

- **Tests:** they watch the test run. If it fails and can't be fixed within about 15 minutes (missing SDK, private registry, a database the tests need), they decide whether to switch to `sample`.
- **CI check:** if the verdict is `REVIEW`, show the listed lines. Only they (or the repo owner) can confirm those jobs never run on `dev-days-workshop/*` branches or their MRs/PRs. If they can't confirm it, they switch to a mirror or `sample`. Nothing is pushed before Phase 14, but switching repo then would cost the day's work.

### [BRANCH]

- **Tests fail** → diagnose first: missing toolchain, registry auth, a service the tests need, env vars. Fix what you can; for what you can't, say exactly what to get from whom.
- **CI check says REVIEW and they can't confirm** → re-attach a mirror (`pnpm workshop attach <mirror-url> --participant <name>`) or `sample`.
- **Target is `sample`** → tests pass offline and the CI check reports no remote. Nothing to decide.

## 1.3 Gate check

The participant confirms, and you verify:

- [ ] The target is on `dev-days-workshop/<participant>`, with a `dev-days-workshop/<participant>-start` tag. — `git -C targets/<name> branch --show-current` and `git -C targets/<name> tag --list "dev-days-workshop/*"`
- [ ] Its tests passed in this session, or you switched to `sample`. — the test run you streamed in 1.2
- [ ] The CI check is clean, or its deploy lines are confirmed safe, or you switched to a mirror. — `ciCheck.verdict` in the profile, plus their confirmation if it says REVIEW

---

## Phase Complete

Mark Phase 1 complete. Preview: "Phase 2 — before measuring anything, find out what your coding agent is actually told about this repo."
