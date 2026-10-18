<!-- workshop:agent-section — added in the Evals & Cloud Agents Workshop. You can edit it as you like. -->
## Working in this repo as an autonomous agent

You often run without a person watching (in a CI job or as a cloud agent). There is no one to ask.

### Commands
- Install: `__INSTALL__`
- Build: `__BUILD__`
- Test: `__TEST__`
- Agent eval gate: `cd evals && pnpm install && pnpm verify suites/agent`

### Definition of done
1. The change does what the issue asks — re-read the issue before finishing.
2. Tests pass. New behaviour has a test next to the code it covers.
3. Run the agent eval gate the same way CI runs it: `cd evals && pnpm verify suites/agent`. It reports **stale** when an agent file (CLAUDE.md, AGENTS.md, .claude/, .cursor/) changed after the last recording. If your change caused that, say so in the MR/PR: a person must record the agent evals again.
4. The MR/PR description says what you changed, what you assumed, and what you did not do.

### Boundaries
- Do not change anything in `evals/suites/agent/` (rule graders, rubrics, thresholds, `last-run.json`) to make the gate pass.
- Do not add dependencies without saying why in the MR/PR description.
- Keep changes scoped to the issue. Unrelated refactors go in a separate MR/PR.
- __PROJECT_SPECIFIC__
