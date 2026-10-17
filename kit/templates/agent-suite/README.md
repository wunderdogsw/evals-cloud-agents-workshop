# evals/suites/agent/

The agent evals for this repository: how well a coding agent follows the rules in its instruction files.

- `rules.mjs` — code graders, one per code-checkable rule (`rule:<name>`).
- `rubric-<rule>.md` — one rubric per judgement rule, graded by an LLM judge (`judge:<rule>`).
- `agent-suite.json` — which rules and rubrics the CI gate uses, the threshold per grader, and the agent files the recording tracks.
- `last-run.json` — the recorded run CI verifies. Never edit it by hand.

The agent never sees this folder: the workshop kit removes it from every task workspace.

Record a run (from the workshop control room, with your own Claude Code or Cursor login):

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent claude --record targets/<name>/evals/suites/agent
```

CI runs `pnpm verify suites/agent` in `evals/`: no model and no secrets. It fails when a tracked agent file, a rule, a rubric or the threshold changed since the recording, or when the recording missed the threshold.
