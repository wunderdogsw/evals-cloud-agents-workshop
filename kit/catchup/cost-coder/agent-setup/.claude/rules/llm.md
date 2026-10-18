---
paths:
  - "src/classify.ts"
  - "src/llm/**"
---

# Model calls

- Keep `src/classify.ts` free of I/O except the model call, which goes through `src/llm/`.
- Model IDs live in `src/llm/models.ts`; don't hard-code them elsewhere.
- Every change here needs a test that runs with `COST_CODER_MOCK=1`.
