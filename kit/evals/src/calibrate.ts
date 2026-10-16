import type { RunResult } from "./types.ts";

export interface HumanLabel {
  id: string;
  pass: boolean;
  note?: string;
}

export interface Calibration {
  grader: string;
  n: number;
  agreement: number;
  /** Cohen's kappa — agreement corrected for chance. >0.6 is decent, >0.8 is strong. */
  kappa: number;
  truePass: number;
  trueFail: number;
  /** Judge said PASS, human said FAIL — the dangerous direction: the judge is too lenient. */
  falsePass: number;
  /** Judge said FAIL, human said PASS — the judge is too strict. */
  falseFail: number;
  disagreements: { id: string; human: boolean; judge: boolean; judgeReason?: string; humanNote?: string }[];
  unlabeled: string[];
}

/** Compare one grader's verdicts in a run against human labels (first trial of each case). */
export function calibrate(run: RunResult, grader: string, labels: HumanLabel[]): Calibration {
  const verdicts = new Map<string, { pass: boolean; reason?: string }>();
  for (const r of run.runs) {
    if (r.trial !== 1) continue;
    const g = r.grades.find((x) => x.name === grader);
    if (g) verdicts.set(r.caseId, { pass: g.pass, reason: g.reason });
  }
  if (verdicts.size === 0) throw new Error(`grader "${grader}" not found in run. Available: ${[...new Set(run.runs.flatMap((r) => r.grades.map((g) => g.name)))].join(", ")}`);

  let tp = 0, tf = 0, fp = 0, ff = 0;
  const disagreements: Calibration["disagreements"] = [];
  const labelled = new Set<string>();
  for (const l of labels) {
    const v = verdicts.get(l.id);
    if (!v) continue;
    labelled.add(l.id);
    if (l.pass && v.pass) tp++;
    else if (!l.pass && !v.pass) tf++;
    else if (!l.pass && v.pass) fp++;
    else ff++;
    if (l.pass !== v.pass) disagreements.push({ id: l.id, human: l.pass, judge: v.pass, judgeReason: v.reason, humanNote: l.note });
  }
  const n = tp + tf + fp + ff;
  const po = n ? (tp + tf) / n : 0;
  const pYes = n ? ((tp + fp) / n) * ((tp + ff) / n) : 0;
  const pNo = n ? ((tf + ff) / n) * ((tf + fp) / n) : 0;
  const pe = pYes + pNo;
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return {
    grader,
    n,
    agreement: po,
    kappa,
    truePass: tp,
    trueFail: tf,
    falsePass: fp,
    falseFail: ff,
    disagreements,
    unlabeled: [...verdicts.keys()].filter((k) => !labelled.has(k)),
  };
}

export function calibrationMarkdown(c: Calibration): string {
  const lines = [
    `## Calibration: ${c.grader}`,
    "",
    `Agreement **${(c.agreement * 100).toFixed(1)}%** on ${c.n} labelled cases · Cohen's κ **${c.kappa.toFixed(2)}**`,
    "",
    "|  | Human PASS | Human FAIL |",
    "|---|---|---|",
    `| **Judge PASS** | ${c.truePass} | ${c.falsePass} ⚠️ too lenient |`,
    `| **Judge FAIL** | ${c.falseFail} too strict | ${c.trueFail} |`,
  ];
  if (c.disagreements.length) {
    lines.push("", "### Disagreements — read these, then fix the rubric (or your label)", "");
    for (const d of c.disagreements)
      lines.push(`- \`${d.id}\` human=${d.human ? "PASS" : "FAIL"} judge=${d.judge ? "PASS" : "FAIL"}${d.humanNote ? ` · you: ${d.humanNote}` : ""}\n  > ${(d.judgeReason ?? "").replace(/\n/g, " ")}`);
  }
  if (c.unlabeled.length) lines.push("", `${c.unlabeled.length} judged cases have no human label.`);
  return lines.join("\n") + "\n";
}
