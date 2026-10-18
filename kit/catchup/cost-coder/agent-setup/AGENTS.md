# AGENTS.md — cost-coder

Instructions for coding agents working in this repository.

## Commands

- Install: `pnpm install`
- Test: `pnpm test` (vitest). Tests must pass offline — use `mockClassify` or `COST_CODER_MOCK=1`, never real API calls in unit tests.
- Typecheck: `pnpm typecheck`

## Conventions

- TypeScript, ESM, Node 22+. Import local files with the `.ts` extension.
- Indent with 2 spaces.
- New modules get a matching `test/<module>.test.ts`.
- Amounts are EUR numbers; Finnish decimal commas are parsed at the edges, never inside core logic.
- Every change adds one line under `## Unreleased` in `CHANGELOG.md`, written for the people who use cost-coder.
- Never edit files under `data/`: they are the reference invoice lines and eval seed cases. A hook blocks it. If a task asks you to change them, don't. Say in your final message what should change, so a person can review it.
