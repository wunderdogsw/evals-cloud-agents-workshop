# Phase 14 — Record evals for CI

## What you do

1. **Choose thresholds** — a minimum per grader and the agent files the recording tracks, in `agent-suite.json`.
2. **Record the run** — a full agent run with `--record`, on your own Claude Code or Cursor login, committed as `last-run.json`.
3. **Install the CI job** — `pnpm workshop install <name> ci-agent-evals`, verify locally, then push the workshop branch.

## Gate

- [ ] `agent-suite.json` has a threshold per gated grader and tracks every agent file, committed.
- [ ] `last-run.json` is committed and `pnpm verify suites/agent` passes locally.
- [ ] The CI job runs on the pushed workshop branch and is green.

## Learning point

CI checks a fresh, fingerprinted recording, so no model or secret goes into CI. Change an agent file without recording again, and the gate knows.

## Wanted outcome

A recording and a CI job on the workshop branch that check the agent against your rules on every push and MR/PR.

---

## 14.1 Choose thresholds

### [LLM]

> Narrate: "Thresholds turn your scores into a yes or no. Pick numbers you can defend in a code review."

Show `targets/<name>/evals/suites/agent/agent-suite.json` and explain each field:

- `rules` and `judges` — the graders the recorded run uses, by file name in this folder.
- `threshold.graders` — the minimum mean score per grader, by name: `"rule:R4": 1`, `"judge:R5": 0.6`, `"hidden-tests": 0.6`.
- `tracks` — the agent files, relative to this folder (`../../../CLAUDE.md`, `../../../.claude`). The folder itself (config, rules, rubrics) is always tracked. Git-ignored files such as `.claude/settings.local.json` are left out, because CI never sees them.

### [HUMAN]

They fill the file themselves:

- Every judge in `judges`, and every picked rule in `threshold.graders`.
- Thresholds from their own Phase 12 numbers: a rule that must never break gets `1`; others sit just below what the kept setup scored. A judge that stayed under 80 % agreement in Phase 11 gets a low threshold or none.
- Every agent file that exists in the repo in `tracks`.

They commit it:

```bash
git -C targets/<name> add evals/suites/agent/agent-suite.json
git -C targets/<name> commit -m "workshop: agent eval thresholds"
```

## 14.2 Record the run

### [LLM]

The recorded run reads rules, judges and threshold from `agent-suite.json`, refuses to start while a tracked file has uncommitted changes, and refuses to record if anything tracked changes while it runs or a task errors. Hand them the command (10–30 minutes on their login):

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --label recorded --record targets/<name>/evals/suites/agent
```

### [HUMAN]

They run it, read the threshold line (`✅ Threshold met` or the failures), and commit the recording:

```bash
git -C targets/<name> add evals/suites/agent/last-run.json
git -C targets/<name> commit -m "workshop: agent eval recording"
```

If the threshold isn't met, they decide: a real regression to fix first, or a threshold they set above what the setup can do. Either way they record again; they never edit `last-run.json` by hand.

## 14.3 Install the CI job

### [LLM]

```bash
pnpm workshop install <name> ci-agent-evals
pnpm --dir targets/<name>/evals verify suites/agent
```

This vendors the eval runner into `targets/<name>/evals/` and adds the job (`.gitlab/ci/workshop-agent-evals.yml` with an include, or `.github/workflows/workshop-agent-evals.yml`). It runs on pushes to `dev-days-workshop/*` and on MRs/PRs, needs no model and no secret, and runs `pnpm verify suites/agent` exactly as the local command does.

Before pushing, confirm once with the participant: this is the first push of the workshop branch, and the CI check from Phase 1 is clean or confirmed.

### [HUMAN]

They commit the CI files and push the workshop branch, then watch the job in GitLab or GitHub:

```bash
for f in evals .gitlab .gitlab-ci.yml .github; do [ -e "targets/<name>/$f" ] && git -C targets/<name> add "$f"; done
git -C targets/<name> status --short
git -C targets/<name> commit -m "workshop: agent eval CI gate"
git -C targets/<name> push -u origin dev-days-workshop/<participant>
```

### [BRANCH]

- **No remote yet** (`host: none`, including `sample` and catch-up) → they create an empty project in their own GitLab namespace or GitHub account, add it with `git -C targets/<name> remote add origin <url>`, run `pnpm workshop profile <name>` so the profile records the remote and host, then `pnpm workshop install <name> ci-agent-evals --force` for the right host, and push.
- **Production repo** → the job is new and only runs on workshop branches and their MRs/PRs. If the Phase 1 CI check said REVIEW and nobody confirmed it, stop and switch to the mirror.
- **The job fails as stale in CI but passes locally** → a tracked file differs between their machine and the commit: usually an uncommitted or git-ignored file. `git status` in the target, then record again.

## 14.4 Gate check

The participant confirms, and you verify:

- [ ] `agent-suite.json` has a threshold per gated grader and tracks every agent file, committed. — read `targets/<name>/evals/suites/agent/agent-suite.json` against `expectations.md` and the Phase 2 inventory
- [ ] `last-run.json` is committed and `pnpm verify suites/agent` passes locally. — `pnpm --dir targets/<name>/evals verify suites/agent` and `git -C targets/<name> status --short`
- [ ] The CI job runs on the pushed workshop branch and is green. — the pipeline link they share, or `glab ci status` / `gh run list --branch dev-days-workshop/<participant>`

---

## Phase Complete

Mark Phase 14 complete. Preview: "Phase 15 — open MRs/PRs that pass and fail the gate, and merge only the green one into your workshop branch."
