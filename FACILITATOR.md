# Facilitator Guide

## Two weeks before

- [ ] **Data approval.** Participants' code will be sent to Anthropic (Claude) and Cursor. Get written OK from the customer for the repos in scope, or plan for the sample target.
- [ ] **Pick target repos** with the customer. Good targets: builds in < 5 min, has a test suite, has ≥ 20 merged MRs/PRs that touched tests, ideally already calls an LLM somewhere.
- [ ] **Mirror targets** into a workshop group/org (`<group>/workshop-<repo>`). Agents, CI minutes and messy MRs never touch production projects.
- [ ] **GitLab tier.** Cursor cloud agents on GitLab need Premium/Ultimate (project access tokens). Without them, Phase 8 falls back to parallel `delegate` runs — still fine.
- [ ] **Cursor**: connect the GitLab/GitHub integration in the Cursor dashboard (needs Cursor admin + GitLab maintainer), sync repos, set a spend limit, add secrets the target needs at test time.
- [ ] **Models — no API keys, nothing in CI.** Participants use Claude Code and/or Cursor with their own logins, and may switch tools at any time. Helpers auto-detect `claude` then Cursor's `agent`. CI only verifies committed eval recordings. Expect subscription rate limits with a room running 40-case suites — keep `--concurrency` at 2–4.
- [ ] **CLIs on laptops:** `claude` (Claude Code) and/or `agent` (Cursor CLI), plus `glab` (GitLab) or `gh` (GitHub) logged in — `delegate` uses them to read issues and open MRs/PRs.
- [ ] **CI runners** that can build each target and reach `api.anthropic.com`.

## One week before — dry run (mandatory)

Run the whole workshop yourself on every target:

1. Phase 1 → commit the resulting profile as `kit/profiles/<target>.json` so participants start pre-profiled.
2. Phase 5 → record the suite and confirm the verify job runs on the target's runners. Commit a known-good `last-run.json` to the mirror's default branch.
3. Phase 6 → `pnpm agent-evals mine` and hand-pick 8–10 good replay tasks per target; commit them as `kit/profiles/<target>.tasks.jsonl`.
4. Phase 7 → `pnpm workshop delegate <target> --issue <n>` opens an MR/PR, and its eval gate is green.
5. Phase 8 → a Cursor cloud agent clones, builds and pushes (and/or a Claude Code cloud session, for GitHub targets). **Build environments are where most prep time goes** — commit a working `.cursor/environment.json` to the mirror.

## `.workshop/facilitator.json` (optional, per machine)

```json
{
  "models": { "task": "claude-haiku-5-5", "judge": "claude-haiku-5-5", "agent": "claude-sonnet-5-5" },
  "releasedRoomGates": ["5"],
  "skipPhases": [],
  "notes": "Room uses mirrors under gitlab.example.com/workshop/"
}
```

The guide reads this at start-up and passes `models` on as `EVAL_TASK_MODEL` / `EVAL_JUDGE_MODEL` / `EVAL_AGENT_MODEL`. CI templates pin their own model in the job variables (`CLAUDE_MODEL`, `REVIEW_MODEL`).

## Room gates

| After phase | Why we sync |
|---|---|
| 3 | Short debrief: show 2–3 judge/human disagreements on the screen. Best discussion of the day. |
| 5 | Everyone needs a working remote + CI before Phase 6/Day 2. Fix `host: none` here. |
| 6 | End of Day 1 retro: pass rates on screen per target. |
| 9 | Before the capstone: agree on budget per participant. |

## Catch-up

`pnpm workshop catchup <phase>` attaches a fresh copy of the sample target with all work up to `<phase>` pre-applied (dataset, rubric, CI files). Use it liberally — Day 2 needs everyone with a working eval gate.

## Costs (rough)

- Everything draws on participants' Claude (and Cursor) subscriptions — no separate API bill. The "cost" figures the tools print are Claude Code's API-equivalent estimates: useful for comparing runs, not an invoice.
- Phase 6 agent runs are the heaviest usage; keep `--concurrency 2` and 5–10 tasks.
- Day 2: set Cursor spend limits and Claude key limits up front.
