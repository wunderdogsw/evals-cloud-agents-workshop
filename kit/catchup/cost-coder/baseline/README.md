# Precomputed baseline (facilitators)

Phase 8 runs the agent on the sample's tasks twice, with and without the agent setup. Those runs take 10–30 minutes and need a model login, so catch-up targets get a precomputed copy from this folder.

Before the workshop, on a machine logged in to Claude Code:

```bash
pnpm workshop catchup 8 --participant facilitator          # sample with the reference setup and tasks
T=.workshop/targets/cost-coder-catchup/agent-tasks/tasks.jsonl
pnpm agent-evals run targets/cost-coder-catchup --tasks $T --agent claude --setup "pnpm install --ignore-workspace" --label baseline-with
pnpm agent-evals run targets/cost-coder-catchup --tasks $T --agent claude --setup "pnpm install --ignore-workspace" --without-setup --label baseline-without
cp -R .eval-runs/*-baseline-with .eval-runs/*-baseline-without kit/catchup/cost-coder/baseline/
```

Commit the two run folders. `pnpm workshop catchup <9 or later>` copies them into `.eval-runs/`. Each `results.json` keeps the agent's patch per task, so `agent-evals regrade` and `agent-evals label` work without the original workspaces. Command rules (`ctx.run`) need a fresh run.
