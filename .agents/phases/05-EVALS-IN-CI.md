# Phase 5 — Evals in CI

## Overview

You'll turn the eval suite into a merge gate in GitLab CI or GitHub Actions — without putting a model or any secret into CI. The suite runs on your machine with your own Claude Code or Cursor login and records its result, fingerprinted against the exact prompt, code and dataset it measured. CI checks that the recording is fresh and passed. Then you'll prove it blocks a bad change. This gate is what Day 2's agents will have to get past.

---

## 5.1 [BRANCH] Remote check

Read `host` from the profile.

- **`gitlab` or `github`** → continue with 5.2.
- **`none`** (sample or a local repo without a remote) → **No remote yet:** the participant needs a project to push to. Ask the facilitators for a project in the workshop group, or create one (GitLab: empty project, no README; GitHub: empty repo). Then:

  ```bash
  cd targets/<name>
  git remote add origin <url>
  git push -u origin main && git push -u origin workshop/<participant>
  ```

  (Pushing `main` here is the one allowed push to a default branch: it seeds an empty remote.)
  Re-run `pnpm workshop profile <name>` so the host is detected. GitLab Premium/Ultimate is needed later for Cursor cloud agents — mention it, don't block on it.

  **Catch-up targets:** `progress.json` → `targets.<name>.pendingInstall` lists components the catch-up couldn't install without a host. Install them now, record the evals (5.4), commit on `main`, push, then merge `main` into the workshop branch — exactly as the catch-up printed.

## 5.2 [LLM] Explain the gate in four lines

> "CI here has no model and no secrets. So: you run the suite locally with `--record`. That writes `last-run.json` next to the suite — the results plus a SHA-256 of every file that defines the experiment. CI re-hashes those files. Changed prompt, code, cases or threshold without a fresh recording → red. Fresh but below threshold → red."

Be honest about the trust model in one line: CI proves someone ran the full suite on exactly this code and it passed; it can't prove the file wasn't hand-edited, so `last-run.json` gets reviewed like code (and the review agent in Phase 9 is told to flag hand edits).

## 5.3 [HUMAN] Choose the threshold and what to track

Show the last runs' numbers (overall pass rate, per-grader means, `critical` tag pass rate, noise floor from Phase 4). They set two things in `suite.ts`:

```ts
threshold: {
  passRate: 0.75,                      // overall
  graders: { "<grader name>": 0.85 },  // names exactly as in the summary table, e.g. "exact:costCode"
  tags: { critical: 1 },               // every case tagged critical must pass
},
tracks: ["../../../src/classify.ts"],  // the feature under test: prompt, code, schema (relative to suite.ts)
```

Rule of thumb for the threshold: below the current score by more than the noise floor, high enough that the Phase 4 regression would have failed it. A misspelled grader or tag name fails every run — check against the summary table.

For `tracks`: exactly the files whose change should force a re-measurement — the prompt, the model call, the parsing. Too narrow and a prompt change sneaks through; too broad (a whole `src/`) and every unrelated change goes red. The suite folder itself is always tracked. For `sample-feature` targets: `["../../subject/cost-coder"]`. For `shellTask` targets: the feature's source files or folder.

## 5.4 [LLM] Record

```bash
pnpm --dir targets/<name>/evals eval suites/<suite>/suite.ts --record --label gate
pnpm --dir targets/<name>/evals verify suites/<suite>/suite.ts
```

The first uses whichever model the participant has (Claude Code or Cursor login — say which the summary used). The second is exactly what CI will run. If the recorded run misses the threshold, that's a real finding: go back to Phase 4 or justify a lower threshold — don't move on red.

## 5.5 [LLM] Install the CI job

```bash
pnpm workshop install <name> ci-evals --suite <suite>
```

- **GitLab** → writes `.gitlab/ci/workshop-evals.yml` and adds an `include:` to `.gitlab-ci.yml`. If the script printed `MANUAL` or `CHECK`, fix the target's CI config by hand now (existing `include:` syntax, missing `test` stage, `workflow:` rules). Show the final `include:` block.
- **GitHub** → writes `.github/workflows/workshop-evals.yml`.

The job only needs Node: it installs `evals/` (for the runner) and runs `pnpm verify`. No secrets to configure. It publishes the recorded per-case results as a JUnit report, so the MR/PR shows them.

(Only if the organisation allows a model credential in CI: `ci-evals-live` re-runs the suite in the pipeline instead. Not used in this workshop.)

## 5.6 [LLM] Green run

Commit `evals/` (with `last-run.json`) and the CI file on the workshop branch, push, open an MR/PR against the default branch (confirm with the participant before pushing). Watch the job and show where results appear (GitLab: MR widget test report; GitHub: job summary).

## 5.7 [HUMAN] Make it block — twice

On a new branch:

1. **Stale:** make the Phase 4 regression (or any prompt edit) and push *without* re-recording. The gate fails and names the changed file.
2. **Measured and bad:** re-record with that change and push. Now the gate fails on the threshold and names the failing cases.

Close that MR/PR without merging. Then make it a real gate:

- GitLab: *Settings → Merge requests → Pipelines must succeed*.
- GitHub: branch protection / ruleset on the default branch requiring the `workshop-evals` check.

## 5.8 [LLM] Merge the green one

With the participant's OK, merge the green MR/PR so the default branch has `evals/`, the recording and the CI job. Day 2 agents branch from the default branch and must see all three.

## Gate 5

Verify:

- [ ] Default branch contains `evals/`, `suites/<suite>/last-run.json` and the CI job
- [ ] One MR/PR had a passing gate; one failed as stale and then on the threshold
- [ ] The participant can explain what `tracks` covers and why

## Room Gate 5

Everyone needs a remote with a working eval gate before Phase 6 and Day 2. Wait for release.

---

## Phase Complete

Mark Phase 5 complete. Preview: "Phase 6 — you've measured your feature. Now you measure the coding agent itself, on tasks taken from your own history."
