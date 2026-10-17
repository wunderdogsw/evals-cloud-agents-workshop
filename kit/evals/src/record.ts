import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { toJUnit } from "./report.ts";
import type { CaseRun, RunResult, RunSummary } from "./types.ts";

/**
 * Record & verify: the eval gate for teams that can't call a model from CI.
 *
 * Locally (with your Claude Code or Cursor login):  evals run suite.ts --record
 *   → writes <suite dir>/last-run.json: the results plus a SHA-256 of every file that defines the
 *     experiment — the suite folder (cases, rubric, suite.ts with its threshold) and the `tracks` files
 *     (the feature's prompt/code).
 * In CI (no model, no secrets):  evals verify suite.ts
 *   → fails if any of those files changed since the recording ("stale"), if the recording was a mock
 *     or partial run, or if the recorded results don't meet the threshold.
 *
 * Trust model: CI checks that *someone* ran the full suite on exactly this code and that it passed.
 * It cannot prove the file wasn't hand-edited — review last-run.json diffs like any other code.
 */
export const RECORDING_FILE = "last-run.json";
/** Files in the suite folder that don't affect results. */
const IGNORED_IN_SUITE = new Set([RECORDING_FILE, "CHANGELOG.md", "labels.jsonl", "README.md"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".eval-runs", "dist", "bin", "obj"]);

export interface Recording {
  version: 1;
  suite: string;
  recordedAt: string;
  provider: string;
  models: Record<string, string>;
  /** Paths (relative to the suite folder) the suite declared in `tracks`. */
  tracks: string[];
  /** path (relative to the suite folder, "/"-separated) → sha256 */
  files: Record<string, string>;
  summary: RunSummary;
  cases: Pick<CaseRun, "caseId" | "trial" | "tags" | "pass" | "grades" | "error" | "durationMs">[];
}

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const posix = (p: string) => p.split(sep).join("/");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile()) acc.push(p);
  }
  return acc;
}

/** Hash the suite folder plus every tracked file/directory. Missing tracked paths are an error. */
export function fingerprint(suiteDir: string, tracks: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of walk(suiteDir)) {
    const rel = posix(relative(suiteDir, f));
    if (!IGNORED_IN_SUITE.has(rel)) out[rel] = sha(f);
  }
  for (const t of tracks) {
    const abs = resolve(suiteDir, t);
    if (!existsSync(abs)) throw new Error(`tracked path not found: ${t} (relative to ${suiteDir})`);
    const files = statSync(abs).isDirectory() ? walk(abs) : [abs];
    for (const f of files) out[posix(relative(suiteDir, f))] = sha(f);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function writeRecording(suiteDir: string, result: RunResult, meta: { provider: string; models: Record<string, string>; tracks: string[] }): string {
  const rec: Recording = {
    version: 1,
    suite: result.summary.suite,
    recordedAt: new Date().toISOString(),
    provider: meta.provider,
    models: meta.models,
    tracks: meta.tracks,
    files: fingerprint(suiteDir, meta.tracks),
    summary: result.summary,
    cases: result.runs.map(({ caseId, trial, tags, pass, grades, error, durationMs }) => ({ caseId, trial, tags, pass, grades, error, durationMs })),
  };
  const p = join(suiteDir, RECORDING_FILE);
  writeFileSync(p, JSON.stringify(rec, null, 2) + "\n");
  return p;
}

export interface Verification {
  ok: boolean;
  problems: string[];
  changed: string[];
  added: string[];
  removed: string[];
  recording?: Recording;
}

export function verifyRecording(suiteDir: string): Verification {
  const p = join(suiteDir, RECORDING_FILE);
  if (!existsSync(p)) {
    return { ok: false, problems: [`no ${RECORDING_FILE} in ${suiteDir} — run the suite locally with --record and commit the file`], changed: [], added: [], removed: [] };
  }
  const rec = JSON.parse(readFileSync(p, "utf8")) as Recording;
  const problems: string[] = [];
  let now: Record<string, string> = {};
  try {
    now = fingerprint(suiteDir, rec.tracks ?? []);
  } catch (e) {
    problems.push((e as Error).message);
  }
  const changed = Object.keys(rec.files).filter((f) => f in now && now[f] !== rec.files[f]);
  const removed = Object.keys(rec.files).filter((f) => !(f in now));
  const added = Object.keys(now).filter((f) => !(f in rec.files));
  if (changed.length || removed.length || added.length) problems.push("stale: files changed since the recorded run — re-run with --record and commit");
  if (rec.provider === "mock") problems.push("the recorded run used EVALS_MOCK — record with a real model");
  if (rec.summary.errors > 0) problems.push(`${rec.summary.errors} case(s) errored in the recorded run`);
  if (rec.summary.thresholdMet === false) problems.push(`threshold not met: ${rec.summary.thresholdFailures?.join("; ")}`);
  if (!rec.summary.threshold) problems.push("the suite has no threshold — nothing to gate on");
  return { ok: problems.length === 0, problems, changed, added, removed, recording: rec };
}

export function verificationMarkdown(v: Verification): string {
  const r = v.recording;
  const lines = [`## Eval gate: ${r?.suite ?? "?"} — ${v.ok ? "✅ pass" : "❌ fail"}`, ""];
  if (r) {
    lines.push(
      `Recorded ${r.recordedAt} with **${r.provider}** (${Object.entries(r.models).map(([k, m]) => `${k}: ${m}`).join(", ")}) · pass rate **${(r.summary.passRate * 100).toFixed(1)}%** on ${r.summary.cases} cases`,
      "",
    );
  }
  for (const p of v.problems) lines.push(`- ${p}`);
  const list = (title: string, xs: string[]) => xs.length && lines.push("", `**${title}:** ${xs.map((x) => `\`${x}\``).join(", ")}`);
  list("Changed", v.changed);
  list("Added", v.added);
  list("Removed", v.removed);
  return lines.join("\n") + "\n";
}

/** JUnit from the recorded cases, so GitLab/GitHub show per-case results without re-running anything. */
export function recordingJUnit(rec: Recording): string {
  return toJUnit({ summary: rec.summary, runs: rec.cases.map((c) => ({ ...c, input: undefined, costUsd: 0 })) });
}
