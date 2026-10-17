# Phase 17 — Cloud agents

## Overview

This is the same task handover as Phase 16, but the agent runs on another company's machine. It clones your repo into a remote virtual machine (VM), works there, and pushes a branch, even while your laptop is closed. You set up the VM's build environment, give the agent a task, and compare the result with Phase 16 on the same evidence: CI pipeline, hidden tests and how much review it needed.

---

## 17.1 [LLM] Which cloud agent is available

Check and report in two lines. Don't change anything without telling them. Use whichever applies. Participants may have one, both or neither:

- **Cursor cloud agents** work with GitLab (Premium or Ultimate; self-hosted GitLab may need extra network setup) and GitHub. They need the repo connected in the Cursor dashboard (*Integrations*, synced; facilitators set this up), and a paid Cursor plan with cloud agents and a spend limit turned on.
- **Claude Code cloud sessions** (claude.ai/code, `claude --cloud "<task>"`) work with **GitHub repos only**. They can't push to GitLab. They need the Claude GitHub App on the repo, or `/web-setup`.

If neither is available for this target (for example GitLab without Cursor), go to 17.4 and run **two `pnpm workshop delegate` jobs at the same time** in two terminals. The lesson is the same: hand over the task, do something else, then review the evidence. Only the machine is different. They note this in `agent-notes.md`.

## 17.2 [LLM] Build environment (Cursor)

Cursor builds its environment from `.cursor/environment.json` on the **default branch**. An agent started on another branch checks out that branch after the environment is built. Without the file in the repo, Cursor uses a saved personal or team environment ([setup docs](https://cursor.com/docs/cloud-agent/setup)). We never merge to the default branch of a real repo, so:

```bash
pnpm workshop install <name> cursor-env
```

- Node targets get an `install` command.
- Other stacks get a Dockerfile in `.cursor/` based on the same image as CI. They edit it for the target's toolchain.

- **Real repo:** commit and push the file on the workshop branch and start the agent on that branch, or let Cursor's guided setup save a personal environment. Don't merge to the default branch.
- **Sample, catch-up or facilitator mirror:** committing on the default branch is allowed (confirm first).

For Claude Code cloud sessions, the same thing is the environment's setup script (claude.ai/code → environment settings). Mention it if they use Claude Code cloud sessions.

## 17.3 [LLM] Evals inside the VM

The agent eval gate in CI needs no model, so the cloud agent needs no login for it. Explain the two cases:

- **The agent changes only code** → the `workshop-agent-evals` job passes, because no tracked agent file changed. The code itself is checked by the repo's tests and by the review.
- **The agent changes an agent file** (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/`) → the job fails as **stale**. A person must record the agent evals again on that branch (Phase 14) before the merge. AGENTS.md tells the agent to say so in the MR/PR.

The repo's own tests run in the VM with the build environment from 17.2.

## 17.4 [HUMAN] Delegate

They start the agent with a task from the backlog. The best choice is the same task as in Phase 16, or a similar one:

- **Cursor:** Agent input → **Cloud**, pick the repo and the workshop branch `dev-days-workshop/<participant>` (or cursor.com/agents). Ask it to open an MR/PR **into the workshop branch** when done.
- **Claude Code (GitHub):** start a session at claude.ai/code on the repo, or `claude --cloud "<task>"` from `targets/<name>` while on the workshop branch; create the PR **into the workshop branch** when done.

Cloud agents push from their own machines, where the workshop push guard doesn't run. Before starting, check that the base branch is the workshop branch. Afterwards, check the MR/PR target branch and change it if needed.

While it runs, explain what is different from Phase 16: the agent runs on another company's VM, the environment is defined in the repo, and they can send follow-up messages from a browser or phone while it works.

## 17.5 [HUMAN] Review and compare

Same review as Phase 16. Then a comparison table in `.workshop/targets/<name>/agent-notes.md`:

| | Phase 16 (laptop, `<tool>`) | Phase 17 (`<where>`, `<tool>`) |
|---|---|---|
| CI pipeline | | |
| Hidden tests (sample) | | |
| Review comments needed | | |
| Scope creep? | | |
| Wall time | | |
| Would merge? | | |

One task is only one example, so it doesn't prove which is better. Phase 18 measures with all tasks.

## Gate 17

- [ ] A second MR/PR written by an agent exists (from a cloud agent, or from a parallel `delegate` if no cloud agent was available), into the workshop branch, and its CI pipeline ran
- [ ] The comparison table is filled in

---

## Phase Complete

Mark Phase 17 complete. Preview: "Phase 18 — add a review agent that comments from your repo's rules, and measure the agent again with what you learned."
