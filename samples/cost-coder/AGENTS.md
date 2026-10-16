# AGENTS.md — cost-coder

Instructions for coding agents working in this repository.

## Commands

- Install: `pnpm install`
- Test: `pnpm test` (vitest). Tests must pass offline — use `mockClassify` or `COST_CODER_MOCK=1`, never real API calls in unit tests.
- Typecheck: `pnpm typecheck`

## Conventions

- TypeScript, ESM, Node 22+. Import local files with the `.ts` extension.
- Keep `src/classify.ts` free of I/O except the Anthropic call.
- New modules get a matching `test/<module>.test.ts`.
- Amounts are EUR numbers; Finnish decimal commas are parsed at the edges, never inside core logic.
