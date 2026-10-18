# cost-coder (sample target)

Classifies construction purchase-invoice lines to cost codes with Claude.

```bash
pnpm install
pnpm classify "Telinevuokra 4 vk"          # uses your Claude Code login (or Cursor CLI / ANTHROPIC_API_KEY)
COST_CODER_MOCK=1 pnpm classify "Telinevuokra 4 vk"   # offline keyword fake
pnpm test
```

- `src/classify.ts` — the LLM feature (prompt, tool schema, parsing). Prompt v1 is plain on purpose.
- `src/codes.ts` — the cost-code catalogue (simplified, synthetic).
- `data/invoice-lines.jsonl` — unlabelled synthetic invoice lines to build eval cases from.
- `data/seed-cases.jsonl` — a few labelled examples showing the case format.
- `CHANGELOG.md` — one line per change, under `## Unreleased`.
- `BACKLOG.md` — issues for Day 2 cloud agents.
- `CLAUDE.md`, `AGENTS.md` — agent instructions with problems added on purpose, for the workshop's Phases 2–4 to find and fix.

All data is synthetic. Supplier names are used only as realistic-looking labels.
