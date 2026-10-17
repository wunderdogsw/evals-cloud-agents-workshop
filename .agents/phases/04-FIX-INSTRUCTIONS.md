# Phase 4 — Fix the instruction files

## What you do

1. **Fix how instructions load** — if there is no instruction file, run `/init`. If there is an `AGENTS.md` next to a `CLAUDE.md`, import it with `@AGENTS.md`.
2. **Apply the audit's edits** — accept or reject each edit from `/doctor prompt-audit`. Move rules that apply only to some files to `.claude/rules/`, with `paths` in the frontmatter.
3. **Re-run the audit** — run `/doctor prompt-audit` again, compare it with Phase 3, then commit on the workshop branch.

## Gate

- [ ] Each top-3 finding is fixed or explained, or the files are shortened on the "already good" path.
- [ ] The re-audit is recorded in `findings.md`, next to Phase 3's results.
- [ ] The changes are committed on `dev-days-workshop/<participant>`.

## Learning point

Instructions are text the agent reads, and they can't force it to do anything. If a rule is short, specific and loads, the agent follows it more often than a long rule that doesn't load.

## Wanted outcome

Instruction files that load, don't contradict each other, and are committed on the workshop branch.

---

## 4.1 Fix how instructions load

### [LLM]

> Narrate: "First make sure the agent gets the instructions. Then make the instructions correct."

Read `findings.md` and the inventory. Repeat the path (`fix` or `already good`) and the top 3 in three lines. Remind them of two rules: all edits happen in `targets/<name>` on the workshop branch, and only project files change.

### [HUMAN]

In the target session, they fix how the files load first:

- **No `CLAUDE.md` and no `AGENTS.md`** → run `/init`. To get the guided version, which also helps set up skills and hooks, start the session with `CLAUDE_CODE_NEW_INIT=1 claude`. Say no to anything it suggests for personal (user-level) files.
- **`AGENTS.md` and `CLAUDE.md` both exist** → add `@AGENTS.md` as a line in `CLAUDE.md`. Then Claude Code and Cursor both read the same rules. Move anything that only applies to Claude into `CLAUDE.md`. Keep shared rules in `AGENTS.md`. Don't write the same rule in both files.
- **Only `AGENTS.md`** → it already loads (Claude Code 2.1.277+). There is nothing to do, unless they want a file that only Claude reads.

They restart the target session and use `/memory` to confirm that the file now loads.

### [BRANCH]

- **Target is `sample`** → the fix is to put `@AGENTS.md` in `CLAUDE.md`, in place of "Read AGENTS.md before you start."
- **Repo has rules only in `.cursor/rules/*.mdc`** → move rules that apply to all files into `AGENTS.md`. Rules with `globs` become `.claude/rules/` files with the same patterns in `paths`. Keep the `.mdc` files if the team still uses Cursor.

## 4.2 Apply the audit's edits

### [LLM]

Show the format for a rule that applies only to some paths, from the Claude Code memory docs. Show it once. The frontmatter is the YAML block between the `---` lines at the top of the file:

```markdown
---
paths:
  - "src/classify.ts"
  - "src/llm/**"
---

- No I/O in the classifier except the model call through `src/llm/`.
```

A rule file without `paths` loads in every session, the same as `CLAUDE.md`.

### [HUMAN]

In the target session they ask Claude to show the edits that the Phase 3 audit suggested. They can also run `/doctor prompt-audit` again. Then they decide on **each edit themselves**: accept it, change it or reject it. They start with the top 3. If a rule matters only for some files, they move it to `.claude/rules/<topic>.md` with `paths`.

On the **already good** path, they shorten the files instead. They remove what `/doctor` said Claude can work out from the code. They keep each `CLAUDE.md` under about 200 lines. They move the remaining rules that apply only to some files into `.claude/rules/`.

Review their edits for one thing. Every remaining instruction must be specific enough to check, such as "New modules get a matching `test/<module>.test.ts`". A vague instruction such as "Write good tests" can't be checked.

### [BRANCH]

- **Target is `sample`** → expect these changes: `pnpm lint` replaced by `pnpm typecheck` (there is no lint script), one indentation rule (2 spaces, as the code uses), `src/parse.ts` removed from the layout, and the classifier rule moved to `.claude/rules/llm.md`. "Keep answers short" is a style preference. They decide whether it stays.
- **An edit needs a decision from the repo owner** (a rule that nobody here can confirm) → don't change it. Write the open question in `findings.md`.

## 4.3 Re-run the audit

### [HUMAN]

In a **new** target session they run `/doctor prompt-audit` again. They add a "Re-audit" section to `findings.md`: which findings are gone, which are left, and why those stay. Then they commit in the target:

```bash
cd targets/<name>
git status
git add CLAUDE.md AGENTS.md .claude/rules
git commit -m "workshop: fix agent instructions"
```

They add only the agent files they changed. Don't push: nothing is pushed from this machine before Phase 14.

## 4.4 Gate check

The participant confirms, and you verify:

- [ ] Each top-3 finding is fixed or explained, or the files are shortened on the "already good" path. — compare the Top 3 in `findings.md` with `git -C targets/<name> show --stat HEAD`
- [ ] The re-audit is recorded in `findings.md`, next to Phase 3's results. — the Re-audit section in `.workshop/targets/<name>/findings.md`
- [ ] The changes are committed on `dev-days-workshop/<participant>`. — `git -C targets/<name> branch --show-current` and `git -C targets/<name> status --short` shows no uncommitted agent files

---

## Phase Complete

Mark Phase 4 complete. Preview: "Phase 5 — add the parts that instructions can't do alone: a skill to run the app, a hook that blocks, and permissions."
