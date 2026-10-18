/**
 * Eval for the build-phase skill (.claude/skills/build-phase).
 *
 *   pnpm eval:build-phase [--agent claude|cursor] [--case <id>] [--model <id>]
 *                         [--max-budget-usd 3] [--timeout-min 20] [--keep]
 *
 * For each case in .claude/skills/build-phase/evals/cases.jsonl:
 *   1. copy the workshop repo (tracked + untracked, not ignored files) into a throwaway git repo,
 *      so uncommitted edits to the skill are what gets evaluated;
 *   2. run the agent headless on the case's request;
 *   3. grade the result with the phase linter (lint-phases.ts) and a few checks on what changed.
 *
 * Claude Code runs as `claude -p "/build-phase …"` (user-invoked skills expand in -p mode,
 * https://code.claude.com/docs/en/headless). Cursor CLI gets the skill file as instructions.
 * Results go to .workshop/skill-evals/build-phase/<timestamp>.json. Exit code 1 if any case fails.
 * This spends model budget on your own login: --max-budget-usd caps each Claude run.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { sh, spawnArgs } from "../../kit/agent-evals/src/sh.ts";
import { model as defaultModel } from "../../kit/evals/src/models.ts";
import { type DocResult, lintPhaseDoc, lintRepo, parsePhaseMap } from "./lint-phases.ts";

export interface EvalCase {
  id: string;
  /** Text passed to the skill, as a user would type it after /build-phase. */
  request: string;
  /** "build": the skill must produce a valid phase doc. "refuse": out of scope, nothing may change. */
  expect: "build" | "refuse";
  /** Phase number the built document must have. */
  phase?: number;
}

export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface CaseContext {
  changed: string[];
  docs: DocResult[];
  repoErrors: string[];
  /** Tool calls the agent made; null when the agent's output does not expose them (Cursor). */
  uses: ToolUse[] | null;
}

export interface Check {
  name: string;
  pass: boolean | null;
  detail: string;
}

/** Files the skill may change. Anything else means it went outside "build phase docs". */
const ALLOWED = [/^\.agents\/phases\/[^/]+\.md$/, /^AGENTS\.md$/, /^\.agents\/PLAN\.md$/, /^\.agents\/assets\/workshop\.ts$/];

export function outsideAllowed(files: string[]): string[] {
  return files.filter((f) => !ALLOWED.some((r) => r.test(f)));
}

/** Tool calls from Claude Code `--output-format stream-json --verbose` output. */
export function toolUses(stream: string): ToolUse[] {
  const uses: ToolUse[] = [];
  for (const line of stream.split("\n")) {
    if (!line.startsWith("{")) continue;
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev.type !== "assistant" || !Array.isArray(ev.message?.content)) continue;
    for (const c of ev.message.content) if (c?.type === "tool_use") uses.push({ name: c.name, input: c.input ?? {} });
  }
  return uses;
}

export function resultEvent(stream: string): any {
  const lines = stream.trim().split("\n").reverse();
  for (const l of lines) {
    try {
      const ev = JSON.parse(l);
      if (ev.type === "result") return ev;
    } catch {}
  }
  return {};
}

export function fetchedClaudeDocs(uses: ToolUse[]): boolean {
  return uses.some((u) => u.name === "WebFetch" && /code\.claude\.com\/docs/.test(String(u.input.url ?? "")));
}

export function gradeCase(c: EvalCase, ctx: CaseContext): Check[] {
  const checks: Check[] = [];
  if (c.expect === "refuse") {
    checks.push({
      name: "no-changes",
      pass: ctx.changed.length === 0,
      detail: ctx.changed.length ? `changed: ${ctx.changed.join(", ")}` : "nothing changed",
    });
    return checks;
  }

  const doc = ctx.docs.find((d) => d.phase === c.phase);
  if (!doc) checks.push({ name: "phase-doc", pass: false, detail: `no document for phase ${c.phase}` });
  else if (doc.legacy) checks.push({ name: "phase-doc", pass: false, detail: `${doc.file} is still in the old format` });
  else
    checks.push({
      name: "phase-doc",
      pass: doc.errors.length === 0,
      detail: doc.errors.length ? `${doc.file}: ${doc.errors.join("; ")}` : doc.file,
    });

  checks.push({
    name: "phase-map",
    pass: ctx.repoErrors.length === 0,
    detail: ctx.repoErrors.length ? ctx.repoErrors.join("; ") : "phase map, progress.json and workshop.ts agree",
  });

  const outside = outsideAllowed(ctx.changed);
  checks.push({
    name: "stays-in-scope",
    pass: outside.length === 0,
    detail: outside.length ? `changed outside phase files: ${outside.join(", ")}` : `${ctx.changed.length} allowed files changed`,
  });

  const commands = doc && !doc.legacy ? doc.commands : [];
  if (commands.length === 0) checks.push({ name: "docs-checked", pass: true, detail: "no slash commands mentioned" });
  else if (ctx.uses === null) checks.push({ name: "docs-checked", pass: null, detail: `mentions ${commands.join(" ")}; agent output has no tool log` });
  else
    checks.push({
      name: "docs-checked",
      pass: fetchedClaudeDocs(ctx.uses),
      detail: `mentions ${commands.join(" ")}; ${fetchedClaudeDocs(ctx.uses) ? "fetched code.claude.com docs" : "never fetched code.claude.com docs"}`,
    });
  return checks;
}

const EVAL_RULES = `This is a non-interactive evaluation run of the build-phase skill, in a throwaway copy of the repository.
- No human will answer. Where the skill says to agree something with the user, treat it as agreed and continue.
- Do not commit, push or ask questions.
- Finish with a short summary of what you did.`;

async function copyWorkspace(root: string, dir: string) {
  const r = await sh("git ls-files -z -co --exclude-standard", { cwd: root });
  if (r.code !== 0) throw new Error(`git ls-files: ${r.stderr}`);
  for (const f of r.stdout.split("\0").filter(Boolean)) {
    const src = join(root, f);
    if (!existsSync(src)) continue; // deleted but still tracked
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    copyFileSync(src, join(dir, f));
  }
  await sh("git init -q && git add -A && git -c user.email=eval@workshop -c user.name=eval commit -qm base --no-verify", { cwd: dir });
}

async function changedFiles(dir: string): Promise<string[]> {
  const r = await sh("git status --porcelain --untracked-files=all", { cwd: dir });
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^.* -> /, ""));
}

async function runAgent(agent: string, dir: string, c: EvalCase, opts: { model?: string; budget: number; timeoutMs: number }) {
  if (agent === "claude") {
    const args = [
      "-p",
      `/build-phase ${c.request}`,
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read,Edit,Write,Glob,Grep,WebFetch,Bash(node *),Bash(pnpm *),Bash(git status *),Bash(git diff *),Bash(ls *),Bash(grep *)",
      "--append-system-prompt",
      EVAL_RULES,
      "--model",
      opts.model ?? defaultModel("agent"),
      "--max-budget-usd",
      String(opts.budget),
    ];
    const r = await spawnArgs("claude", args, { cwd: dir, timeoutMs: opts.timeoutMs });
    const res = resultEvent(r.stdout);
    return {
      ok: r.code === 0 && res.subtype === "success",
      uses: toolUses(r.stdout) as ToolUse[] | null,
      costUsd: typeof res.total_cost_usd === "number" ? res.total_cost_usd : undefined,
      turns: res.num_turns as number | undefined,
      summary: typeof res.result === "string" ? res.result : (res.subtype ?? r.stderr.slice(-500)),
      durationMs: r.durationMs,
      timedOut: r.timedOut,
    };
  }
  const skill = readFileSync(join(dir, ".claude/skills/build-phase/SKILL.md"), "utf8");
  const prompt = `${EVAL_RULES}\n\nFollow this skill (from .claude/skills/build-phase/SKILL.md):\n\n${skill.replace("$ARGUMENTS", c.request)}`;
  const r = await spawnArgs("agent", ["-p", prompt, "--force", "--trust", "--output-format", "json", ...(opts.model ? ["--model", opts.model] : [])], {
    cwd: dir,
    timeoutMs: opts.timeoutMs,
  });
  let res: any = {};
  try {
    res = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}");
  } catch {}
  return {
    ok: r.code === 0,
    uses: null,
    costUsd: undefined,
    turns: undefined,
    summary: typeof res.result === "string" ? res.result : r.stderr.slice(-500),
    durationMs: r.durationMs,
    timedOut: r.timedOut,
  };
}

async function detectAgent(): Promise<string> {
  if ((await sh("command -v claude")).code === 0) return "claude";
  if ((await sh("command -v agent")).code === 0) return "cursor";
  throw new Error("Neither Claude Code (`claude`) nor Cursor CLI (`agent`) is installed");
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const { values } = parseArgs({
    options: {
      agent: { type: "string" },
      case: { type: "string" },
      model: { type: "string" },
      "max-budget-usd": { type: "string", default: "3" },
      "timeout-min": { type: "string", default: "20" },
      keep: { type: "boolean", default: false },
    },
  });
  const casesFile = join(root, ".claude/skills/build-phase/evals/cases.jsonl");
  let cases: EvalCase[] = readFileSync(casesFile, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  if (values.case) cases = cases.filter((c) => c.id === values.case);
  if (!cases.length) throw new Error(`no case "${values.case}" in ${casesFile}`);
  const agent = values.agent ?? (await detectAgent());
  const timeoutMs = Number(values["timeout-min"]) * 60_000;
  const budget = Number(values["max-budget-usd"]);

  const results = [];
  for (const c of cases) {
    const dir = mkdtempSync(join(tmpdir(), `build-phase-${c.id}-`));
    console.log(`▶ ${c.id} (${agent}) …`);
    await copyWorkspace(root, dir);
    const run = await runAgent(agent, dir, c, { model: values.model, budget, timeoutMs });

    const map = parsePhaseMap(readFileSync(join(dir, "AGENTS.md"), "utf8"));
    const phaseDir = join(dir, ".agents/phases");
    const docs = readdirSync(phaseDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => lintPhaseDoc(readFileSync(join(phaseDir, f), "utf8"), `.agents/phases/${f}`, map));
    const ctx: CaseContext = { changed: await changedFiles(dir), docs, repoErrors: lintRepo(dir, docs), uses: run.uses };
    const checks = gradeCase(c, ctx);
    if (run.timedOut) checks.unshift({ name: "finished", pass: false, detail: `timed out after ${values["timeout-min"]} min` });
    else if (!run.ok) checks.unshift({ name: "finished", pass: false, detail: `agent run failed: ${run.summary}` });
    const pass = checks.every((k) => k.pass !== false);

    for (const k of checks) console.log(`   ${k.pass === null ? "–" : k.pass ? "✓" : "✗"} ${k.name}: ${k.detail}`);
    const cost = run.costUsd !== undefined ? ` · $${run.costUsd.toFixed(2)}` : "";
    console.log(`   ${pass ? "PASS" : "FAIL"} · ${(run.durationMs / 1000).toFixed(0)}s${run.turns ? ` · ${run.turns} turns` : ""}${cost}`);
    if (values.keep) console.log(`   workspace kept: ${dir}`);
    else rmSync(dir, { recursive: true, force: true });

    results.push({ id: c.id, expect: c.expect, pass, checks, changed: ctx.changed, summary: run.summary, costUsd: run.costUsd, turns: run.turns, durationMs: run.durationMs });
  }

  const passed = results.filter((r) => r.pass).length;
  const totalCost = results.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  console.log(`\n${passed}/${results.length} cases passed${totalCost ? ` · total $${totalCost.toFixed(2)}` : ""}`);
  const outDir = join(root, ".workshop/skill-evals/build-phase");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify({ agent, model: values.model ?? (agent === "claude" ? defaultModel("agent") : undefined), results }, null, 2) + "\n");
  console.log(`results: ${out}`);
  if (passed < results.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
