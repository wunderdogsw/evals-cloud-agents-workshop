# Phase 15 — Make the gate block

## What you do

1. **Open a passing MR/PR** — make a harmless change on a new `dev-days-workshop` branch and open an MR/PR to your workshop branch. The gate passes.
2. **Make the gate fail twice** — on a second branch, change an agent file without recording, so the recording is stale. Then record a setup that misses the threshold.
3. **Merge the passing one** — merge it into your workshop branch, never into the default branch.

## Gate

- [ ] One MR/PR passed the gate and is merged into the workshop branch.
- [ ] One MR/PR was blocked twice: first as stale, then on the threshold.
- [ ] Nothing was pushed or merged outside `dev-days-workshop/*`.

## Learning point

An eval that never blocks a merge only reports numbers; it doesn't protect anything. You can trust the gate after you have seen it block a merge for both reasons.

## Wanted outcome

You have a merge gate on the workshop branch that you have seen pass, block a stale recording and block a weaker setup, and it ends the evals section.

---

## 15.1 Open a passing MR/PR

### [LLM]

> Narrate: "Two MRs/PRs, all to your workshop branch. One should pass. One should fail twice, for two different reasons."

Point out that this CI job is itself a hard gate, like the Phase 5 hook and the `gate` rows in `expectations.md`: it doesn't measure, it blocks.

Explain the branch rule once. Every branch is `dev-days-workshop/<participant>-<suffix>`. Every MR/PR targets `dev-days-workshop/<participant>`. The push guard blocks anything else. Before the first push in this phase, confirm once with the participant.

### [HUMAN]

They make a change that touches no tracked file, for example a line in the README. They push it and open the MR/PR:

```bash
git -C targets/<name> switch -c dev-days-workshop/<participant>-gate-pass
# edit README.md, then:
git -C targets/<name> commit -am "docs: gate check"
git -C targets/<name> push -u origin dev-days-workshop/<participant>-gate-pass
```

- GitLab: `glab mr create --source-branch dev-days-workshop/<participant>-gate-pass --target-branch dev-days-workshop/<participant> --fill`
- GitHub: `gh pr create --base dev-days-workshop/<participant> --fill`

They wait until `workshop-agent-evals` passes. They leave the MR/PR open.

## 15.2 Make the gate fail twice

### [HUMAN]

They start a second branch from the workshop branch. On it, they remove the same rule as in Phase 13, or make any other change to an agent file. They do **not** record:

```bash
git -C targets/<name> switch dev-days-workshop/<participant>
git -C targets/<name> switch -c dev-days-workshop/<participant>-gate-block
# loosen the rule again (or cherry-pick the Phase 13 experiment commit), then:
git -C targets/<name> commit -am "agent: loosen <rule>"
git -C targets/<name> push -u origin dev-days-workshop/<participant>-gate-block
```

They open the MR/PR in the same way as in 15.1. The gate must fail as **stale**, which means a tracked file changed after the recording. The gate must name the changed file.

Then they record on that branch. Recording again is the correct way to fix a stale recording:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --label gate-block --record targets/<name>/evals/suites/agent
```

They commit `last-run.json` and push. Now the gate must fail on the **threshold** and name the grader.

### [BRANCH]

- **The setup without the rule still meets the threshold** (Phase 13 found no regression) → the recording is up to date and passes, so nothing blocks. Raise that rule's threshold above the highest score any run reached. Commit, record again and push. Now the gate blocks on the threshold. Write in `CHANGELOG.md` that no task tests this rule.
- **GitLab project requires "Pipelines must succeed"** → they see Merge blocked. On other projects they see a failed (red) check. On a real repo, don't change merge settings for the workshop. A failed required check gives the same information.

## 15.3 Merge the passing one

### [HUMAN]

They merge the passing MR/PR into their workshop branch. They close the blocked one without merging:

- GitLab: `glab mr merge <id>` then `glab mr close <id>`
- GitHub: `gh pr merge <number> --merge` then `gh pr close <number>`

First check that the target branch shown is `dev-days-workshop/<participant>`. Then they pull it locally:

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

This is the end of the evals section. Facilitators show each table's scores for each rule, with and without the setup. They also show which rule the gate protects best. Wait until the facilitators release the room.

---

## Phase Complete

Mark Phase 15 complete. Preview: "Phase 16 — start the cloud agents section: build a skill that reads your merged PRs/MRs and reports what reviewers keep pointing out."
