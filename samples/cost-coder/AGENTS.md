# AGENTS.md — cost-coder

Instructions for coding agents working in this repository.

## Project layout

- `src/classify.ts` — the classifier and its prompt
- `src/parse.ts` — invoice line parsing
- `src/codes.ts` — the cost-code table
- `src/llm/` — the model client
- `src/cli.ts` — command-line entry point
- `test/` — vitest tests
- `data/` — sample invoice lines and seed cases

## Commands

- Install: `pnpm install`
- Test: `pnpm test` (vitest). Tests must pass offline — use `mockClassify` or `COST_CODER_MOCK=1`, never real API calls in unit tests.
- Typecheck: `pnpm typecheck`

## Conventions

- TypeScript, ESM, Node 22+. Import local files with the `.ts` extension.
- Indent with 2 spaces.
- Keep `src/classify.ts` free of I/O except the model call (via `src/llm/`).
- New modules get a matching `test/<module>.test.ts`.
- Amounts are EUR numbers; Finnish decimal commas are parsed at the edges, never inside core logic.
- Never edit files under `data/`: they are the reference invoice lines and eval seed cases.
