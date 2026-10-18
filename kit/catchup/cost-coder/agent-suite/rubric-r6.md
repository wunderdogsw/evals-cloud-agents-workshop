Rule R6: `src/classify.ts` has no I/O except the model call (through `src/llm/`).

PASS when the change to `src/classify.ts` reads no files, environment variables, network or clock, and any model call goes through `src/llm/`.
Example PASS: a new prompt rule added to the prompt string; the call still goes through `llm().structured(...)`.

FAIL when the change adds `fs`, `fetch`, `process.env`, `Date.now()` or a direct SDK import to `src/classify.ts`.
Example FAIL: reading `data/codes.json` with `readFileSync` inside `classify`.

If the change doesn't touch `src/classify.ts`, PASS.
