---
name: build-phase
description: Build or rewrite one workshop phase document in .agents/phases/ in the required phase format. Only for authoring this workshop's phases — not for running the workshop, guiding an attendee, or working in targets/.
disable-model-invocation: true
argument-hint: "[phase number] [title or rough idea]"
---

# Build a workshop phase

**Scope: this skill only builds phase documents.** Use it to create or rewrite a phase doc in `.agents/phases/` and keep the phase map consistent with it. Do not use it to run or resume the workshop (that is `/workshop` and `AGENTS.md`), to guide an attendee, or to change anything under `targets/`. If the request is anything else, stop and say this skill does not cover it.

Request: $ARGUMENTS

## The phase format

Copy the structure of [template.md](template.md) exactly. `pnpm lint:phases` enforces it.

1. **What you do** — 2–4 numbered actions, each `N. **<Action>** — <one line>`. Only what the attendee does, named with the real files and commands.
2. **Gate** — 2–4 `- [ ]` checks. Each one is verifiable from a file, a run or an answer.
3. **Learning point** — 1–2 sentences. The one idea the attendee keeps. One of the Gate checks must prove it.
4. **Wanted outcome** — 1 sentence. The file, run or decision that exists when the phase is done.
5. **One sub-step per action**, same label, same order: action 1 is `## N.1 <Action 1>`, and so on. Inside each sub-step:
   - `### [LLM]` (optional, first): guide-only preparation for this action. There are no separate setup sub-steps; setup goes into the sub-step it serves.
   - `### [HUMAN]` (required): the attendee's task.
   - `### [BRANCH]` (optional): sub-paths by target profile (`host`, `languages`, sample or own repo).
6. **`## N.k Gate check`** is the last sub-step. It repeats every Gate check as `- [ ] <check> — <how the guide verifies it>`.
7. Optional `## Room Gate`, then `## Phase Complete` with `Mark Phase N complete. Preview: "…"`.

## Plain language

Readers include people who read English as a second language. Write so an 18-year-old who knows basic programming understands every sentence on first read:

- No metaphors, idioms, jokes or hype. Say the literal thing ("only reports numbers", not "is just a dashboard").
- Short sentences, one idea each. Active voice: "Run X." "They write Y."
- Explain a technical term the first time a doc uses it, in a few plain words (stale: a tracked file changed after the recording).
- Commands, paths and flags stay exact.

## Phases must chain

- Read the previous phase's Wanted outcome. This phase starts from it; don't redo or assume work that isn't there.
- The Wanted outcome must be used by a later phase. If no later phase uses it yet, say so in your report.
- The Preview line says what the next phase does with this phase's outcome.

## Claude Code and Cursor facts come from current docs

Every built-in command, setting, file location, flag or feature the phase mentions must be checked in this session against the current docs, never from memory:

- Claude Code commands: https://code.claude.com/docs/en/commands, plus the topic page (skills, hooks, memory, sub-agents, settings) for anything else.
- Cursor: https://cursor.com/docs.

Note a minimum version when the docs give one. If you can't reach the docs, stop and list which statements are unverified.

## Workshop rules to keep

These come from `AGENTS.md` → Invariants; read it for the full list.

- Attendees write eval cases, judge rubrics, calibration labels, CI thresholds and agent task prompts themselves. These are always `[HUMAN]`.
- Every step works with Claude Code or Cursor, or offers the equivalent fallback. Never ask the attendee to pick a tool.
- No model credential or API key goes into CI.
- Targets may be production repos. Work happens on `dev-days-workshop/<participant>` branches; a phase never pushes or merges to the default branch, never force-pushes, and every MR/PR it opens targets the workshop branch. User-level settings (`~/.claude`, `~/.cursor`) are never changed. See `AGENTS.md` → Control room and target.
- Prefer `pnpm --dir targets/<name>/…` and `git -C targets/<name> …` over `cd`.

## Procedure

1. Read `AGENTS.md` (Phase map, Phase working loop, Invariants), [template.md](template.md), and the phase docs just before and after this one.
2. Draft the four top sections (What you do, Gate, Learning point, Wanted outcome). Show them to the user and agree on them before writing any sub-steps.
3. Write the sub-steps, the Gate check and Phase Complete.
4. Update the phase map row in `AGENTS.md` (number, title, document path). The title must match the doc's `# Phase N — Title` exactly. If the number of phases changes or phases are renumbered, also update:
   - the initial `progress.json` in `AGENTS.md`
   - `.agents/assets/workshop.ts`: the phase loop in progress init, the `catchup` range, and the phase-specific reference work in `catchup`
   - `.agents/PLAN.md`
   - every "Phase N" mention in other phase docs (search for them)
5. Run `pnpm lint:phases .agents/phases/<file>.md` (without pnpm: `node .agents/assets/lint-phases.ts <file>`). Fix every error and re-run until it passes. Every phase doc uses the new format, so `pnpm lint:phases --strict` must pass too.
   For an evals phase (1–15), also run `pnpm docs:flow` so the interactive flow page in `docs/phase-flow/` shows the new text. If the phase gets a new path or a new branch note, update the chart and `BRANCHES` in `.agents/assets/build-phase-flow.ts`, then `pnpm docs:flow --images` for the README images (needs Playwright).
6. Report back: the four top sections, the slash commands the linter listed with the docs page that confirms each, and any open questions. Don't commit unless the user asks.
