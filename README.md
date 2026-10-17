# Evals & Cloud Agents Workshop

A hands-on, 1.5-day workshop on **evaluating LLM features and coding agents**, and on **delegating work to cloud agents safely** — on *your own* repository.

Stack: **Cursor** and/or **Claude Code** — use either, both, or switch any time — with **GitLab or GitHub**. No API keys, nothing secret in CI.

## How this works

You do not follow a static tutorial. An AI coding assistant (Claude Code or Cursor) acts as your guide: it reads a structured plan from this repo, drives you through each phase, verifies your progress at gates, and adapts when things go wrong.

This repo is the **control room**. The repo you actually work on is the **target**:

1. Clone this repo and open it in your assistant.
2. Type `/workshop` (or paste `MASTER_PROMPT.md`).
3. The guide asks which repo you want to work in — a GitLab/GitHub URL, a local checkout, or the bundled sample app.
4. It attaches the target under `targets/<name>/`, profiles it, and every later phase works there.
5. Progress lives in `.workshop/progress.json`, so you can resume across sessions.

```
evals-cloud-agents-workshop/       ← open THIS in Cursor / Claude Code
├── AGENTS.md                      ← the guide's operating instructions
├── .agents/phases/                ← one document per phase
├── .agents/assets/                ← scripts the guide runs
├── kit/evals/                     ← eval runner (graders, LLM judge, compare, calibrate, JUnit)
├── kit/agent-evals/               ← coding-agent benchmark built from your own git history
├── kit/templates/                 ← CI (GitLab + GitHub), Cursor env, AGENTS.md snippets
├── samples/cost-coder/            ← bundled fallback target (TypeScript)
├── targets/                       ← gitignored — your attached repo(s) land here
└── .workshop/                     ← gitignored — progress + repo profile
```

## What you do

| Section | Phase | What you do |
|---|---|---|
| Evals | 1 — Attach your target | Attach a repo on a `dev-days-workshop` branch and prove its tests run |
| Evals | 2 — Discover your agent setup | Inventory what the agent actually loads: instructions, rules, skills, hooks, MCP |
| Evals | 3 — Check the setup with Claude Code | `claude doctor`, `/doctor` and `/doctor prompt-audit`; rank the findings |
| Evals | 4 — Fix the instruction files | Make the instructions load, agree and stay short; re-audit |
| Evals | 5 — Add skills, hooks and permissions | A run skill, a hook that blocks, a reviewed allow list |
| Evals | 6 — Turn your rules into expectations | Mark each rule checkable by code or by a judge; pick five |
| Evals | 7 — Build agent tasks from your history | Replay merged changes as agent tasks with hidden tests |
| Evals | 8 — Baseline the agent | Run the tasks with and without your setup |
| Evals | 9 — Grade rules with code | Deterministic graders for the code rules |
| Evals | 10 — Write the judge rubric | A rubric and blind labels for the judgement rules |
| Evals | 11 — Calibrate the judge | Agreement with your labels, and the judge's lean |
| Evals | 12 — Change one agent file, measure it | One change, a compared run, a keep-or-revert decision |
| Evals | 13 — Catch a regression | Read scores per rule and explain a regression |
| Evals | 14 — Record evals for CI | A fingerprinted recording, verified in CI without a model |
| Evals | 15 — Make the gate block | One MR/PR passes the gate, one is blocked |
| Cloud agents | 16 — Delegate | An issue goes to Claude Code or Cursor headless; an MR/PR comes back |
| Cloud agents | 17 — Cloud agents | Same delegation in a cloud VM |
| Cloud agents | 18 — Guardrails | Review agent and measured agent instructions |
| Cloud agents | 19 — Capstone | Parallel agents on a backlog, triaged by eval results |

Phases 8–15 are being built; the guide stops there and hands over to a facilitator until they're ready.

## Prerequisites

- Node.js 22+ and pnpm (`corepack enable`)
- Git
- Cursor and/or Claude Code
- Claude Code and/or Cursor, logged in — evals and agents run on your own subscription, **no API key needed**. For scripted steps: the `claude` CLI or Cursor's `agent` CLI.
- For Day 2: a GitLab project or GitHub repo you can push to, with CI enabled (GitLab Premium/Ultimate if you want Cursor cloud agents on it)

## From zero to action

```bash
git clone <this repo> evals-cloud-agents-workshop
cd evals-cloud-agents-workshop
pnpm install
```

Open the folder in Cursor or Claude Code, then type **`/workshop`**. That's it.

Under the hood the guide uses a few helpers you can also run yourself:

```bash
pnpm workshop attach sample            # or a git URL, or a path to a local checkout
pnpm workshop install <target> evals   # kit components: evals, ci-evals, cursor-env, agents-section, …
pnpm workshop delegate <target> --issue 3   # Claude Code or Cursor CLI works the issue, opens an MR/PR
pnpm workshop catchup 6                # fresh sample target, ready to start Phase 6
pnpm evals --help                      # eval runner
pnpm agent-evals --help                # coding-agent benchmark
```

## GitLab vs GitHub

Both are first-class targets. The guide detects the host from your target's remote and picks the right templates:

| | GitLab | GitHub |
|---|---|---|
| Eval gate | `.gitlab-ci.yml` job verifies the committed recording; JUnit in the MR | Actions workflow verifies it; check on the PR |
| Delegated agent | `pnpm workshop delegate` (Claude Code or Cursor CLI) → MR | same → PR |
| Cloud agent | Cursor cloud agents (Premium/Ultimate) | Cursor cloud agents, Claude Code cloud sessions |
| Review agent | `pnpm workshop review` / Cursor Bugbot | `pnpm workshop review` / Cursor Bugbot |

Optional templates for organisations that *do* allow a model credential in CI (`ci-evals-live`, `ci-claude`, `ci-review`) are in `kit/templates/ci/`, unused by default.

## Manual vs generated work

The guide generates boilerplate. A few things **you** write, because they are the point:

- the eval cases (what "good" means for your feature),
- the judge rubric and your calibration labels,
- the CI threshold,
- the task prompts you hand to cloud agents.

It's easy to cheat. Don't — the dataset is the product.
