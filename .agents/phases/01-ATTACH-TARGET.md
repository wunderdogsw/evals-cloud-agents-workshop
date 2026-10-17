# Phase 1 — Attach your target

## Overview

You'll pick the repo you want to work in, attach it under `targets/`, and let the guide profile it: stack, commands, CI, git host, any existing LLM calls. The phase ends when the target's own tests run green from here — you can't measure anything in a repo you can't run.

---

## 1.1 [LLM] Check the control room

> Narrate: "Quick preflight — Node, pnpm, git, and a model the evals can call."

Evals, judges and agents run on the participant's **own** Claude Code or Cursor login — whichever they have, no API key, no choice to make. Run and report in one compact block:

```bash
node -v && pnpm -v && git --version
claude --version 2>/dev/null || echo "claude CLI: not installed"
agent --version 2>/dev/null || echo "cursor CLI: not installed"
glab --version 2>/dev/null | head -1 || gh --version 2>/dev/null | head -1 || echo "glab/gh: not installed"
```

- Node < 22.12 or missing pnpm → tell them `corepack enable` (or install Node 22+) and stop until fixed.
- If `node_modules/` is missing at the root, run `pnpm install`.
- **At least one** of `claude` (Claude Code CLI) or `agent` (Cursor CLI) must be installed and logged in. Missing both → install the one matching the tool they already use: Claude Code `curl -fsSL https://claude.ai/install.sh | bash` then `claude` to log in; Cursor CLI `curl https://cursor.com/install -fsS | bash` then `agent login`. Having both is a bonus, not a requirement.
- Smoke-test the one they have: `claude -p "Reply with: ok" --tools ""` or `agent -p "Reply with: ok"`. An auth error → they log in in their own terminal and retry.
- `glab` / `gh` is only needed on Day 2 (reading issues, opening MRs/PRs) — mention it, don't block.
- Never ask them to paste a key or token into chat.

## 1.2 [HUMAN] Choose a target

Present the three options and ask which one:

1. **A GitLab or GitHub URL** — ideally the workshop mirror your facilitators set up (`…/workshop/<repo>`). Cloned fresh into `targets/`.
2. **A local checkout** — a path like `~/code/my-service`. Attached as a git worktree on a new branch, so your own checkout is untouched.
3. **`sample`** — the bundled `cost-coder` app (TypeScript, has an LLM feature, no remote). Always works.

Also ask for a short participant name for the branch (default: their git user name).

Good targets build in minutes, have tests, and have a history of merged changes that touched tests. If they're unsure, recommend their mirror if they have one, otherwise `sample`.

## 1.3 [LLM] Attach and profile

```bash
pnpm workshop attach <url | path | sample> --participant <name>
```

This clones/worktrees/copies the target, creates `dev-days-workshop/<participant>` and a `dev-days-workshop/<participant>-start` tag, writes `.workshop/targets/<name>/profile.json`, and sets `activeTarget` in `progress.json`.

Read the profile and summarise it in **at most 6 lines**: stack, host, default branch, install/build/test commands, CI present, LLM call sites found (count + top 2 files), agent instruction files present.

## 1.4 [LLM] Confirm commands

The profiler guesses. Look at the target's README, CI config and build files and correct any wrong command **in the profile JSON** (`commands.install`, `commands.build`, `commands.test`). If you can't tell, ask the participant one question listing the candidates.

If `notes` mentions pnpm `--ignore-workspace`, keep that flag for local runs inside the control room.

## 1.5 [LLM] Install and run the tests

From `targets/<name>/` run the install command, then the test command. Stream only the tail of the output.

- Pass → go to 1.6.
- Fail → diagnose before anything else. Typical: missing SDK/toolchain, private registry auth, a service the tests need (database), env vars. Fix what you can; for things you can't (VPN, private registry token), tell the participant exactly what to get from whom. If it can't be fixed within ~15 minutes, recommend switching to `sample` and continuing — they can come back to their repo in Phase 6.

## 1.6 [HUMAN] Decide what to evaluate

Show the LLM call sites from the profile (file:line). Ask:

> "Day 1's evals need an LLM-powered feature. Which of these is the one you'd most like to trust more — or is there none worth evaluating?"

## 1.7 [BRANCH] Record the eval subject

- **They picked a feature in the target** → set `evalSubject: "target-feature"` and `suite: "<short-feature-name>"` in the profile and in `progress.json` → `targets.<name>`. Write 2–3 lines on how an eval could call it (direct import for TS, CLI entry point, HTTP endpoint, or a small test harness you'd add). Don't build it yet.
- **No LLM feature / none worth it** → set `evalSubject: "sample-feature"` and `suite: "cost-coder"`. Explain: "Day 1 evaluates the bundled invoice classifier, vendored into your repo under `evals/subject/`. Phase 6 benchmarks coding agents on *your* code, so the repo still matters."
- **Target is `sample`** → already `target-feature` / `cost-coder`. Nothing to ask.

## Gate 1

The participant confirms, and you verify:

- [ ] `targets/<name>/` exists and is on branch `dev-days-workshop/<participant>`
- [ ] The target's test command passed in this session (or they consciously switched to `sample`, which passes)
- [ ] `evalSubject` and `suite` are set in the profile

---

## Phase Complete

Mark Phase 1 complete. Preview: "Phase 2 — you'll write the dataset that defines what *good* means for this feature. That's the hard, valuable part."
