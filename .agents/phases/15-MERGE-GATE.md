# Phase 15 — Make the gate block

## What you do

1. **Open a passing MR/PR** — a harmless change on a new `dev-days-workshop` branch, aimed at your workshop branch: the gate is green.
2. **Break it twice** — on a second branch, change an agent file without recording (stale), then record a setup that misses the threshold.
3. **Merge the green one** — into your workshop branch, never the default branch.

## Gate

- [ ] One MR/PR passed the gate and is merged into the workshop branch.
- [ ] One MR/PR was blocked twice: first as stale, then on the threshold.
- [ ] Nothing was pushed or merged outside `dev-days-workshop/*`.

## Learning point

An eval that blocks nothing is just a dashboard. The gate earns trust when you've seen it say no for both reasons.

## Wanted outcome

A merge gate on the workshop branch that you've seen pass, block a stale recording and block a weaker setup; the cloud agents section delegates against it.

---

## 15.1 Open a passing MR/PR

### [LLM]

> Narrate: "Three MRs/PRs, all aimed at your workshop branch: one should pass, one should fail twice for two different reasons."

Explain the branch rule once: every branch is `dev-days-workshop/<participant>-<suffix>`, and every MR/PR targets `dev-days-workshop/<participant>`. The push guard blocks anything else. Before the first push in this phase, confirm once.

### [HUMAN]

They make a change that touches no tracked file (a README line), push it and open the MR/PR:

```bash
git -C targets/<name> switch -c dev-days-workshop/<participant>-gate-pass
# edit README.md, then:
git -C targets/<name> commit -am "docs: gate check"
git -C targets/<name> push -u origin dev-days-workshop/<participant>-gate-pass
```

- GitLab: `glab mr create --source-branch dev-days-workshop/<participant>-gate-pass --target-branch dev-days-workshop/<participant> --fill`
- GitHub: `gh pr create --base dev-days-workshop/<participant> --fill`

They wait for `workshop-agent-evals` to go green and leave the MR/PR open.

## 15.2 Break it twice

### [HUMAN]

From the workshop branch, a second branch with the loosening from Phase 13 (or any agent-file change), **without** recording:

```bash
git -C targets/<name> switch dev-days-workshop/<participant>
git -C targets/<name> switch -c dev-days-workshop/<participant>-gate-block
# loosen the rule again (or cherry-pick the Phase 13 experiment commit), then:
git -C targets/<name> commit -am "agent: loosen <rule>"
git -C targets/<name> push -u origin dev-days-workshop/<participant>-gate-block
```

They open the MR/PR the same way as in 15.1. The gate must fail as **stale** and name the changed file.

Then they record on that branch, which is the honest fix for "stale":

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --label gate-block --record targets/<name>/evals/suites/agent
```

They commit `last-run.json` and push. The gate must now fail on the **threshold**, naming the grader.

### [BRANCH]

- **The loosened setup still meets the threshold** (Phase 13 found no regression) → the recording is fresh and green, so nothing blocks. Raise that rule's threshold above what any run reached, commit, record again and push: now it blocks on the threshold. Note in `CHANGELOG.md` that the tasks don't exercise this rule.
- **GitLab project requires "Pipelines must succeed"** → they'll see Merge blocked. Elsewhere they see a red check; on a real repo, don't change merge settings for the workshop. A red required check is the same signal.

## 15.3 Merge the green one

### [HUMAN]

They merge the passing MR/PR into their workshop branch and close the blocked one without merging:

- GitLab: `glab mr merge <id>` then `glab mr close <id>`
- GitHub: `gh pr merge <number> --merge` then `gh pr close <number>`

Check first that the target branch shown is `dev-days-workshop/<participant>`. Then they pull it locally:

```bash
git -C targets/<name> switch dev-days-workshop/<participant>
git -C targets/<name> pull
```

## 15.4 Gate check

The participant confirms, and you verify:

- [ ] One MR/PR passed the gate and is merged into the workshop branch. — `glab mr list --merged` / `gh pr list --state merged`, target branch `dev-days-workshop/<participant>`
- [ ] One MR/PR was blocked twice: first as stale, then on the threshold. — the two failed `workshop-agent-evals` job logs on the `-gate-block` MR/PR
- [ ] Nothing was pushed or merged outside `dev-days-workshop/*`. — `git -C targets/<name> branch -r` and `pnpm workshop cleanup <name>` (without `--yes`) list only workshop branches

## Room Gate

End of the evals section. Facilitators show each table's per-rule scores, with and without the setup, and which rule the gate protects best. Wait for release.

---

## Phase Complete

Mark Phase 15 complete. Preview: "Phase 16 — hand an issue to a coding agent and let the gate you just built judge its MR/PR."
