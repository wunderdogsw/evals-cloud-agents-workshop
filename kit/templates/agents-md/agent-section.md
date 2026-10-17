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
3. Run the eval gate exactly as CI will: `cd evals && pnpm verify suites/__SUITE__/suite.ts`. If it reports **stale** (you changed the LLM feature, its prompt, or anything in the suite), re-run `pnpm eval suites/__SUITE__/suite.ts --record` and commit `last-run.json`. Your Claude Code or Cursor login is all it needs. If no model is available where you run, say so in the MR/PR — the gate will stay red until someone records.
4. The MR/PR description says what you changed, what you assumed, and what you did not do.

### Boundaries
- Do not change `evals/suites/*/cases.jsonl`, thresholds, or `last-run.json` by hand to make the gate pass. Ever.
- Do not add dependencies without saying why in the MR/PR description.
- Keep changes scoped to the issue. Unrelated refactors go in a separate MR/PR.
- __PROJECT_SPECIFIC__
