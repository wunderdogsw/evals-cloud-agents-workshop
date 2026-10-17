# Phase 14 — Record evals for CI

## What you do

1. **Choose thresholds** — set a minimum score for each grader and list the agent files the recording tracks, in `agent-suite.json`.
2. **Record the run** — do a full agent run with `--record` on your own Claude Code or Cursor login, and commit it as `last-run.json`.
3. **Install the CI job** — run `pnpm workshop install <name> ci-agent-evals`, verify locally, then push the workshop branch.

## Gate

- [ ] `agent-suite.json` is committed, has a threshold for each grader in the gate, and tracks every agent file.
- [ ] `last-run.json` is committed and `pnpm verify suites/agent` passes locally.
- [ ] The CI job runs on the pushed workshop branch and passes.

## Learning point

CI checks a recording that stores a SHA-256 hash of each tracked file, so CI needs no model and no secret. If you change an agent file and don't record again, the gate sees that the recording is stale and fails.

## Wanted outcome

A recording and a CI job on the workshop branch that check the agent against your rules on every push and every MR/PR.

---

## 14.1 Choose thresholds

### [LLM]

> Narrate: "Thresholds turn your scores into pass or fail. Pick numbers you can explain in a code review."

Show `targets/<name>/evals/suites/agent/agent-suite.json` and explain each field:

- `rules` and `judges` — the graders that the recorded run uses, listed by file name in this folder.
- `threshold.graders` — the minimum mean score for each grader, listed by name: `"rule:R4": 1`, `"judge:R5": 0.6`, `"hidden-tests": 0.6`.
- `tracks` — the agent files, as paths relative to this folder (`../../../CLAUDE.md`, `../../../.claude`). The folder itself (config, rules, rubrics) is always tracked. Files that git ignores, such as `.claude/settings.local.json`, are left out, because CI never sees them.

### [HUMAN]

They fill in the file themselves:

- Every judge goes in `judges`, and every chosen rule goes in `threshold.graders`.
- They base the thresholds on their own Phase 12 numbers. A rule that must never break gets `1`. Other rules get a value slightly below what the kept setup scored. A judge that stayed under 80 % agreement in Phase 11 gets a low threshold or no threshold.
- Every agent file that exists in the repo goes in `tracks`.

They commit it:

```bash
git -C targets/<name> add evals/suites/agent/agent-suite.json
git -C targets/<name> commit -m "workshop: agent eval thresholds"
```

## 14.2 Record the run

### [LLM]

The recorded run reads the rules, judges and threshold from `agent-suite.json`. It does not start while a tracked file has uncommitted changes. It does not save a recording if a tracked file changes during the run, or if a task fails with an error. The recording stores a SHA-256 hash of each tracked file. Give the participant the command. It takes 10–30 minutes on their login:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --label recorded --record targets/<name>/evals/suites/agent
```

### [HUMAN]

They run it. They read the threshold line, which shows `✅ Threshold met` or the failures. Then they commit the recording:

```bash
git -C targets/<name> add evals/suites/agent/last-run.json
git -C targets/<name> commit -m "workshop: agent eval recording"
```

If the threshold isn't met, they decide on the cause. Either it is a real regression that they fix first, or they set a threshold higher than the setup can reach. In both cases they record again. They never edit `last-run.json` by hand.

## 14.3 Install the CI job

### [LLM]

```bash
pnpm workshop install <name> ci-agent-evals
pnpm --dir targets/<name>/evals verify suites/agent
```

This copies the eval runner into `targets/<name>/evals/` and adds the job. On GitLab, the job is `.gitlab/ci/workshop-agent-evals.yml` with an include. On GitHub, it is `.github/workflows/workshop-agent-evals.yml`. The job runs on pushes to `dev-days-workshop/*` and on MRs/PRs. It needs no model and no secret. It runs `pnpm verify suites/agent` in exactly the same way as the local command.

Before pushing, confirm once with the participant. This is the first push of the workshop branch. The CI check from Phase 1 must be clean, or its findings must be confirmed.

### [HUMAN]

They commit the CI files and push the workshop branch. Then they watch the job in GitLab or GitHub:

```bash
for f in evals .gitlab .gitlab-ci.yml .github; do [ -e "targets/<name>/$f" ] && git -C targets/<name> add "$f"; done
git -C targets/<name> status --short
git -C targets/<name> commit -m "workshop: agent eval CI gate"
git -C targets/<name> push -u origin dev-days-workshop/<participant>
```

### [BRANCH]

- **No remote yet** (`host: none`, including `sample` and catch-up) → they create an empty project in their own GitLab namespace or GitHub account. They add it with `git -C targets/<name> remote add origin <url>`. They run `pnpm workshop profile <name>` so the profile records the remote and host. Then they run `pnpm workshop install <name> ci-agent-evals --force` for the right host, and push.
- **Production repo** → the job is new. It runs only on workshop branches and their MRs/PRs. If the Phase 1 CI check said REVIEW and nobody confirmed it, stop and switch to the mirror.
- **The job fails as stale in CI but passes locally** → stale means a tracked file changed after the recording. Here, a tracked file is different on their machine and in the commit. Usually the cause is an uncommitted file or a file that git ignores. Run `git status` in the target, then record again.

## 14.4 Gate check

The participant confirms, and you verify:

- [ ] `agent-suite.json` is committed, has a threshold for each grader in the gate, and tracks every agent file. — read `targets/<name>/evals/suites/agent/agent-suite.json` and compare it with `expectations.md` and the Phase 2 inventory
- [ ] `last-run.json` is committed and `pnpm verify suites/agent` passes locally. — `pnpm --dir targets/<name>/evals verify suites/agent` and `git -C targets/<name> status --short`
- [ ] The CI job runs on the pushed workshop branch and passes. — the pipeline link they share, or `glab ci status` / `gh run list --branch dev-days-workshop/<participant>`

---

## Phase Complete

Mark Phase 14 complete. Preview: "Phase 15 — open MRs/PRs that pass and fail the gate, and merge only the one that passes into your workshop branch."
