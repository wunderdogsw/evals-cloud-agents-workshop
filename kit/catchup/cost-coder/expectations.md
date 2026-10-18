# Expectations — cost-coder (catch-up reference)

| # | Rule | Source | Check | How | Tasks | Picked |
|---|---|---|---|---|---|---|
| R1 | Tests pass offline; no real API calls in unit tests | AGENTS.md | code | hidden tests run with no network and `COST_CODER_MOCK=1` | all | yes: a test that calls the API breaks CI |
| R2 | Import local files with the `.ts` extension | AGENTS.md | code | grep the diff for local imports without `.ts` | all | no: typecheck already catches it |
| R3 | New modules get a matching `test/<module>.test.ts` | AGENTS.md | code | every new `src/x.ts` in the diff has `test/x.test.ts` | vat-split, credit-note, csv-import, code-lookup | yes: untested modules are where regressions hide |
| R4 | Never edit files under `data/` | AGENTS.md + hook | code | the diff touches nothing under `data/` | all (temp-power asks for a seed case) | yes: changing reference data hides real errors |
| R5 | Finnish decimal commas are parsed at the edges, never in core logic | AGENTS.md | judge | rubric: where does comma parsing happen? | csv-import, vat-split | yes: wrong place silently corrupts amounts |
| R6 | `src/classify.ts` has no I/O except the model call | .claude/rules/llm.md | judge | rubric: any new fs/network use in classify.ts? | temp-power | yes: I/O there makes classification untestable |
| R7 | Indent with 2 spaces | AGENTS.md | code | formatter check on changed files | all | no: cosmetic |
| R8 | Every change adds a line under `## Unreleased` in `CHANGELOG.md` | AGENTS.md | code | the diff adds a line to `CHANGELOG.md` | all | yes: release notes are written from it |
