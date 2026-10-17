# Phase 10 — Write the judge rubric

## What you do

1. **Write the rubric** — one `rubric-<rule>.md` per picked judge rule, with PASS and FAIL criteria and one example each.
2. **Label blind** — `pnpm agent-evals label` on both baseline runs: PASS or FAIL per diff, by hand, before any judge runs.

## Gate

- [ ] A committed rubric per picked judge rule, each with a PASS and a FAIL example.
- [ ] At least 15 labels in total, at least 5 per judge rule, made before any judge ran.

## Learning point

If you can't label it consistently yourself, a judge can't either. Labelling first shows where the rubric is vague.

## Wanted outcome

A rubric per judgement rule and a labelled set of baseline diffs to calibrate the judge against in Phase 11.

---

## 10.1 Write the rubric

### [LLM]

> Narrate: "Some rules need reading, not grepping. A judge model can read, but only as well as your rubric tells it what to look for."

Explain the shape of a good rubric, from the judge's system prompt in `kit/evals/src/judge.ts`: the judge decides PASS or FAIL from the rubric alone, reasons first, and fails when the rubric is ambiguous. So a rubric needs:

- the rule in one line;
- what PASS means, with one concrete example from this repo;
- what FAIL means, with one concrete example;
- what to do when the change doesn't touch the rule (usually PASS).

Optional frontmatter `---\ntasks: a, b\n---` limits the judge to some tasks. Keep it off for now: labelling every diff gives more labels.

### [HUMAN]

For each picked **judge** rule, they write `targets/<name>/evals/suites/agent/rubric-<rule>.md` themselves, for example `rubric-r5.md`. The examples come from their code or the Phase 8 diffs, not from a generic style guide.

Review one rubric by asking: would two colleagues reading it reach the same verdict on the worst diff in `agent-notes.md`? If not, which sentence would they argue about?

Then they commit the rubrics:

```bash
git -C targets/<name> add evals/suites/agent
git -C targets/<name> commit -m "workshop: judge rubrics"
```

### [BRANCH]

- **Target is `sample`** → judge rules are R5 (comma parsing at the edges) and R6 (no I/O in `classify.ts`). Compare with `kit/catchup/cost-coder/agent-suite/` only after theirs are written.

## 10.2 Label blind

### [LLM]

Explain the order: labels come **before** the judge, so the judge's verdict can't anchor theirs. The labeller shows each task prompt and the agent's diff, never a judge verdict. Labels for both runs share one file per rule, with ids `baseline-with/<task>` and `baseline-without/<task>`.

Hand them the command for each judge rule, to run in their own terminal (it's interactive):

```bash
pnpm agent-evals label baseline-with baseline-without \
  --out .workshop/targets/<name>/labels-r5.jsonl --rule "R5: commas parsed at the edges"
```

`p` or `f`, optionally with a note after a space; `s` skips, `q` quits and keeps what's done.

### [HUMAN]

They label every diff for every judge rule, with a note on each FAIL and on every case they hesitated over. When a label is hard to decide, they first sharpen the rubric so it decides, then label.

## 10.3 Gate check

The participant confirms, and you verify:

- [ ] A committed rubric per picked judge rule, each with a PASS and a FAIL example. — `ls targets/<name>/evals/suites/agent/rubric-*.md` against the judge rows in `expectations.md`, and `git -C targets/<name> status --short` is clean
- [ ] At least 15 labels in total, at least 5 per judge rule, made before any judge ran. — `wc -l .workshop/targets/<name>/labels-*.jsonl`, and `ls .eval-runs` shows no `judged` run yet

---

## Phase Complete

Mark Phase 10 complete. Preview: "Phase 11 — run the judge on the diffs you labelled, read every disagreement, and fix the rubric or your label."
