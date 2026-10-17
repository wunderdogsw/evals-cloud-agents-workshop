<!-- workshop:agent-section — added in the Evals & Cloud Agents Workshop. Edit freely; it's yours now. -->
## Working in this repo as an autonomous agent

You are often running unattended (CI job, cloud agent). There is no one to ask.

### Commands
- Install: `__INSTALL__`
- Build: `__BUILD__`
- Test: `__TEST__`
- Evals: `cd evals && pnpm install && pnpm eval suites/__SUITE__/suite.ts`

### Definition of done
1. The change does what the issue asks — re-read the issue before finishing.
2. Tests pass. New behaviour has a test next to the code it covers.
3. If you touched the LLM feature (prompt, model, parsing): run the evals and paste the summary table into the MR/PR description. A regression on any case tagged `critical` blocks the change. If no model provider is available where you run (no Claude Code / Cursor login), say so in the description — the CI eval gate runs them on the MR/PR anyway.
4. The MR/PR description says what you changed, what you assumed, and what you did not do.

### Boundaries
- Do not change `evals/suites/*/cases.jsonl` or thresholds to make evals pass. Ever.
- Do not add dependencies without saying why in the MR/PR description.
- Keep changes scoped to the issue. Unrelated refactors go in a separate MR/PR.
- __PROJECT_SPECIFIC__
