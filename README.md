# Evals & Cloud Agents Workshop

A hands-on, 1.5-day workshop on **evaluating LLM features and coding agents**, and on **delegating work to cloud agents safely** — on *your own* repository.

Stack: **Cursor**, **Claude** (Claude Code + Claude API), **GitLab or GitHub**.

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

| Day | Phase | What you do |
|---|---|---|
| 1 | 1 — Attach your target | Pick a repo, attach it, profile it, prove its tests run |
| 1 | 2 — Your first eval | Golden dataset + deterministic graders, baseline score |
| 1 | 3 — LLM-as-judge | Write a rubric, calibrate the judge against your own labels |
| 1 | 4 — Iterate without regressing | Change prompt/model, compare runs, catch a regression |
| 1 | 5 — Evals in CI | Eval gate in GitLab CI or GitHub Actions — a bad MR/PR gets blocked |
| 1 | 6 — Evaluate the coding agent | Replay merged changes from your history as agent tasks |
| 2 | 7 — Claude as a cloud agent | Claude opens an MR/PR from an issue (GitLab CI job / GitHub Action) |
| 2 | 8 — Cursor cloud agents | Same task, different agent, compare |
| 2 | 9 — Guardrails | AGENTS.md for agents, eval gate, review agent |
| 2 | 10 — Capstone | Parallel agents on a backlog, triaged by eval results |

## Prerequisites

- Node.js 22+ and pnpm (`corepack enable`)
- Git
- Cursor and/or Claude Code
- An Anthropic API key (provided by facilitators, or your own)
- For Day 2: a GitLab project (Premium/Ultimate for Cursor cloud agents) **or** a GitHub repo you can push to, with CI enabled

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
pnpm workshop install <target> evals   # kit components: evals, ci-evals, ci-claude, ci-review, cursor-env, …
pnpm workshop catchup 5                # fresh sample target, ready to start Phase 5
pnpm evals --help                      # eval runner
pnpm agent-evals --help                # coding-agent benchmark
```

## GitLab vs GitHub

Both are first-class targets. The guide detects the host from your target's remote and picks the right templates:

| | GitLab | GitHub |
|---|---|---|
| Eval gate | `.gitlab-ci.yml` job, JUnit report in MR | Actions workflow, check on PR |
| Claude cloud agent | Claude Code CI job (beta, maintained by GitLab) | `anthropics/claude-code-action@v1`, or Claude Code on the web |
| Cursor cloud agent | Supported (needs GitLab Premium/Ultimate) | Supported, also via `@cursor` comments |
| Review agent | Claude review job / Cursor Bugbot | Claude review workflow / Cursor Bugbot |

## Manual vs generated work

The guide generates boilerplate. A few things **you** write, because they are the point:

- the eval cases (what "good" means for your feature),
- the judge rubric and your calibration labels,
- the CI threshold,
- the task prompts you hand to cloud agents.

It's easy to cheat. Don't — the dataset is the product.

## For facilitators

See [`FACILITATOR.md`](FACILITATOR.md) for prep, room gates, catch-up scripts and the dry-run checklist.
