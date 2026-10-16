import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunResult } from "./types.ts";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toMarkdown(r: RunResult, maxFailures = 15): string {
  const s = r.summary;
  const lines = [
    `## Eval: ${s.suite}${s.label ? ` (${s.label})` : ""}`,
    "",
    `**Pass rate:** ${pct(s.passRate)} · **Cases:** ${s.cases}${s.trials > 1 ? ` × ${s.trials} trials` : ""} · **Errors:** ${s.errors} · **Cost:** $${s.totalCostUsd.toFixed(4)}`,
  ];
  if (s.threshold) lines.push("", s.thresholdMet ? "✅ Threshold met" : `❌ Threshold not met — ${s.thresholdFailures?.join("; ")}`);
  lines.push("", "| Grader | Mean score | Pass rate |", "|---|---|---|");
  for (const g of s.graders) lines.push(`| ${g.name} | ${g.meanScore.toFixed(3)} | ${pct(g.passRate)} |`);
  const tags = Object.entries(s.byTag);
  if (tags.length) {
    lines.push("", "| Tag | Cases | Pass rate |", "|---|---|---|");
    for (const [t, v] of tags.sort()) lines.push(`| ${t} | ${v.cases} | ${pct(v.passRate)} |`);
  }
  const failed = r.runs.filter((x) => !x.pass);
  if (failed.length) {
    lines.push("", `### Failures (${failed.length})`, "");
    for (const f of failed.slice(0, maxFailures)) {
      const why = f.error ? `error: ${f.error}` : f.grades.filter((g) => !g.pass).map((g) => `${g.name}: ${g.reason ?? "fail"}`).join(" · ");
      lines.push(`- \`${f.caseId}\`${f.trial > 1 ? ` (trial ${f.trial})` : ""} — ${why}`);
    }
    if (failed.length > maxFailures) lines.push(`- …and ${failed.length - maxFailures} more (see results.json)`);
  }
  return lines.join("\n") + "\n";
}

/** JUnit XML: GitLab shows it in the MR widget, GitHub via a test-reporter action. One testcase per case×trial. */
export function toJUnit(r: RunResult): string {
  const s = r.summary;
  const failures = r.runs.filter((x) => !x.pass && !x.error).length;
  const cases = r.runs.map((x) => {
    const name = esc(x.trial > 1 ? `${x.caseId} #${x.trial}` : x.caseId);
    const time = (x.durationMs / 1000).toFixed(3);
    if (x.error) return `    <testcase classname="${esc(s.suite)}" name="${name}" time="${time}"><error message="${esc(x.error)}"/></testcase>`;
    if (!x.pass) {
      const msg = x.grades.filter((g) => !g.pass).map((g) => `${g.name}: ${g.reason ?? "fail"}`).join(" | ");
      return `    <testcase classname="${esc(s.suite)}" name="${name}" time="${time}"><failure message="${esc(msg)}"/></testcase>`;
    }
    return `    <testcase classname="${esc(s.suite)}" name="${name}" time="${time}"/>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<testsuites>`,
    `  <testsuite name="${esc(s.suite)}" tests="${r.runs.length}" failures="${failures}" errors="${s.errors}">`,
    ...cases,
    `  </testsuite>`,
    `</testsuites>`,
    "",
  ].join("\n");
}

export async function writeRun(r: RunResult, outDir: string): Promise<string> {
  const stamp = r.summary.startedAt.replace(/[:.]/g, "-");
  const dir = join(outDir, `${stamp}-${r.summary.suite}${r.summary.label ? "-" + r.summary.label.replace(/[^\w.-]+/g, "_") : ""}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "results.json"), JSON.stringify(r, null, 2));
  await writeFile(join(dir, "summary.md"), toMarkdown(r));
  await writeFile(join(dir, "junit.xml"), toJUnit(r));
  return dir;
}
