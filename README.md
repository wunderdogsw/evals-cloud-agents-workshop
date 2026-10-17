# Evals & Cloud Agents Workshop

A practical 1.5-day workshop on **checking how well coding agents follow your repo's rules**, and on **giving work to cloud agents safely**. You work on *your own* repository.

Tools: **Cursor** and/or **Claude Code** (use either, both, or switch at any time), with **GitLab or GitHub**. No API keys, and nothing secret in CI.

## How this works

There is no fixed tutorial to read. An AI coding assistant (Claude Code or Cursor) is your guide. It reads the plan in this repo, takes you through each phase, checks your work at each phase's Gate, and helps when something goes wrong.

This repo is the **workshop repo**. The repo you work on is the **target**:

1. Clone this repo and open it in your assistant.
2. Type `/workshop` (or paste `MASTER_PROMPT.md`).
3. The guide asks which repo you want to work in: a GitLab/GitHub URL, a local checkout, or the sample app in this repo.
4. It attaches the target under `targets/<name>/` on a new `dev-days-workshop/<you>` branch, detects its stack and commands, and every later phase works there.
5. Progress is saved in `.workshop/progress.json`, so you can stop and continue in a later session.

```
evals-cloud-agents-workshop/       ← open THIS in Cursor / Claude Code
├── AGENTS.md                      ← the guide's operating instructions
├── .agents/phases/                ← one document per phase
├── .agents/assets/                ← scripts the guide runs
├── kit/evals/                     ← eval runner (LLM judge, compare, calibrate, record and verify for CI)
├── kit/agent-evals/               ← runs a coding agent on tasks from your own git history and grades it per rule
├── kit/templates/                 ← CI jobs (GitLab + GitHub), agent suite folder, Cursor env, AGENTS.md snippets
├── kit/catchup/                   ← reference work for `pnpm workshop catchup`
├── samples/cost-coder/            ← sample target (TypeScript) with an agent setup that has problems on purpose
├── targets/                       ← gitignored — your attached repo(s) land here
└── .workshop/                     ← gitignored — progress, repo profile, notes, labels
```

## What you do

| Section | Phase | What you do |
|---|---|---|
| Evals | 1 — Attach your target | Attach a repo on a `dev-days-workshop` branch and prove its tests run |
| Evals | 2 — Discover your agent setup | List what the agent really loads: instructions, rules, skills, hooks, MCP |
| Evals | 3 — Check the setup with Claude Code | `claude doctor`, `/doctor` and `/doctor prompt-audit`; rank the findings |
| Evals | 4 — Fix the instruction files | Make sure the instructions load, don't contradict each other and stay short; audit again |
| Evals | 5 — Add skills, hooks and permissions | A skill that runs the app, a hook that blocks a broken rule, a checked list of allowed commands |
| Evals | 6 — Turn your rules into expectations | Mark each rule checkable by code or by a judge; pick five |
| Evals | 7 — Build agent tasks from your history | Turn merged changes into agent tasks, graded by the tests from the real change |
| Evals | 8 — Baseline the agent | Run the tasks with and without your setup |
| Evals | 9 — Grade rules with code | Code that checks each code rule on the agent's diff |
| Evals | 10 — Write the judge rubric | A rubric for each judge rule, and your own labels before any judge runs |
| Evals | 11 — Calibrate the judge | Check the judge against your labels; find out if it is too lenient or too strict |
| Evals | 12 — Change one agent file, measure it | One change, a compared run, a keep-or-revert decision |
| Evals | 13 — Catch a regression | Read the scores per rule and explain a rule that got worse |
| Evals | 14 — Record evals for CI | Record a run with a hash of each tracked file; CI checks it without a model |
| Evals | 15 — Make the gate block | One MR/PR passes the gate, one is blocked |
| Cloud agents | 16 — Delegate | Give an issue to Claude Code or Cursor in headless mode; an MR/PR comes back |
| Cloud agents | 17 — Cloud agents | The same task handover, in a cloud VM |
| Cloud agents | 18 — Guardrails | A review agent, and an agent section in AGENTS.md, measured |
| Cloud agents | 19 — Capstone | Several agents on a backlog; you decide what to merge from the evidence |

## Prerequisites

- Node.js 22+ and pnpm (`corepack enable`)
- Git
- Claude Code 2.1.283 or later (needed for `/doctor prompt-audit` in Phases 2–4), logged in. Cursor is optional.
- Agents and judges run on your own subscription, **no API key needed**. Scripted steps use the `claude` CLI or Cursor's `agent` CLI.
- From Phase 14: a GitLab project or GitHub repo you can push a `dev-days-workshop/*` branch to, with CI turned on (GitLab Premium/Ultimate if you want Cursor cloud agents on it)

## From zero to action

```bash
git clone <this repo> evals-cloud-agents-workshop
cd evals-cloud-agents-workshop
pnpm install
```

Open the folder in Cursor or Claude Code, then type **`/workshop`**.

The guide uses these helpers. You can also run them yourself:

```bash
pnpm workshop attach sample            # or a git URL, or a path to a local checkout
pnpm workshop install <target> agent-suite   # kit components: agent-tasks, agent-suite, ci-agent-evals, cursor-env, …
pnpm workshop delegate <target> --issue 3   # Claude Code or Cursor CLI works on the issue, opens an MR/PR
pnpm workshop catchup 6                # new sample target, ready to start Phase 6
pnpm agent-evals --help                # run, grade, label and record agent runs
pnpm evals --help                      # compare runs, calibrate a judge
```

## GitLab vs GitHub

Both are fully supported. The guide detects the host from your target's remote and picks the right templates:

| | GitLab | GitHub |
|---|---|---|
| Agent eval gate | `.gitlab-ci.yml` job checks the committed recording; JUnit results in the MR | Actions workflow checks it; check result on the PR |
| Delegated agent | `pnpm workshop delegate` (Claude Code or Cursor CLI) → MR | same → PR |
| Cloud agent | Cursor cloud agents (Premium/Ultimate) | Cursor cloud agents, Claude Code cloud sessions |
| Review agent | `pnpm workshop review` / Cursor Bugbot | `pnpm workshop review` / Cursor Bugbot |

Extra templates for organisations that *do* allow a model credential in CI (`ci-evals-live`, `ci-claude`, `ci-review`) are in `kit/templates/ci/`. The workshop doesn't use them.

## Manual vs generated work

The guide writes the setup code. **You** write the things that decide the result:

- the inventory and findings about your agent setup,
- the rules you pick and how each is checked,
- the agent task prompts,
- the rule graders, the judge rubrics and your labels,
- the thresholds and the keep-or-revert decisions,
- the task prompts you give to cloud agents.

If the guide writes these for you, the measurement checks the guide's opinion, not yours.
