# Phase 4 — Fix the instruction files

## What you do

1. **Fix how instructions load** — no instruction file: `/init`; an `AGENTS.md` next to a `CLAUDE.md`: import it with `@AGENTS.md`.
2. **Apply the audit's edits** — accept or reject each edit from `/doctor prompt-audit`, and move file-specific rules to `.claude/rules/` with `paths` frontmatter.
3. **Re-run the audit** — `/doctor prompt-audit` again, compared with Phase 3, then commit on the workshop branch.

## Gate

- [ ] Each top-3 finding is fixed or explained, or the trim is done on the "already good" path.
- [ ] The re-audit is recorded in `findings.md`, next to Phase 3's results.
- [ ] The changes are committed on `dev-days-workshop/<participant>`.

## Learning point

Instructions are context, not enforcement. Short, specific rules that load are followed more consistently than long ones that don't.

## Wanted outcome

Instruction files that load, agree with each other and are committed on the workshop branch.

---

## 4.1 Fix how instructions load

### [LLM]

> Narrate: "First make sure the agent gets the instructions at all. Then make them right."

Read `findings.md` and the inventory. Recap the path (`fix` or `already good`) and the top 3 in three lines. Remind them: all edits happen in `targets/<name>` on the workshop branch, and only project files change.

### [HUMAN]

In the target session, they fix loading first:

- **No `CLAUDE.md` and no `AGENTS.md`** → `/init`. For the guided flow that also walks through skills and hooks, start the session with `CLAUDE_CODE_NEW_INIT=1 claude`. Decline anything it proposes for personal (user-level) files.
- **`AGENTS.md` and `CLAUDE.md` both exist** → add `@AGENTS.md` as a line in `CLAUDE.md`, so both Claude Code and Cursor read the same rules. Move anything Claude-specific into `CLAUDE.md` and keep shared rules in `AGENTS.md`, without duplicates.
- **Only `AGENTS.md`** → it already loads (Claude Code 2.1.277+). Nothing to do unless they want a Claude-only file.

They restart the target session and confirm with `/memory` that the file now loads.

### [BRANCH]

- **Target is `sample`** → the fix is `@AGENTS.md` in `CLAUDE.md`, replacing "Read AGENTS.md before you start."
- **Repo has rules only in `.cursor/rules/*.mdc`** → move rules that apply everywhere into `AGENTS.md`; rules with `globs` become `.claude/rules/` files with the same `paths`. Keep the `.mdc` files if the team still uses Cursor.

## 4.2 Apply the audit's edits

### [LLM]

Show the path-scoped rule format from the Claude Code memory docs, once:

```markdown
---
paths:
  - "src/classify.ts"
  - "src/llm/**"
---

- No I/O in the classifier except the model call through `src/llm/`.
```

A rule file without `paths` loads in every session, like `CLAUDE.md`.

### [HUMAN]

In the target session they ask Claude to show the Phase 3 audit's proposed edits again (or re-run `/doctor prompt-audit`), then decide **each edit themselves**: accept, change or reject. They work down the top 3 first. A rule that only matters for some files moves to `.claude/rules/<topic>.md` with `paths`.

On the **already good** path, they trim instead: cut what `/doctor` said Claude can derive from the code, keep each `CLAUDE.md` under about 200 lines, and scope what's left into `.claude/rules/`.

Review their edits for one thing: every remaining instruction is specific enough to check ("New modules get a matching `test/<module>.test.ts`"), not a wish ("Write good tests").

### [BRANCH]

- **Target is `sample`** → expect: `pnpm lint` replaced by `pnpm typecheck` (there's no lint script), one indentation rule (2 spaces, as the code uses), `src/parse.ts` removed from the layout, the classifier rule moved to `.claude/rules/llm.md`. "Keep answers short" is a style preference; they decide whether it stays.
- **An edit needs a decision from the repo owner** (a rule nobody can confirm) → leave it, and write the open question in `findings.md`.

## 4.3 Re-run the audit

### [HUMAN]

In a **fresh** target session they run `/doctor prompt-audit` again and add a "Re-audit" section to `findings.md`: what's gone, what's left and why it stays. Then they commit in the target:

```bash
cd targets/<name>
git status
git add CLAUDE.md AGENTS.md .claude/rules
git commit -m "workshop: fix agent instructions"
```

They add only the agent files they changed. Don't push: nothing leaves this machine before Phase 14.

## 4.4 Gate check

The participant confirms, and you verify:

- [ ] Each top-3 finding is fixed or explained, or the trim is done on the "already good" path. — compare the Top 3 in `findings.md` with `git -C targets/<name> show --stat HEAD`
- [ ] The re-audit is recorded in `findings.md`, next to Phase 3's results. — the Re-audit section in `.workshop/targets/<name>/findings.md`
- [ ] The changes are committed on `dev-days-workshop/<participant>`. — `git -C targets/<name> branch --show-current` and `git -C targets/<name> status --short` shows no uncommitted agent files

---

## Phase Complete

Mark Phase 4 complete. Preview: "Phase 5 — add what instructions can't do on their own: a run skill, a hook that blocks, and permissions."
