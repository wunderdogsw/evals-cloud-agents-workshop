# Phase 18 — Move the review lessons to the cloud

## What you do

1. **Ask how your company runs cloud agents** — ask the facilitator for the company's instructions for cloud sessions, and give the answer to the guide. The rest of the phase follows them.
2. **Choose where it posts** — agree with your team where the analysis goes, for example a Slack channel.
3. **Create the cloud job** — set up the routine or automation the way the instructions say. It runs on a schedule, runs `review-lessons`, and posts only the analysis.
4. **Run it once and check** — start one run, read the post, and check that no branch or PR was created.

## Gate

- [ ] The company's instructions for cloud agents are recorded in `.workshop/targets/<name>/cloud-instructions.md`, and the cloud job follows them.
- [ ] The cloud job has run once and posted the analysis to the place the team chose.
- [ ] The cloud job created no branch and no PR.

## Learning point

A cloud agent can do the reading every week without your laptop. It runs the way your company runs cloud agents, and the decisions about fixes stay with people.

## Wanted outcome

A scheduled cloud job, set up the way the company's instructions say, that posts the analysis to the team.

---

## 18.1 Ask how your company runs cloud agents

### [LLM]

> Narrate: "In Phase 17 the skill ran on your own machine. Now it moves to a cloud machine, so it runs every week even when your laptop is closed. Each company sets up cloud agents in its own way, so we start with your company's way."

Run `pnpm workshop status` and read the profile: `host`, `remote` and the workshop branch. Read what Phase 17 left: the committed changes on the workshop branch, `.workshop/targets/<name>/review-lessons.sh` if it exists, and the local schedule.

Explain in a few short lines:

- A **cloud agent** runs on a virtual machine (VM) that another company runs. It clones the repo from the host. So it sees only commits that are pushed.
- It acts with your accounts: your Claude or Cursor login, your GitHub or GitLab access, and your Slack account. A post from the job shows your name.
- That is why the company decides how cloud agents are set up. The facilitator knows the company's rules for this workshop, including special cases for GitLab.

If the profile says `host: none`, say first that this target takes the no-cloud path (see [BRANCH]), so they know before they ask. They still ask, so `cloud-instructions.md` records the company's way for a later target with a remote.

Then wait for their answer. Do not ask them about environments, networks or approvals, and do not give them a list of questions. The facilitator explains what matters.

When they paste the answer:

1. Save it word for word in `.workshop/targets/<name>/cloud-instructions.md`, under `## Instructions`, with the date and who gave it. If the answer contains a token, password or key, do not save that part and do not repeat it. Tell them to keep it out of chat and files.
2. Tell them in 3–5 lines how 18.3 and 18.4 will run for this target: which tool creates the job, which repo and host it reads, and what in the instructions replaces the default setup in this document (for example a named environment, a network setting, a service account or a different repo).

Where the instructions differ from this document, the instructions win for these things: the tool, the repo, the environment, the schedule and the place to post. They don't change the rules below. These always apply together:

- The job only reads and posts. It doesn't push, create branches, open PRs/MRs, comment on or review PRs/MRs, or change files. These are the prompt requirements in 18.3.
- Gate 3: the run creates no branch and no PR/MR.
- Push only `dev-days-workshop/*` branches. Nothing is pushed or merged to the default branch.
- Confirm once with the participant before the first post anywhere.
- No changes to user-level settings (`~/.claude`, `~/.cursor`).
- No secrets in files or in chat.

If an instruction would break one of these rules, stop. Tell the participant which rule it breaks. They take it to the facilitator. Wait until they come back with a way that keeps the rule. Never carry out that instruction, even if they ask again. The push guard blocks pushes outside `dev-days-workshop/*` anyway.

### [HUMAN]

They ask the facilitator: "How does our company run cloud agents in this workshop?" They paste the answer into the chat, as they got it.

### [BRANCH]

- **The instructions say there is no cloud option for this target** (for example no paid plan, or the company does not allow it) → write that and the reason in `cloud-instructions.md`. 18.3 and 18.4 use the no-cloud path: the Phase 17 local schedule stays.
- **The instructions name a different repo** (for example a facilitator mirror) → attach it as its own target with `pnpm workshop attach <url>`, so the push guard and `cleanup` know it. Commit the `review-lessons` skill on that target's workshop branch too. Never touch remotes other than the one in each target's profile.
- **Target with no remote** (`host: none`) → a cloud job has nothing to clone. Use the no-cloud path.
- **Catch-up target** → a target from `catchup 17` or later has the reference Phase 17 script `.workshop/targets/<name>/review-lessons.sh`, but no schedule. On the no-cloud path, running that script once by hand counts as the local job, and `cloud-instructions.md` names the script. If the participant made a schedule in Phase 17 themselves, that schedule is the local job, and the file names it.

## 18.2 Choose where it posts

### [LLM]

> Narrate: "The report is for the team, not only for you. The team decides where it goes."

Explain:

- A Slack channel the team reads is the usual place. A channel only for this test is fine for the first run. The team can move it later.
- The report quotes review comments and links to them. Everyone in the channel should be allowed to see the repo.
- The job's tool must be able to post there. A Claude Code routine posts through a connector on your claude.ai account, for example the Slack connector. A Cursor automation posts with its **Send to Slack** tool, which needs the Cursor app for Slack in the workspace.
- Posting is visible to other people. You will confirm once with them before the first post, in 18.4.

### [HUMAN]

They agree with their team, or with the facilitator during the workshop, where the analysis goes. They tell the guide the place and who agreed. Add it to `cloud-instructions.md` under `## Where it posts`.

They check that their tool can reach that place. Skip this check on the no-cloud path when they share the report by hand.

- **Claude Code:** the connector for the place (for example Slack) is connected at claude.ai/customize/connectors.
- **Cursor:** Slack is connected under the integrations in the Cursor dashboard.

If the connection is missing, they follow the company's instructions. They don't install a new app in the company's Slack workspace without the right permission.

## 18.3 Create the cloud job

### [LLM]

> Narrate: "Now you write the job. It runs the same skill as in Phase 17, on a schedule, on a cloud machine. It only reads and posts."

**Push the workshop branch, only on a cloud path.** The cloud job clones the repo from the host. The skill and the Phase 17 changes are only local commits so far. On a sample or catch-up target, push after the review-history commit in [BRANCH] below. On the no-cloud path nothing is pushed. Confirm once with the participant, then push through the push guard:

```bash
git -C targets/<name> status --short
git -C targets/<name> push -u origin dev-days-workshop/<participant>
```

The push runs the repo's pipelines, including the agent eval gate from Phase 14. If Phase 17 changed a tracked agent file, the gate fails as stale on this push. That is the gate working as it should. It doesn't block this phase. They can record again as in Phase 14 if they want it to pass.

**Give them the requirements for the job's prompt.** Don't write the prompt for them. The prompt must:

- Check out the branch `dev-days-workshop/<participant>` first. A Claude Code routine starts from the repo's default branch unless the prompt says otherwise, and the skill is only on the workshop branch.
- Read `.claude/skills/review-lessons/SKILL.md` and follow it, for the last 30 merged PRs/MRs (or the window the team wants). Reading the file works in every tool, also when the skill was not on the branch when the run started.
- Pass no report path to the skill, so it writes no file on the cloud machine. The skill prints the report, and the job posts that.
- Post the whole report, and nothing else, to the place from 18.2. One post per run. Say plainly that posting the report there is the job's task.
- Not push, not create branches, not open PRs/MRs, not comment on or review PRs/MRs, and not change files.
- Stop and say so in the run when it can't read the PRs/MRs or can't post. It must not guess.

The report is Markdown. Slack shows `###` headings as plain text. If the team wants, the prompt may ask for Slack formatting.

**The schedule:** the team picks it, for example weekly on Monday at 9:07. Pick a few minutes past the hour: a Claude Code routine set exactly on the hour can start several minutes late.

### [HUMAN]

They write the prompt themselves in `.workshop/targets/<name>/cloud-job-prompt.md`. The guide checks it against the requirements and points out what is missing.

Then they create the job in their tool, the way the instructions say, with that prompt, the repo, the schedule and the place to post. They write the job's name and link in `cloud-instructions.md` under `## Cloud job`.

### [BRANCH]

- **Claude Code routine** (GitHub only) → create it at claude.ai/code/routines with **New routine**, with `/schedule` in a Claude Code session in `targets/<name>`, or in the Desktop app: **Code** tab → **Routines** → **New routine** → **Cloud**.
  - Repository: the target's GitHub repo. Environment: **Default**, unless the instructions name another one.
  - Trigger: **Schedule**. The presets are hourly, daily, weekdays and weekly. For another interval, pick the closest preset and set a cron expression with `/schedule update`. The minimum interval is one hour.
  - Connectors: all your connected connectors are included by default, and the routine can use all their tools without asking. Remove every connector except the one for the place from 18.2.
  - Facts to tell them:
    - A run pushes to `claude/` branches unless the prompt says otherwise.
    - The cloud machine's git proxy doesn't limit which branches a push can update. Only GitHub branch protection or rulesets do, and a rule that your own GitHub access can bypass doesn't block the run. So the prompt's "do not push" is the only guard.
    - In cloud sessions `gh pr` and other GraphQL calls are blocked, and `gh api` REST calls work without a token of your own. The skill from Phase 16 uses `gh api`.
    - `/schedule` needs a claude.ai subscription login. With a Console API key, or with Amazon Bedrock or another cloud provider, the CLI says `Unknown command: /schedule` or a message about Claude for Enterprise. Then create the routine on the web page.
    - The routine needs GitHub access to clone the repo: the Claude GitHub App on the repo, or `/web-setup`, which sends your local `gh` login to your Claude account. On Team and Enterprise plans, an Owner has to turn on each of these first.
    - Routines are on Pro, Max, Team and Enterprise plans, and a Team or Enterprise Owner can turn them off. A routine belongs to your own account, so teammates don't see it. Runs use your subscription usage.
- **Cursor automation** (GitHub or GitLab) → create it at cursor.com/automations, in the Agents Window, or with `/automate`.
  - Trigger: a schedule, from a preset or a cron expression.
  - Repository: **single repository**, and the branch `dev-days-workshop/<participant>`.
  - Tools: add **Send to Slack** with the channel from 18.2. Don't add **Read Slack channels**, **Comment on pull request** or **Request reviewers**. **Pull request creation** and **Computer use** are included by default for every automation. Cursor's docs don't say whether they can be removed. Remove both if the form allows it. If not, the prompt forbids pull requests, and 18.4 checks it. **Memories** are on by default and can be turned off. Turn them off, so each run starts from the same state.
  - Run as: **Me**. The usage is billed to you. Cloud agents are charged at API pricing for the selected model, and Cursor asks you to set a spend limit when you first use them.
  - Facts to tell them: cloud agents need a paid Cursor plan. Cursor with GitLab needs GitLab Premium or Ultimate, and self-hosted GitLab also needs a Cursor Teams or Enterprise plan. Cursor's skills page says Cursor also loads skills from `.claude/skills/`. Its docs don't say that automations do. That is why the prompt reads the `SKILL.md` file. The docs also don't say that `gh` or `glab` is logged in on the cloud machine. If the instructions name a secret for this, it is added in the Cursor dashboard, never in a file or the chat.
- **The instructions name another tool or setup** → use it. The prompt requirements above, Gate 3 and the safety rules from 18.1 stay the same.
- **No cloud option** (from 18.1) → nothing is pushed. The Phase 17 local schedule stays; on a catch-up target, the Phase 17 script is the local job. If the team wants the post, they add the posting to the local job's prompt, with a Slack connection the local tool already has. Otherwise they share the saved report in the chosen place by hand after the run. They write this in `cloud-instructions.md` under `## Cloud job`, with the name of the schedule or the script. They still write `cloud-job-prompt.md` and the guide checks it against the requirements above, so it is ready when the team has a cloud option. To see a real cloud run, they pair with a participant on a cloud path and read that run's transcript together in 18.4, or the facilitator shows one run.
- **Sample or catch-up target** → it has no real PRs, and the skill reads the review history in `.workshop/`, which a cloud machine can't see. If the instructions name a repo with real review history, use that repo (see 18.1). If not, and the target has a remote, commit the review history to the sample target. The sample is a throwaway target, so this is allowed:

  ```bash
  cp -R .workshop/targets/<name>/review-history targets/<name>/review-history
  git -C targets/<name> add review-history
  git -C targets/<name> commit -m "workshop: review history for the cloud job"
  ```

  The prompt then gives the data folder `review-history/`. After this commit, push as in [LLM] above. A sample with no remote uses the no-cloud path and commits nothing.

## 18.4 Run it once and check

### [LLM]

> Narrate: "One run now, while we watch. Then you know what the team will see when the schedule runs without you."

Before the run, save the state you compare against after the run.

**Remote check**, when the target has a remote. If `ls-remote` fails, the file is removed, so the later `diff` fails loudly instead of comparing two empty files:

```bash
mkdir -p .workshop/targets/<name>/cloud-check
git -C targets/<name> ls-remote --heads origin > .workshop/targets/<name>/cloud-check/heads-before.txt \
  || { rm .workshop/targets/<name>/cloud-check/heads-before.txt; echo "ls-remote failed: use the local check"; }
```

Also list the newest PRs/MRs, so you can compare after the run:

- GitHub: `gh pr list --repo <owner>/<repo> --state all --limit 10`
- GitLab: `glab mr list --repo <group>/<project> --all --per-page 10`

**Local check**, on the no-cloud path. It is the only check when the target has no remote:

```bash
mkdir -p .workshop/targets/<name>/cloud-check
{ git -C targets/<name> rev-parse HEAD; git -C targets/<name> branch -a; git -C targets/<name> status --short; } > .workshop/targets/<name>/cloud-check/local-before.txt
```

The branch and PR/MR lists don't show comments on PRs/MRs. For those, the participant reads the run's transcript after the run.

Then confirm once with the participant: "This run posts the report to <place>, with your name. Start it?" When the report is shared by hand, there is nothing to confirm here.

### [HUMAN]

They start one run:

- **Claude Code routine:** **Run now** on the routine's page, or `/schedule run` in the CLI.
- **Cursor automation:** Cursor's docs don't describe a manual run. If the automation's page has a button for it, use it. If not, set the schedule a few minutes ahead, wait for the run, and then set the team's schedule back.
- **No-cloud path:** start the Phase 17 local job once by hand. On a catch-up target, that is `sh .workshop/targets/<name>/review-lessons.sh`. The script writes today's `scheduled-<YYYY-MM-DD>.md` and `scheduled-run.json` again, so a Phase 17 run from the same day is replaced. Phase 17's gate has already passed, so that is fine.

When the run is done, they read three things:

1. **The post.** Is it in the right place? Is it the whole report? Does each finding have its three parts? They open two evidence links and check that they show the right comment.
2. **The run's transcript.** Claude Code opens each run as a session. Cursor shows it with the cloud agents. Did it read the PRs/MRs without errors? Did it try to push, comment on a PR/MR or change a file? Look for comment attempts in particular, for example a `gh api` or `glab api` call with `POST` and a `body`, because the lists below don't show comments.
3. **The cost.** Claude Code routines use subscription usage, shown at claude.ai/settings/usage. Cursor shows cloud agent usage in its dashboard. On the no-cloud path with the Claude Code script, `scheduled-run.json` has `total_cost_usd`. Report the figures the tool shows.

Then they run the same checks as before the run.

**Remote check:**

```bash
git -C targets/<name> ls-remote --heads origin > .workshop/targets/<name>/cloud-check/heads-after.txt \
  || { rm .workshop/targets/<name>/cloud-check/heads-after.txt; echo "ls-remote failed: use the local check"; }
test -s .workshop/targets/<name>/cloud-check/heads-before.txt && test -s .workshop/targets/<name>/cloud-check/heads-after.txt \
  && diff .workshop/targets/<name>/cloud-check/heads-before.txt .workshop/targets/<name>/cloud-check/heads-after.txt
```

`diff` prints nothing when no branch was created or moved. If a `test -s` fails, a file is missing or empty, and the remote check has not passed. They also run the same `gh pr list` or `glab mr list` as before and compare.

**Local check:**

```bash
{ git -C targets/<name> rev-parse HEAD; git -C targets/<name> branch -a; git -C targets/<name> status --short; } > .workshop/targets/<name>/cloud-check/local-after.txt
diff .workshop/targets/<name>/cloud-check/local-before.txt .workshop/targets/<name>/cloud-check/local-after.txt
```

`diff` prints nothing when the run made no commit, no branch and no file change in the target.

They write the link to the post, the cost and the result of the checks in `cloud-instructions.md` under `## First run`.

### [BRANCH]

- **The run created a branch or a PR/MR, or commented on one** → they close the PR/MR and delete the comment. They check that the branch holds only the run's work, then delete it themselves. They fix the prompt or the job's settings and run again, until a run creates nothing.
- **The run couldn't read the PRs/MRs** → read the error in the transcript. A 403 that says GraphQL is not available means a `gh pr` call: the prompt must tell it to follow the skill, which uses `gh api`. An error about login or access means the cloud machine has no access to the host's API. Follow the instructions, or ask the facilitator.
- **The run couldn't post** → the connector or tool for the place is missing from the job, or it has no access to the channel. Fix it in the job's settings and run again.
- **The run stopped to ask for confirmation, or refused to post** → a routine's saved prompt is its task, but it can't act as approval or consent during the run. So the prompt must say plainly that posting the report to <place> is the task. They fix the prompt and run again.
- **A page asks you to approve a device** (for example Tailscale, a private network) → approve it only if the instructions say so. Otherwise close the page and ask the facilitator. Don't approve devices on a network you don't know.

## 18.5 Gate check

The participant confirms, and you verify:

- [ ] The company's instructions for cloud agents are recorded in `.workshop/targets/<name>/cloud-instructions.md`, and the cloud job follows them. — read `## Instructions` and `## Cloud job` in the file, then compare with the job the participant shows (its page, or `/schedule list`): repo, branch, schedule, and the connectors or tools. On the no-cloud path, the file says why there is no cloud job and names the Phase 17 local schedule, or on a catch-up target the script `review-lessons.sh`.
- [ ] The cloud job has run once and posted the analysis to the place the team chose. — the participant shows the post and the run's transcript; `## First run` in `cloud-instructions.md` has the link and the cost. On the no-cloud path, the local job ran once and its report reached the chosen place, posted by the job or shared by hand.
- [ ] The cloud job created no branch and no PR. — with a remote: `heads-before.txt` and `heads-after.txt` in `.workshop/targets/<name>/cloud-check/` both exist and are not empty, their `diff` prints nothing, and the PR/MR list shows nothing new from the run. On the no-cloud path: the `diff` of `local-before.txt` and `local-after.txt` prints nothing. On a cloud path, the run's transcript also shows no attempt to push, comment on a PR/MR or change a file.

## Room Gate

Optional, about 10 minutes, if the facilitator runs it. Ask the participant whether the facilitator runs it. If not, skip it and go to Phase Complete. If yes, each participant says in one or two sentences:

1. Where their job posts, and one finding from the first post.
2. Which kind of work they would give to a scheduled cloud agent next, and which kind never.

Wait until the facilitator lets the room continue.

---

## Phase Complete

Mark Phase 18 complete. This is the end of the workshop. Congratulate them briefly.

Remind them what they now have. Name only what they did:

- In the target, on `dev-days-workshop/*` branches: the `review-lessons` skill and the changes they made from its findings. If they did Day 1 on this target, also: checked agent instructions, a hook, rule graders, judge rubrics checked against their labels, a CI gate for the agent setup, and agent tasks from their own history.
- Outside the repo: the local schedule from Phase 17, if they made one. On a cloud path, also the cloud job from this phase.

Their default branch hasn't changed. If they want to keep parts, they open an MR/PR into their default branch themselves, through their team's normal review. You don't do it for them. On a cloud path, say also: the cloud job checks out the workshop branch, so after a merge they point its prompt at the default branch, or the job stops working when the branch is deleted.

Then run the cleanup as a dry run and walk through the list with them:

```bash
pnpm workshop cleanup <name>
```

Run it with `--yes` only when they confirm, and only for what they want removed. Their workshop branches can stay as long as they need them. The cleanup works at any time.

Some things the cleanup can't undo. They do these themselves:

- **The cloud job:** keep it, pause it or delete it. Claude Code routine at claude.ai/code/routines: the on/off switch at the top of the routine's page pauses it. To delete it, open the menu next to the routine's name and select **Delete**. Cursor automation: its page at cursor.com/automations. Pause or delete it before `cleanup --yes` deletes the workshop branch.
- **The Phase 17 local schedule:** remove it the way it was made:
  - **Claude Desktop:** open the routine in **Routines**, click **Delete**, and check **Also delete files on disk**.
  - **launchd:** `launchctl bootout gui/$(id -u)/workshop.review-lessons.<name>`, then `rm ~/Library/LaunchAgents/workshop.review-lessons.<name>.plist`.
  - **cron:** `crontab -e`, and delete the line with `review-lessons.sh`.
- **skill-creator:** in `targets/<name>`, run `claude plugin uninstall skill-creator@claude-plugins-official --scope local`.

Preview: "The workshop is over. Next week, read the first scheduled post with your team and decide which finding is worth a change."
