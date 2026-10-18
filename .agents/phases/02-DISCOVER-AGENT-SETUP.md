# Phase 2 — Discover your agent setup

## What you do

1. **Predict what loads** — the guide lists the agent files in the target as lettered options. You reply with the letters you think Claude Code loads at start.
2. **Check your prediction** — in a second terminal, run `/memory`, `/context all` and `/mcp` in the target. Reply with the letters you got wrong and why, and with the MCP servers a teammate would also get.
3. **Decide on each gap** — for each file that doesn't load, reply **fix** or **leave**, with one reason.

## Gate

- [ ] Every wrong prediction has a one-line explanation.
- [ ] Every MCP server, skill and agent they saw is named as project or personal.
- [ ] Every agent file that doesn't load has a fix-or-leave decision in `findings.md`.

## Learning point

The agent does not get every file on disk, and part of what it gets is your personal setup, which a teammate doesn't have.

## Wanted outcome

`.workshop/targets/<name>/findings.md` with an "Agent files" list and a "Loading gaps" section, which Phase 3 adds to and Phase 4 fixes.

---

## 2.1 Predict what loads

### [LLM]

> Narrate: "Before we measure an agent against your rules, let's see which rules it gets."

Scan the target. Don't show the raw output.

```bash
cd targets/<name>   # or the worktree path in the profile
ls -la CLAUDE.md CLAUDE.local.md .claude/CLAUDE.md AGENTS.md .mcp.json 2>/dev/null
find . \( -name CLAUDE.md -o -name AGENTS.md \) -not -path '*/node_modules/*' -mindepth 2
ls .claude/rules .claude/skills .claude/agents .claude/commands 2>/dev/null
grep -n '^@' CLAUDE.md .claude/CLAUDE.md 2>/dev/null
cat .claude/settings.json 2>/dev/null
ls .cursor/rules 2>/dev/null
```

Write the result to `.workshop/targets/<name>/findings.md` under `## Agent files`: one line per group, with paths and counts.

Work out the right answers yourself from the current loading rule (Claude Code memory docs, Claude Code 2.1.277+):

- With no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` in the folder or a parent, Claude reads `AGENTS.md`.
- If one of those exists, Claude reads only the `CLAUDE.md` files. `AGENTS.md` loads only through an `@AGENTS.md` import. A sentence such as "Read AGENTS.md" is not an import.
- A subfolder's `CLAUDE.md`, and rules with `paths:`, load later, when Claude works with files there.
- Skills and agents load at start as a name and description. The full skill loads only when it is used.
- `.cursor/rules/` never loads in Claude Code.

Then show the participant one numbered question. Build the options from the scan; leave out groups that don't exist. Don't give the rule yet. Example for a repo with both root files:

> Which of these does Claude Code load when you start it in this repo? Reply with the letters.
>
> a) root `CLAUDE.md`  b) root `AGENTS.md`  c) 13 nested `AGENTS.md`  d) `apps/web/CLAUDE.md`  e) 12 skills  f) 6 agents

### [HUMAN]

They reply with letters, for example `a b e f`. A guess is fine. Don't correct it yet.

## 2.2 Check your prediction

### [LLM]

Tell them to open a **second terminal** and start a new Claude Code session in the target. This keeps the setup of this workshop session out of what they see:

```bash
cd targets/<name>
claude
```

Name the three commands, in one line each:

- `/memory` — the instruction files that loaded.
- `/context all` — what fills the context window, including skills and agents.
- `/mcp` — every MCP server this session has. That includes their own user-level servers and claude.ai connectors, not only the repo's `.mcp.json`.

### [HUMAN]

They run the three commands and reply with two things:

1. The letters they got wrong, with one line each on why.
2. The MCP servers, skills and agents a teammate would also get, and which ones are only theirs.

If they are stuck on a wrong letter, give the loading rule from 2.1, one bullet at a time.

### [BRANCH]

- **Target is `sample` (default `--setup broken`)** → `CLAUDE.md` only says "Read AGENTS.md", so `AGENTS.md` doesn't load. Let them find it.
- **Repo has no `.mcp.json`** → every server in `/mcp` is personal. Say so only after they answer.
- **They mainly use Cursor** → Cursor reads `AGENTS.md`, `.cursor/rules/` and `.claude/skills/`. Ask the same question for Cursor and answer it by reading the files. Claude Code's commands are still the fastest way to see what one agent loads.
- **No agent files at all** → skip the question. The only gap is "no instructions", and 2.3 has one row.

## 2.3 Decide on each gap

### [LLM]

List the agent files that don't load, one per line, from your answers in 2.1. Leave out files that load later by design (subfolder `CLAUDE.md`, rules with `paths:`), unless the participant expected them at start.

### [HUMAN]

For each file, they reply **fix** or **leave**, with one reason. Example: "Root `AGENTS.md`: fix — it has the test commands." Only they know which rules the team means the agent to follow.

Write their answers to `findings.md` under `## Loading gaps`, in their words. Phase 4.1 fixes the rows marked **fix**.

## 2.4 Gate check

The participant confirms, and you verify:

- [ ] Every wrong prediction has a one-line explanation. — compare their letters from 2.1 with your answers and their reply in 2.2
- [ ] Every MCP server, skill and agent they saw is named as project or personal. — compare their reply with `.mcp.json`, `.claude/skills/` and `.claude/agents/` in the target
- [ ] Every agent file that doesn't load has a fix-or-leave decision in `findings.md`. — read `## Loading gaps` in `.workshop/targets/<name>/findings.md`

---

## Phase Complete

Mark Phase 2 complete. Preview: "Phase 3 — let Claude Code check the files that load, and add its findings next to your loading gaps."
