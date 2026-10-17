#!/usr/bin/env -S npx tsx
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { calibrate, calibrationMarkdown, type HumanLabel } from "./calibrate.ts";
import { compareRuns, comparisonMarkdown } from "./compare.ts";
import { parseJsonl } from "./dataset.ts";
import { toMarkdown, writeRun } from "./report.ts";
import { isMock, resolveProvider } from "./llm.ts";
import { model } from "./models.ts";
import { recordingJUnit, verificationMarkdown, verifyRecording, writeRecording } from "./record.ts";
import { runSuite } from "./runner.ts";
import type { RunResult, Suite } from "./types.ts";

const HELP = `evals — tiny eval runner

  evals run <suite.ts> [--out .eval-runs] [--tag t1,t2] [--id a,b] [--limit n]
                       [--trials n] [--concurrency n] [--label name] [--threshold]
                       [--regrade <run>]     re-grade that run's outputs (no task calls)
                       [--record]            full run → <suite dir>/last-run.json, to commit (CI gate)
  evals verify <suite.ts> [--junit file]      CI gate without a model: recording fresh + threshold met
  evals compare <before> <after> [--fail-on-regression]
  evals label <run> [--out labels.jsonl] [--grader judge]     interactive PASS/FAIL labelling
  evals calibrate <run> --labels labels.jsonl [--grader judge]

<run>/<before>/<after> may be a results.json, a run directory, "latest" / "latest~1", or a run label.
Model calls: EVALS_PROVIDER=claude-code (your Claude Code login) | cursor (Cursor CLI login) | api.
Set EVALS_MOCK=1 to run with offline fakes (no model calls).`;

/** Load every .env from cwd up to / — nearest first; loadEnvFile never overrides values already set. */
function loadDotEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const p = join(dir, ".env");
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {}
    }
    const up = dirname(dir);
    if (up === dir) return;
    dir = up;
  }
}

function runDirs(outDir: string): string[] {
  if (!existsSync(outDir)) return [];
  return readdirSync(outDir)
    .map((d) => join(outDir, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "results.json")))
    .sort();
}

async function loadRun(ref: string, outDir: string): Promise<RunResult> {
  let path = ref;
  const m = /^latest(?:~(\d+))?$/.exec(ref);
  if (m) {
    const dirs = runDirs(outDir);
    const d = dirs[dirs.length - 1 - Number(m[1] ?? 0)];
    if (!d) throw new Error(`no run "${ref}" in ${outDir}`);
    path = d;
  }
  if (!m && !existsSync(path)) {
    // Treat it as a run label: newest run whose directory ends with "-<label>".
    const safe = ref.replace(/[^\w.-]+/g, "_");
    const hit = runDirs(outDir).filter((d) => d.endsWith(`-${safe}`)).pop();
    if (!hit) throw new Error(`no run "${ref}" — not a path, "latest[~n]", or a label in ${outDir}`);
    path = hit;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "results.json");
  return JSON.parse(await readFile(path, "utf8")) as RunResult;
}

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

async function main() {
  loadDotEnv();
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      tag: { type: "string" },
      id: { type: "string" },
      limit: { type: "string" },
      trials: { type: "string" },
      concurrency: { type: "string" },
      label: { type: "string" },
      threshold: { type: "boolean", default: false },
      regrade: { type: "string" },
      record: { type: "boolean", default: false },
      junit: { type: "string" },
      "fail-on-regression": { type: "boolean", default: false },
      labels: { type: "string" },
      grader: { type: "string", default: "judge" },
      help: { type: "boolean", short: "h" },
    },
  });
  const outDir = resolve(values.out && cmd === "run" ? values.out : process.env.EVALS_OUT ?? ".eval-runs");

  if (!cmd || values.help || cmd === "help") return console.log(HELP);

  if (cmd === "run") {
    const file = positionals[0];
    if (!file) throw new Error("usage: evals run <suite.ts>");
    const abs = resolve(file);
    const mod = await import(pathToFileURL(abs).href);
    const suite: Suite = mod.default ?? mod.suite;
    if (!suite?.task) throw new Error(`${file} must export default defineSuite({...})`);
    if (values.record) {
      if (values.tag || values.id || values.limit || values.regrade) throw new Error("--record needs a full run: drop --tag/--id/--limit/--regrade");
      if (isMock()) throw new Error("--record with EVALS_MOCK would gate on fake results — unset EVALS_MOCK");
    }
    let done = 0;
    let reuseOutputs: Map<string, { output?: unknown; error?: string }> | undefined;
    if (values.regrade) {
      const src = await loadRun(values.regrade, outDir);
      reuseOutputs = new Map(src.runs.map((r) => [`${r.caseId}#${r.trial}`, { output: r.output, error: r.error }]));
      process.stderr.write(`re-grading ${reuseOutputs.size} outputs from ${src.summary.label ?? src.summary.startedAt}\n`);
    }
    const result = await runSuite(suite, {
      reuseOutputs,
      baseDir: dirname(abs),
      tags: list(values.tag),
      ids: list(values.id),
      limit: values.limit ? Number(values.limit) : undefined,
      trials: values.trials ? Number(values.trials) : undefined,
      concurrency: values.concurrency ? Number(values.concurrency) : undefined,
      label: values.label,
      onCase: (r) => {
        done++;
        process.stderr.write(`${r.pass ? "✓" : r.error ? "!" : "✗"} ${r.caseId}${r.trial > 1 ? `#${r.trial}` : ""}  (${done})\n`);
      },
    });
    const dir = await writeRun(result, outDir);
    console.log(toMarkdown(result));
    console.log(`→ ${dir}`);
    if (values.record) {
      const provider = process.env.EVALS_PROVIDER ?? (() => { try { return resolveProvider(); } catch { return "custom"; } })();
      const p = writeRecording(dirname(abs), result, { provider, models: { task: model("task"), judge: model("judge") }, tracks: suite.tracks ?? [] });
      console.log(`→ recorded ${p} — commit it with your change`);
    }
    if (values.threshold && result.summary.thresholdMet === false) process.exitCode = 1;
    return;
  }

  if (cmd === "verify") {
    const file = positionals[0];
    if (!file) throw new Error("usage: evals verify <suite.ts | suite dir>");
    const abs = resolve(file);
    const dir = existsSync(abs) && statSync(abs).isDirectory() ? abs : dirname(abs);
    const v = verifyRecording(dir);
    console.log(verificationMarkdown(v));
    if (values.junit && v.recording) await writeFile(values.junit, recordingJUnit(v.recording));
    if (!v.ok) process.exitCode = 1;
    return;
  }

  if (cmd === "compare") {
    const [a, b] = positionals.length >= 2 ? positionals : ["latest~1", "latest"];
    const c = compareRuns(await loadRun(a!, outDir), await loadRun(b!, outDir));
    console.log(comparisonMarkdown(c));
    if (values["fail-on-regression"] && c.regressions.length) process.exitCode = 1;
    return;
  }

  if (cmd === "calibrate") {
    if (!values.labels) throw new Error("usage: evals calibrate <run> --labels labels.jsonl");
    const run = await loadRun(positionals[0] ?? "latest", outDir);
    const labels = parseJsonl<HumanLabel>(await readFile(values.labels, "utf8"), values.labels);
    console.log(calibrationMarkdown(calibrate(run, values.grader!, labels)));
    return;
  }

  if (cmd === "label") {
    const run = await loadRun(positionals[0] ?? "latest", outDir);
    const out = values.out ?? "labels.jsonl";
    const existing = existsSync(out) ? parseJsonl<HumanLabel>(await readFile(out, "utf8")) : [];
    const done = new Set(existing.map((l) => l.id));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(`Label each output PASS (p) or FAIL (f). Optional note after a space: "f wrong code for rental". s = skip, q = quit.\nThe judge's verdict is hidden on purpose.\n`);
    const labels = [...existing];
    for (const r of run.runs.filter((x) => x.trial === 1 && !done.has(x.caseId))) {
      console.log(`─── ${r.caseId} ${r.tags.length ? `[${r.tags.join(", ")}]` : ""}`);
      console.log(`input:    ${JSON.stringify(r.input)}`);
      if (r.expected !== undefined) console.log(`expected: ${JSON.stringify(r.expected)}`);
      console.log(`output:   ${r.error ? "ERROR " + r.error : JSON.stringify(r.output, null, 2)}`);
      const ans = (await rl.question("p/f/s/q > ")).trim();
      if (ans === "q") break;
      if (!ans || ans === "s") continue;
      const [v, ...note] = ans.split(" ");
      labels.push({ id: r.caseId, pass: v!.toLowerCase().startsWith("p"), ...(note.length ? { note: note.join(" ") } : {}) });
      await writeFile(out, labels.map((l) => JSON.stringify(l)).join("\n") + "\n");
    }
    rl.close();
    console.log(`\n${labels.length} labels in ${out}. Next: pnpm calibrate latest --labels ${out} --grader ${values.grader}`);
    return;
  }

  throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
}

main().catch((e) => {
  console.error(`evals: ${(e as Error).message}`);
  process.exit(2);
});
