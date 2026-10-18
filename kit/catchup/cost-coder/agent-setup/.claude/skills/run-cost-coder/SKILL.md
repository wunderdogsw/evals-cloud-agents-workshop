---
name: run-cost-coder
description: Build, run and check cost-coder from a clean checkout. Use when asked to run, verify or demo the classifier.
---

# Run cost-coder

1. `pnpm install`
2. `pnpm typecheck && pnpm test`
3. Classify one line without a model: `COST_CODER_MOCK=1 pnpm classify "Sähköliittymä työmaalle, väliaikainen"`. Expect a JSON line with a cost code and a rationale.
