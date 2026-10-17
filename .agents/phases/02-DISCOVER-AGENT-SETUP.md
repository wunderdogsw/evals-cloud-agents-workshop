# Phase 2 — Discover your agent setup

## What you do

1. **See what loads** — open Claude Code in the target and read `/context` and `/memory`: the instruction files, rules, skills, subagents and MCP tools the session actually got.
2. **Find what doesn't load** — compare with what's on disk (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.mcp.json`, `.cursor/`), and check `/hooks`, `/mcp` and `/permissions`.
3. **Mark each file's status** — loaded, not loaded, missing or out of date, one row each in `agent-inventory.md`.

## Gate

- [ ] `agent-inventory.md` has a row for every file type, each with a status.
- [ ] Every file on disk that doesn't load has a reason.

## Learning point

What's on disk is not what the agent gets. A repo with both `CLAUDE.md` and `AGENTS.md` loses `AGENTS.md` unless `CLAUDE.md` imports it.

## Wanted outcome

An inventory in `.workshop/targets/<name>/agent-inventory.md` of what the agent is actually told about this repo.

---

## 2.1 See what loads

### [LLM]

> Narrate: "Before we measure an agent against your rules, let's see which rules it actually receives."

Read the active target's profile. Tell the participant to open a **second terminal** and start a fresh Claude Code session in the target, so this control-room session doesn't mix in:

```bash
cd targets/<name>   # or the worktree path in the profile
claude
```

Explain the two commands they'll run there, in one line each:

- `/context` — the context window as a grid, with a breakdown per item: memory files, rules, skills, custom agents, MCP tools. `/context all` expands the breakdown.
- `/memory` — the `CLAUDE.md` files loaded in this session (and `AGENTS.md`, from v2.1.280), plus auto memory.

### [HUMAN]

In the target session they run `/context all` and `/memory`, then paste the memory-file, rules, skills and MCP part of the breakdown back here (or summarise it). Ask them to note anything that comes from **their own user level** (`~/.claude/CLAUDE.md`, `~/.claude/skills/`): that's their personal setup, not the repo's, and a teammate won't have it.

## 2.2 Find what doesn't load

### [LLM]

List what's on disk in the target, so they can compare:

```bash
cd targets/<name>
ls -la CLAUDE.md CLAUDE.local.md AGENTS.md .claude/CLAUDE.md .mcp.json 2>/dev/null
find . -name CLAUDE.md -o -name AGENTS.md | grep -v node_modules | grep -v '^./CLAUDE.md$' | grep -v '^./AGENTS.md$'
ls -R .claude/rules .claude/skills .claude/agents .claude/hooks 2>/dev/null
cat .claude/settings.json 2>/dev/null
ls .cursor/rules .cursor/hooks.json 2>/dev/null
grep -n '@' CLAUDE.md 2>/dev/null | head
```

Point out the loading rule from the Claude Code memory docs: with a `CLAUDE.md` (or `CLAUDE.local.md`) in the working directory or above, Claude reads `CLAUDE.md` only, and `AGENTS.md` loads only when `CLAUDE.md` imports it with `@AGENTS.md`. A sentence like "Read AGENTS.md" is not an import. Subdirectory `CLAUDE.md` files and path-scoped rules load on demand, so "not in `/context`" is expected for them.

### [HUMAN]

In the target session they run `/hooks`, `/mcp` and `/permissions` and say what's configured at **project** level. Then they compare the two lists and name each file that's on disk but missing from `/context` or `/memory`.

### [BRANCH]

- **Target is `sample`** → expect `AGENTS.md` on disk but not loaded (`CLAUDE.md` only says "Read AGENTS.md"), no rules, skills or hooks. Let them find it; confirm only after they name it.
- **Repo has `.cursor/rules/*.mdc`** → Claude Code doesn't read them. Note which rules exist only there; Phase 4 decides whether to share them through `AGENTS.md` or `.claude/rules/`.
- **They mainly use Cursor** → Cursor reads `AGENTS.md`, `.cursor/rules/` and `.claude/skills/`. Add a column for Cursor and fill it by reading the files; Claude Code's commands are still the quickest way to see one agent's real view.
- **No agent files at all** → that's a valid inventory: every row is "missing". Phase 4 creates them.

## 2.3 Mark each file's status

### [HUMAN]

They write `.workshop/targets/<name>/agent-inventory.md` themselves, one row per file type:

| File type | Path(s) | Status | Reason / note |
|---|---|---|---|

Rows: project `CLAUDE.md`, `AGENTS.md`, nested `CLAUDE.md`/`AGENTS.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, hooks, MCP (`.mcp.json`), permissions (`.claude/settings.json`), `.cursor/rules/`. Status is one of **loaded**, **not loaded**, **missing**, **out of date**.

"Out of date" needs evidence they've seen: a command that doesn't exist in `package.json`, a path that doesn't exist, a rule that contradicts another. Don't fill the table for them; review it after.

## 2.4 Gate check

The participant confirms, and you verify:

- [ ] `agent-inventory.md` has a row for every file type, each with a status. — read `.workshop/targets/<name>/agent-inventory.md` and check the ten rows from 2.3
- [ ] Every file on disk that doesn't load has a reason. — compare the "not loaded" rows with the disk listing from 2.2

---

## Phase Complete

Mark Phase 2 complete. Preview: "Phase 3 — let Claude Code audit the files you just listed, and rank what's wrong."
