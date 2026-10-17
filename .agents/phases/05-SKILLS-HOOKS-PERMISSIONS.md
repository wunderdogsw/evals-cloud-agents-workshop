# Phase 5 — Add skills, hooks and permissions

## What you do

1. **Add a run-and-verify skill** — `/run-skill-generator` records how to build and run the target as `.claude/skills/run-<name>/`.
2. **Enforce one rule with a hook** — add a `PreToolUse` hook with `/update-config`, confirm it in `/hooks`, then break the rule on purpose.
3. **Set permissions** — `/fewer-permission-prompts`, then review the allow list in `/permissions` and commit everything.

## Gate

- [ ] The skill, the hook and the permissions are committed on the workshop branch.
- [ ] A hook (new or existing) blocked a deliberate violation in this session.

## Learning point

A rule that must never break belongs in a hook, not in `CLAUDE.md`. Instructions ask the agent; a hook decides for it.

## Wanted outcome

A complete agent setup committed on the workshop branch, which is the spec that Phases 6–15 measure the agent against.

---

## 5.1 Add a run-and-verify skill

### [LLM]

> Narrate: "Instructions tell the agent what you want. Skills give it a procedure, hooks enforce a rule, and permissions decide what it may do without asking."

Explain: `/run-skill-generator` gets the app running from a clean environment and records what worked (install commands, env vars, launch script) as a project skill. `/run`, `/verify` and other agents in the repo then follow it instead of rediscovering it. Cursor reads `.claude/skills/` too.

### [HUMAN]

In the target session they run `/run-skill-generator` and follow it. Afterwards they read the generated `SKILL.md` and check one thing: do the commands match the ones that worked in Phase 1? They fix any that don't.

### [BRANCH]

- **Already good** (a working run or build skill exists) → don't add one. Run `/skill-doctor` in the terminal session (v2.1.252+) and turn off skills that cost context but have never run, at project level only.
- **The app can't start locally** (needs a cloud service) → let the skill record build and tests only, and note what's missing in the skill.

## 5.2 Enforce one rule with a hook

### [LLM]

Help them choose **one** rule from their instruction files that must never break and that a script can check from the tool call alone: a protected directory, a file type nobody hand-edits, a command that must never run. Good candidates block a write or a command; "write good tests" can't be a hook.

Explain the contract, from the Claude Code hooks docs: a `PreToolUse` hook gets the tool call as JSON on stdin (`tool_name`, `tool_input`); exit code 2 blocks the call and sends stderr to Claude as the reason. The config goes in the **project** `.claude/settings.json` so it's committed, with the script in `.claude/hooks/`, referenced through `${CLAUDE_PROJECT_DIR}`.

### [HUMAN]

They write the request themselves, for example:

```text
/update-config Add a PreToolUse hook in the project .claude/settings.json for Edit|Write that runs .claude/hooks/protect-data.mjs, and write that script: block any file_path under data/ with exit code 2 and a reason on stderr.
```

They read the script before accepting it. Then they restart the target session, check `/hooks` lists it, and **break the rule on purpose**: ask Claude to change a protected file. The hook must block it, and Claude must report the reason.

### [BRANCH]

- **Target is `sample`** → the rule is "Never edit files under `data/`" from `AGENTS.md`.
- **Already good** (a blocking hook exists) → don't add one. Trigger the existing hook on purpose and confirm in `/hooks` that it's the project's hook.
- **They mainly use Cursor** → Cursor's project hooks live in `.cursor/hooks.json` (`"version": 1`), and `preToolUse` can block with exit code 2. Commands run from the project root, so use paths like `.cursor/hooks/protect-data.mjs`. Add it next to the Claude Code hook; one script can serve both if it reads either input.
- **The hook doesn't fire** → check `claude doctor` for a settings error, the matcher (`Edit|Write`), and that the script is executable or started with `node`.

## 5.3 Set permissions

### [LLM]

Explain: `/fewer-permission-prompts` scans past transcripts for common read-only Bash and MCP calls and adds a prioritised allow list to the **project** `.claude/settings.json`. In a repo they've barely used it may find little, and that's fine.

### [HUMAN]

In the target session they run `/fewer-permission-prompts`, then `/permissions`, and review every project rule: read-only commands and the test command are fine. Anything that can write outside the repo, push, or run arbitrary code (`Bash(*)`, `Bash(git push:*)`) comes out. If it found nothing, they add the test and typecheck commands themselves.

Then they commit the setup in the target:

```bash
cd targets/<name>
for f in .claude/skills .claude/hooks .claude/settings.json .cursor/hooks.json .cursor/hooks; do [ -e "$f" ] && git add "$f"; done
git status --short
git commit -m "workshop: agent skill, hook and permissions"
```

`.claude/settings.local.json` stays uncommitted; it's personal.

## 5.4 Gate check

The participant confirms, and you verify:

- [ ] The skill, the hook and the permissions are committed on the workshop branch. — `git -C targets/<name> log --stat -1` and `cat targets/<name>/.claude/settings.json`
- [ ] A hook (new or existing) blocked a deliberate violation in this session. — they paste the blocked tool call and its reason from the target session

---

## Phase Complete

Mark Phase 5 complete. Preview: "Phase 6 — turn the rules in your new setup into expectations you can check, by code or by a judge."
