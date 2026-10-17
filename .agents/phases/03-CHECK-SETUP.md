# Phase 3 — Check the setup with Claude Code

## What you do

1. **Check the installation** — run `claude doctor` in a terminal. It checks the installation and settings and changes nothing.
2. **Run the setup checkup** — run `/doctor` in the target session. It reports unused extensions compared with how much context they use, slow hooks, and `CLAUDE.md` content the agent could work out from the code. Write down the findings, but don't apply any fixes yet.
3. **Audit the instructions** — run `/doctor prompt-audit`. It finds outdated, conflicting or broken instructions in `CLAUDE.md`, `AGENTS.md`, rules, skills and subagents.
4. **Rank the findings** — write the top 3 into `findings.md`, and choose the path for Phases 4–5: **fix** or **already good**.

## Gate

- [ ] `findings.md` holds the results of all three checks.
- [ ] It ranks a top 3 with a reason each, or says "no findings" with the reports as evidence.
- [ ] It names the path for Phases 4–5, and no user-level change was applied.

## Learning point

Claude Code can check its own setup for problems. If nobody has checked an instruction file, you don't know whether it works.

## Wanted outcome

A ranked list of findings in `.workshop/targets/<name>/findings.md` that decides how Phases 4 and 5 run.

---

## 3.1 Check the installation

### [LLM]

> Narrate: "We run three checks in this order: the installation, then the setup, then the instructions."

Explain: `claude doctor` runs in the terminal without starting a session, and it changes nothing. It finds problems that turn off parts of a setup without any warning. One example is a settings file with invalid syntax.

### [HUMAN]

They run it from the target directory in their second terminal and paste the result here:

```bash
cd targets/<name>
claude doctor
```

They note any problem in the **project** files (`.claude/settings.json`, hooks, MCP). For installation problems on their own machine, they write a one-line note. They fix those problems only if the fix takes little time.

## 3.2 Run the setup checkup

### [LLM]

`/doctor` suggests fixes and applies them after you confirm. So, before they run it, give them one rule:

> "Say no to every fix for now. Today we change only project files on the workshop branch. We never change `~/.claude/` or your default permission mode. We fix the project findings in Phases 4 and 5."

### [HUMAN]

In the target session they run `/doctor` and read the report. The report covers installation health, extensions, `CLAUDE.md` files and permissions. For extensions, it compares unused skills, MCP servers and plugins with how much context they use, and it lists slow hooks. For `CLAUDE.md` files, it finds duplicates, content Claude could work out from the code, and guidance that always loads but could move into skills or nested files. They say no to the fixes and paste the findings here.

## 3.3 Audit the instructions

### [LLM]

Explain what the audit looks for: instructions written for older models, references to files or commands that don't exist, and files that contradict each other. By default it checks `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md`. It also checks rules, skills, commands, subagents and output styles under `.claude/` **and** `~/.claude/`. It reports findings with suggested edits. It changes nothing until you ask it to. It needs Claude Code 2.1.283 or later, and it runs through the included `/claude-api` skill.

### [HUMAN]

In the target session:

```text
/doctor prompt-audit
```

They don't apply anything. They paste the findings here and mark the findings about **user-level** files (`~/.claude/…`). Those go in a separate "personal" list, not in the project findings.

### [BRANCH]

- **Older than 2.1.283** → run `claude update`, restart the session and run the audit again. If they can't update, they check `CLAUDE.md`, `AGENTS.md` and rules by hand against their inventory. They check every command, path and rule against the repo.
- **"Unavailable", or the `/claude-api` skill is turned off** → check `/skills`. If a managed setting turns it off, use the manual check described above and tell the facilitator.
- **The repo has many skills** → also run `/skill-doctor` (v2.1.252+) in the terminal session. It shows how much context each skill uses and how often it runs. Note the skills that use a lot of context but are never used.
- **Target is `sample`** → the audit should find four problems: the missing import, the `pnpm lint` command that doesn't exist, the conflict between 4-space and 2-space indentation, and `src/parse.ts`, which doesn't exist. If it misses one, ask them whether they found it in Phase 2.

## 3.4 Rank the findings

### [HUMAN]

They write `.workshop/targets/<name>/findings.md` themselves:

1. A short section for each check (`claude doctor`, `/doctor`, `/doctor prompt-audit`) with the project findings, in their own words.
2. **Top 3**: the findings most likely to make the agent do the wrong thing in this repo. Each one gets one line on why it has that rank. An instruction that doesn't load, or that contradicts another, usually ranks above a finding about context use.
3. **Path**: this decides how Phases 4–5 run. Write `fix` if any instruction finding is in the top 3. Otherwise, write `already good`. On the already good path, Phase 4 shortens the files instead of fixing them. Phase 5 tests the existing hooks instead of adding new ones.

Question the ranking once, then accept their decision.

## 3.5 Gate check

The participant confirms, and you verify:

- [ ] `findings.md` holds the results of all three checks. — read `.workshop/targets/<name>/findings.md` and find a section per check
- [ ] It ranks a top 3 with a reason each, or says "no findings" with the reports as evidence. — the Top 3 section in `findings.md`
- [ ] It names the path for Phases 4–5, and no user-level change was applied. — the Path line, plus `pnpm workshop cleanup <name>` (without `--yes`) lists no changed user settings

---

## Phase Complete

Mark Phase 3 complete. Preview: "Phase 4 — fix your top findings in the instruction files, then run the audit again to show the problems are gone."
