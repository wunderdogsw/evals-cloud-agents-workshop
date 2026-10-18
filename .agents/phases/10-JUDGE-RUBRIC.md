# Phase 10 — Write the judge rubric

## What you do

1. **Write the rubric** — write one `rubric-<rule>.md` for each picked judge rule, with PASS and FAIL criteria and one example of each.
2. **Label blind** — run `pnpm agent-evals label` on both baseline runs and mark each diff PASS or FAIL by hand, before any judge runs.

## Gate

- [ ] A committed rubric per picked judge rule, each with a PASS and a FAIL example.
- [ ] At least 15 labels in total, at least 5 per judge rule, made before any judge ran.

## Learning point

If you can't label a rule the same way each time, a judge can't either. When you label first, you find the parts of the rubric that are unclear.

## Wanted outcome

You have a rubric for each judge rule and a set of labelled baseline diffs, and in Phase 11 you check the judge against these labels.

---

## 10.1 Write the rubric

### [LLM]

> Narrate: "Some rules need someone to read the code. Searching for text is not enough. A judge model can read the code, but it only knows what to look for if your rubric tells it."

A judge is a model that reads a code change and decides PASS or FAIL for one rule. A rubric is the written instructions it decides from. Explain what a good rubric contains, based on the judge's system prompt in `kit/evals/src/judge.ts`. The judge decides PASS or FAIL from the rubric only. It writes its reasoning before its verdict. It gives FAIL when the rubric is unclear. So a rubric needs:

- the rule in one line;
- what PASS means, with one concrete example from this repo;
- what FAIL means, with one concrete example;
- what to do when the change has nothing to do with the rule (usually PASS).

You can add frontmatter (a header block at the top of the file), `---\ntasks: a, b\n---`, to limit the judge to some tasks. Leave it out for now: if they label every diff, they get more labels.

### [HUMAN]

For each picked **judge** rule, they write `targets/<name>/evals/suites/agent/rubric-<rule>.md` themselves, for example `rubric-r5.md`. The examples come from their own code or from the Phase 8 diffs, not from a general style guide.

Review one rubric with them. Ask: if two colleagues read it, would they give the same verdict on the worst diff in `agent-notes.md`? If not, which sentence would they disagree about?

Then they commit the rubrics:

```bash
git -C targets/<name> add evals/suites/agent
git -C targets/<name> commit -m "workshop: judge rubrics"
```

### [BRANCH]

- **Target is `sample`** → the judge rules are R5 (comma parsing at the edges) and R6 (no I/O in `classify.ts`). Compare with `kit/catchup/cost-coder/agent-suite/` only after they have written their own.

## 10.2 Label blind

### [LLM]

Blind labelling means you decide PASS or FAIL yourself without seeing what the judge said. Explain the order: they label **before** the judge runs, so the judge's verdict can't influence their labels. The labelling tool shows each task prompt and the agent's diff. It never shows a judge verdict. Labels for both runs go into one file per rule, with ids `baseline-with/<task>` and `baseline-without/<task>`.

Give them the command for each judge rule. They run it in their own terminal, because it asks for input:

```bash
pnpm agent-evals label baseline-with baseline-without \
  --out .workshop/targets/<name>/labels-r5.jsonl --rule "R5: commas parsed at the edges"
```

Press `p` or `f`, and optionally add a note after a space. `s` skips a diff. `q` quits and keeps the labels made so far.

### [HUMAN]

They label every diff for every judge rule. They add a note to each FAIL and to every case they were unsure about. When they can't decide a label, they first make the rubric more precise so that it decides the case. Then they label it.

## 10.3 Gate check

The participant confirms each item, and you verify it:

- [ ] A committed rubric per picked judge rule, each with a PASS and a FAIL example. — `ls targets/<name>/evals/suites/agent/rubric-*.md` against the judge rows in `expectations.md`, and `git -C targets/<name> status --short` is clean
- [ ] At least 15 labels in total, at least 5 per judge rule, made before any judge ran. — `wc -l .workshop/targets/<name>/labels-*.jsonl`, and `ls .eval-runs` shows no `judged` run yet

---

## Phase Complete

Mark Phase 10 complete. Preview: "Phase 11 — run the judge on the diffs you labelled, read every case where it disagrees with you, and fix the rubric or your label."
