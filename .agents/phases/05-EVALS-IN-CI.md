# Phase 5 — Evals in CI

## Overview

You'll run the eval suite in GitLab CI or GitHub Actions on every merge/pull request, with a threshold that fails the pipeline. Then you'll prove it works by opening a change that should be blocked — and watching it get blocked. This gate is what Day 2's agents will have to get past.

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

  **Catch-up targets:** `progress.json` → `targets.<name>.pendingInstall` lists components the catch-up couldn't install without a host. Install them now (`pnpm workshop install <name> <components…>`), commit on `main`, push, then merge `main` into the workshop branch — exactly as the catch-up printed.

## 5.2 [HUMAN] Choose the threshold

Show the last runs' numbers (overall pass rate, per-grader means, `critical` tag pass rate, and the noise floor from Phase 4). They set `threshold` in `suite.ts`:

```ts
threshold: {
  passRate: 0.75,                      // overall
  graders: { "<grader name>": 0.85 },  // names exactly as in the summary table, e.g. "exact:costCode"
  tags: { critical: 1 },               // every case tagged critical must pass
},
```

Rule of thumb to offer: below the current score by more than the noise floor, high enough that the Phase 4 regression would have failed it. They should be able to say *why* each number. A misspelled grader or tag name fails every run — check against the summary table.

## 5.3 [LLM] Install the CI job

```bash
pnpm workshop install <name> ci-evals --suite <suite>
```

- **GitLab** → writes `.gitlab/ci/workshop-evals.yml` and adds an `include:` to `.gitlab-ci.yml`. If the script printed `MANUAL` or `CHECK`, fix the target's CI config by hand now (existing `include:` syntax, missing `test` stage). Show the participant the final `include:` block.
- **GitHub** → writes `.github/workflows/workshop-evals.yml`.

Check `TARGET_INSTALL` in the job: it must install the target's dependencies if the suite imports target code; empty otherwise. For non-Node targets that use `shellTask`, the CI image needs that toolchain too — change `image:` (GitLab) or add a setup step (GitHub) and say which.

## 5.4 [HUMAN] Add the secret

They add `ANTHROPIC_API_KEY`:

- GitLab: *Settings → CI/CD → Variables* — masked, **not** protected (MR pipelines from unprotected branches must see it). Optional `GITLAB_ACCESS_TOKEN` (project access token, `api` scope) lets the job post the eval summary as an MR note.
- GitHub: *Settings → Secrets and variables → Actions → New repository secret.*

## 5.5 [LLM] Green run

Commit and push the workshop branch, open an MR/PR against the default branch (confirm with the participant before pushing). Watch the job; when it finishes, show where the results appear (GitLab: MR widget test report + artifacts + optional note; GitHub: job summary + PR comment + artifact).

## 5.6 [HUMAN] Make it block

They make a change that *should* fail the gate — the Phase 4 regression is perfect — on a new branch, push, open a second MR/PR. Confirm the eval job fails and the summary names the failing cases (and the threshold line names any failing `critical` cases). Close that MR/PR without merging.

Then make it a real gate:

- GitLab: *Settings → Merge requests → Pipelines must succeed*.
- GitHub: branch protection / ruleset on the default branch requiring the `workshop-evals` check.

## 5.7 [LLM] Merge the green one

With the participant's OK, merge the green MR/PR so the default branch has `evals/` and the CI job. Day 2 agents branch from the default branch and must see both.

## Gate 5

Verify:

- [ ] Default branch contains `evals/` and the CI job
- [ ] One MR/PR had a passing eval job; one had a failing eval job that named the failing cases
- [ ] The secret is configured (job didn't fail on auth)

## Room Gate 5

Everyone needs a remote with a working eval gate before Phase 6 and Day 2. Wait for release.

---

## Phase Complete

Mark Phase 5 complete. Preview: "Phase 6 — you've measured your feature. Now you measure the coding agent itself, on tasks taken from your own history."
