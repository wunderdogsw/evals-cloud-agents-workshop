import type { RunResult } from "./types.ts";

export interface CaseDiff {
  caseId: string;
  before: number; // fraction of trials passing
  after: number;
}

export interface Comparison {
  before: { label?: string; passRate: number };
  after: { label?: string; passRate: number };
  graders: { name: string; before: number; after: number; delta: number }[];
  regressions: CaseDiff[];
  fixes: CaseDiff[];
  onlyBefore: string[];
  onlyAfter: string[];
  costBefore: number;
  costAfter: number;
}

function byCase(r: RunResult): Map<string, number> {
  const m = new Map<string, { pass: number; n: number }>();
  for (const run of r.runs) {
    const v = m.get(run.caseId) ?? { pass: 0, n: 0 };
    v.n++;
    if (run.pass) v.pass++;
    m.set(run.caseId, v);
  }
  return new Map([...m].map(([k, v]) => [k, v.pass / v.n]));
}

/**
 * A regression is a case that passed (in a majority of trials) before and fails now.
 * This is the number to look at — an aggregate score can rise while important cases break.
 */
export function compareRuns(before: RunResult, after: RunResult): Comparison {
  const a = byCase(before);
  const b = byCase(after);
  const regressions: CaseDiff[] = [];
  const fixes: CaseDiff[] = [];
  for (const [id, pb] of a) {
    const pa = b.get(id);
    if (pa === undefined) continue;
    if (pb >= 0.5 && pa < 0.5) regressions.push({ caseId: id, before: pb, after: pa });
    if (pb < 0.5 && pa >= 0.5) fixes.push({ caseId: id, before: pb, after: pa });
  }
  const names = [...new Set([...before.summary.graders, ...after.summary.graders].map((g) => g.name))];
  return {
    before: { label: before.summary.label, passRate: before.summary.passRate },
    after: { label: after.summary.label, passRate: after.summary.passRate },
    graders: names.map((n) => {
      const x = before.summary.graders.find((g) => g.name === n)?.meanScore ?? NaN;
      const y = after.summary.graders.find((g) => g.name === n)?.meanScore ?? NaN;
      return { name: n, before: x, after: y, delta: y - x };
    }),
    regressions,
    fixes,
    onlyBefore: [...a.keys()].filter((k) => !b.has(k)),
    onlyAfter: [...b.keys()].filter((k) => !a.has(k)),
    costBefore: before.summary.totalCostUsd,
    costAfter: after.summary.totalCostUsd,
  };
}

export function comparisonMarkdown(c: Comparison): string {
  const p = (n: number) => (Number.isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`);
  const d = (n: number) => (Number.isNaN(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(3)}`);
  const lines = [
    `## Compare: ${c.before.label ?? "before"} → ${c.after.label ?? "after"}`,
    "",
    `Pass rate ${p(c.before.passRate)} → ${p(c.after.passRate)} · cost $${c.costBefore.toFixed(4)} → $${c.costAfter.toFixed(4)}`,
    "",
    "| Grader | Before | After | Δ |",
    "|---|---|---|---|",
    ...c.graders.map((g) => `| ${g.name} | ${g.before.toFixed?.(3) ?? "—"} | ${g.after.toFixed?.(3) ?? "—"} | ${d(g.delta)} |`),
    "",
    c.regressions.length ? `### ❌ Regressions (${c.regressions.length})` : "### ✅ No regressions",
    ...c.regressions.map((r) => `- \`${r.caseId}\` ${p(r.before)} → ${p(r.after)}`),
    "",
    `### Fixed (${c.fixes.length})`,
    ...c.fixes.map((r) => `- \`${r.caseId}\` ${p(r.before)} → ${p(r.after)}`),
  ];
  if (c.onlyBefore.length || c.onlyAfter.length)
    lines.push("", `Datasets differ — only before: ${c.onlyBefore.length}, only after: ${c.onlyAfter.length}. Compare on the same dataset for a fair read.`);
  return lines.join("\n") + "\n";
}
