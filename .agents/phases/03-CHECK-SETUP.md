# Phase 3 — Check the setup with Claude Code

## What you do

1. **Check the installation** — run `claude doctor` in a terminal: read-only installation and settings diagnostics.
2. **Run the setup checkup** — `/doctor` in the target session: unused extensions against their context cost, slow hooks, and `CLAUDE.md` content the agent could derive from the code. Record the findings; apply nothing yet.
3. **Audit the instructions** — `/doctor prompt-audit`: outdated, conflicting or broken instructions across `CLAUDE.md`, `AGENTS.md`, rules, skills and subagents.
4. **Rank the findings** — the top 3 go into `findings.md`, with a path for Phases 4–5: **fix** or **already good**.

## Gate

- [ ] `findings.md` holds the results of all three checks.
- [ ] It ranks a top 3 with a reason each, or says "no findings" with the reports as evidence.
- [ ] It names the path for Phases 4–5, and no user-level change was applied.

## Learning point

Claude Code can audit its own setup. An instruction file nobody has audited is an untested one.

## Wanted outcome

A ranked findings list in `.workshop/targets/<name>/findings.md` that decides how Phases 4 and 5 run.

---

## 3.1 Check the installation

### [LLM]

> Narrate: "Three checks, from the outside in: the installation, the setup, then the instructions themselves."

Explain: `claude doctor` runs in the terminal without starting a session and changes nothing. It catches problems that silently disable parts of a setup, such as a settings file that doesn't parse.

### [HUMAN]

They run it from the target directory in their second terminal and paste the result here:

```bash
cd targets/<name>
claude doctor
```

They note anything that points at the **project** (`.claude/settings.json`, hooks, MCP). Installation issues on their machine get a one-line note and a fix only if it's quick.

## 3.2 Run the setup checkup

### [LLM]

Before they run it, set one rule, because `/doctor` proposes fixes and applies them after you confirm:

> "Decline every fix for now. Today we only change project files on the workshop branch, never `~/.claude/` or your default permission mode. We'll fix the project findings in Phases 4 and 5."

### [HUMAN]

In the target session they run `/doctor` and read the report. The checkup covers installation health, extensions (unused skills, MCP servers and plugins compared with their context cost, slow hooks), `CLAUDE.md` files (duplicates, content Claude could derive from the codebase, always-loaded guidance it could move into skills or nested files) and permissions. They decline the fixes and paste the findings here.

## 3.3 Audit the instructions

### [LLM]

Explain what the audit looks for: instructions written for older models, references to files or commands that don't exist, and files that contradict each other. By default it covers `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md`, plus rules, skills, commands, subagents and output styles under `.claude/` **and** `~/.claude/`. It reports findings with proposed edits and changes nothing until asked. It needs Claude Code 2.1.283 or later, and it runs through the bundled `/claude-api` skill.

### [HUMAN]

In the target session:

```text
/doctor prompt-audit
```

They don't apply anything. They paste the findings here and mark which ones are about **user-level** files (`~/.claude/…`): those go in a separate "personal" list, not in the project findings.

### [BRANCH]

- **Older than 2.1.283** → `claude update`, restart the session, run it again. If the update isn't possible, they audit `CLAUDE.md`, `AGENTS.md` and rules by hand against their inventory: every command, path and rule checked against the repo.
- **"Unavailable" or the `/claude-api` skill is turned off** → check `/skills`; if a managed setting disables it, use the manual audit above and tell the facilitator.
- **The repo has many skills** → also run `/skill-doctor` (v2.1.252+) in the terminal session to see each skill's context cost and use. Note the costly, unused ones.
- **Target is `sample`** → the audit should flag the missing import, the `pnpm lint` command that doesn't exist, the 4-space vs 2-space conflict and `src/parse.ts`, which doesn't exist. If it misses one, ask them whether they spotted it in Phase 2.

## 3.4 Rank the findings

### [HUMAN]

They write `.workshop/targets/<name>/findings.md` themselves:

1. A short section per check (`claude doctor`, `/doctor`, `/doctor prompt-audit`) with the project findings, in their own words.
2. **Top 3**: the findings most likely to make the agent do the wrong thing in this repo, each with one line on why it ranks there. An instruction that doesn't load or contradicts another usually beats a context-cost finding.
3. **Path**: `fix` if any instruction finding is in the top 3, otherwise `already good`. Already good means Phase 4 trims instead of fixes and Phase 5 tests the existing hooks instead of adding new ones.

Challenge the ranking once, then accept their call.

## 3.5 Gate check

The participant confirms, and you verify:

- [ ] `findings.md` holds the results of all three checks. — read `.workshop/targets/<name>/findings.md` and find a section per check
- [ ] It ranks a top 3 with a reason each, or says "no findings" with the reports as evidence. — the Top 3 section in `findings.md`
- [ ] It names the path for Phases 4–5, and no user-level change was applied. — the Path line, plus `pnpm workshop cleanup <name>` (without `--yes`) lists no changed user settings

---

## Phase Complete

Mark Phase 3 complete. Preview: "Phase 4 — fix your top findings in the instruction files, then run the audit again to prove it."
