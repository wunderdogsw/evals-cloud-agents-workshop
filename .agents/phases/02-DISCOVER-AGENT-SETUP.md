# Phase 2 — Discover your agent setup

## What you do

1. **See what loads** — open Claude Code in the target and read `/context` and `/memory`: these show the instruction files, rules, skills, subagents and MCP tools that the session loaded.
2. **Find what doesn't load** — compare that with the files on disk (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.mcp.json`, `.cursor/`), and check `/hooks`, `/mcp` and `/permissions`.
3. **Mark each file's status** — loaded, not loaded, missing or out of date, with one row for each file type in `agent-inventory.md`.

## Gate

- [ ] `agent-inventory.md` has a row for every file type, each with a status.
- [ ] Every file on disk that doesn't load has a reason.

## Learning point

The agent does not get every file that is on disk. If a repo has both `CLAUDE.md` and `AGENTS.md`, Claude Code ignores `AGENTS.md` unless `CLAUDE.md` imports it.

## Wanted outcome

A list in `.workshop/targets/<name>/agent-inventory.md` of the instructions the agent gets about this repo.

---

## 2.1 See what loads

### [LLM]

> Narrate: "Before we measure an agent against your rules, let's see which rules it gets."

Read the active target's profile. Tell the participant to open a **second terminal** and start a new Claude Code session in the target. This keeps the setup of this workshop-repo session out of what they see:

```bash
cd targets/<name>   # or the worktree path in the profile
claude
```

Explain the two commands they will run there, in one line each:

- `/context` — shows the context window as a grid, with a list of what uses it: memory files, rules, skills, custom agents and MCP tools. `/context all` shows the full list.
- `/memory` — shows the `CLAUDE.md` files loaded in this session (and `AGENTS.md`, from v2.1.280), plus auto memory.

### [HUMAN]

In the target session they run `/context all` and `/memory`. They copy the parts about memory files, rules, skills and MCP back here, or summarise them. Ask them to note anything that comes from **their own user level** (`~/.claude/CLAUDE.md`, `~/.claude/skills/`). That is their personal setup, not the repo's setup, and a teammate won't have it.

## 2.2 Find what doesn't load

### [LLM]

List the agent files on disk in the target, so they can compare:

```bash
cd targets/<name>
ls -la CLAUDE.md CLAUDE.local.md AGENTS.md .claude/CLAUDE.md .mcp.json 2>/dev/null
find . -name CLAUDE.md -o -name AGENTS.md | grep -v node_modules | grep -v '^./CLAUDE.md$' | grep -v '^./AGENTS.md$'
ls -R .claude/rules .claude/skills .claude/agents .claude/hooks 2>/dev/null
cat .claude/settings.json 2>/dev/null
ls .cursor/rules .cursor/hooks.json 2>/dev/null
grep -n '@' CLAUDE.md 2>/dev/null | head
```

Explain the loading rule from the Claude Code memory docs. If there is a `CLAUDE.md` (or `CLAUDE.local.md`) in the working directory or a parent directory, Claude reads only `CLAUDE.md`. `AGENTS.md` loads only when `CLAUDE.md` imports it with `@AGENTS.md`. A sentence like "Read AGENTS.md" is not an import. `CLAUDE.md` files in subdirectories and rules limited to certain paths load only when Claude works with matching files. So it is normal that they are not in `/context`.

### [HUMAN]

In the target session they run `/hooks`, `/mcp` and `/permissions`. They say what is set at **project** level. Then they compare the two lists and name each file that is on disk but not in `/context` or `/memory`.

### [BRANCH]

- **Target is `sample`** → expect `AGENTS.md` on disk but not loaded, because `CLAUDE.md` only says "Read AGENTS.md". Expect no rules, skills or hooks. Let them find this themselves. Confirm it only after they name it.
- **Repo has `.cursor/rules/*.mdc`** → Claude Code doesn't read these files. Note which rules exist only there. In Phase 4 they decide whether to share them through `AGENTS.md` or `.claude/rules/`.
- **They mainly use Cursor** → Cursor reads `AGENTS.md`, `.cursor/rules/` and `.claude/skills/`. Add a column for Cursor and fill it by reading the files. Claude Code's commands are still the fastest way to see what one agent loads.
- **No agent files at all** → that is a valid list: every row is "missing". Phase 4 creates the files.

## 2.3 Mark each file's status

### [HUMAN]

They write `.workshop/targets/<name>/agent-inventory.md` themselves, with one row for each file type:

| File type | Path(s) | Status | Reason / note |
|---|---|---|---|

Rows: project `CLAUDE.md`, `AGENTS.md`, nested `CLAUDE.md`/`AGENTS.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, hooks, MCP (`.mcp.json`), permissions (`.claude/settings.json`), `.cursor/rules/`. The status is one of **loaded**, **not loaded**, **missing**, **out of date**.

They can mark a file "out of date" only if they have seen evidence. Examples: a command that doesn't exist in `package.json`, a path that doesn't exist, or a rule that contradicts another rule. Don't fill in the table for them. Review it after they finish.

## 2.4 Gate check

The participant confirms, and you verify:

- [ ] `agent-inventory.md` has a row for every file type, each with a status. — read `.workshop/targets/<name>/agent-inventory.md` and check the ten rows from 2.3
- [ ] Every file on disk that doesn't load has a reason. — compare the "not loaded" rows with the disk listing from 2.2

---

## Phase Complete

Mark Phase 2 complete. Preview: "Phase 3 — let Claude Code check the files you listed, and rank the problems it finds."
