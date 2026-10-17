import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sh, tail } from "./sh.ts";
import type { AgentTask } from "./types.ts";

/** One file the agent changed, from `git diff --name-status eval-base`. */
export interface ChangedFile {
  path: string;
  /** A added, M modified, D deleted, R renamed (path is the new name). */
  status: "A" | "M" | "D" | "R";
}

/** What a rule grader sees: the agent's change, not its words. */
export interface RuleContext {
  task: Pick<AgentTask, "id" | "prompt" | "tags">;
  changes: ChangedFile[];
  /** The full patch since `eval-base` (may be truncated for very large changes). */
  patch: string;
  /** Changed paths (any status) matching a glob such as "src/**" or "data/*.json". */
  touched(glob: string): string[];
  /** Paths the agent added, optionally filtered by a glob. */
  added(glob?: string): string[];
  /** Run a command in the task workspace. Throws when the workspace is gone (re-grading an old run). */
  run(command: string, timeoutMs?: number): Promise<{ code: number | null; output: string }>;
}

export interface RuleVerdict {
  pass: boolean;
  reason?: string;
}

/**
 * A deterministic grader for one rule. Keep the file free of imports: the kit loads it from the
 * target, where `@workshop/*` packages don't resolve.
 *
 *   export default [
 *     { name: "R4", description: "Never edit data/", grade: (c) => ({ pass: c.touched("data/**").length === 0 }) },
 *   ];
 */
export interface RuleGrader {
  /** The rule id from expectations.md, e.g. "R3". The grade is reported as "rule:R3". */
  name: string;
  description?: string;
  /** Task ids this rule applies to. Omit for all tasks. Tasks it doesn't apply to get no grade. */
  tasks?: string[];
  grade(ctx: RuleContext): RuleVerdict | boolean | Promise<RuleVerdict | boolean>;
}

/** Minimal glob: `**` any path, `*` any segment part, `?` one char. Matches the whole path. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export const matchGlob = (path: string, glob: string) => globToRegExp(glob).test(path);

export function parseNameStatus(text: string): ChangedFile[] {
  const out: ChangedFile[] = [];
  for (const line of text.split("\n").filter(Boolean)) {
    const [st, a, b] = line.split("\t");
    const s = (st ?? "M")[0] as string;
    out.push({ status: s === "R" || s === "C" ? "R" : s === "A" || s === "D" ? s : "M", path: (s === "R" || s === "C" ? b : a) ?? "" });
  }
  return out;
}

export function ruleContext(task: RuleContext["task"], changes: ChangedFile[], patch: string, workspace?: string): RuleContext {
  return {
    task,
    changes,
    patch,
    touched: (glob) => changes.filter((c) => matchGlob(c.path, glob)).map((c) => c.path),
    added: (glob) => changes.filter((c) => c.status === "A" && (!glob || matchGlob(c.path, glob))).map((c) => c.path),
    async run(command, timeoutMs = 10 * 60_000) {
      if (!workspace || !existsSync(workspace)) throw new Error("the task workspace is gone; command rules need a fresh run");
      const r = await sh(command, { cwd: workspace, timeoutMs });
      return { code: r.timedOut ? null : r.code, output: tail(r.stdout + r.stderr, 1500) };
    },
  };
}

export async function gradeRule(rule: RuleGrader, ctx: RuleContext) {
  const name = `rule:${rule.name}`;
  try {
    const v = await rule.grade(ctx);
    const verdict = typeof v === "boolean" ? { pass: v } : v;
    return { name, pass: Boolean(verdict.pass), score: verdict.pass ? 1 : 0, reason: verdict.pass ? undefined : (verdict.reason ?? rule.description ?? "rule broken") };
  } catch (e) {
    return { name, pass: false, score: 0, reason: `grader error: ${(e as Error).message}` };
  }
}

export const appliesTo = (rule: RuleGrader, taskId: string) => !rule.tasks?.length || rule.tasks.includes(taskId);

export async function loadRules(file: string): Promise<RuleGrader[]> {
  const mod = await import(pathToFileURL(resolve(file)).href);
  const list = mod.default ?? mod.rules;
  if (!Array.isArray(list)) throw new Error(`${file} must export default an array of rule graders`);
  const seen = new Set<string>();
  for (const r of list) {
    if (!r || typeof r.name !== "string" || typeof r.grade !== "function") throw new Error(`${file}: every rule needs a "name" and a "grade" function`);
    if (seen.has(r.name)) throw new Error(`${file}: rule "${r.name}" is defined twice`);
    seen.add(r.name);
  }
  return list as RuleGrader[];
}

export interface JudgeSpec {
  /** Reported as "judge:<name>". */
  name: string;
  rubric: string;
  /** Task ids the judge grades; from a `tasks:` line in the rubric's frontmatter. Omit for all tasks. */
  tasks?: string[];
}

/** Split optional frontmatter (`---\ntasks: a, b\n---`) from a rubric. */
export function parseRubric(text: string): { rubric: string; tasks?: string[] } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { rubric: text };
  const line = /^tasks:\s*(.+)$/m.exec(m[1]!);
  const tasks = line ? line[1]!.replace(/[[\]"']/g, "").split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  return { rubric: text.slice(m[0].length), ...(tasks?.length ? { tasks } : {}) };
}

/** `--judge R5=rubric-r5.md` or `--judge rubric.md` (name from the file name). */
export async function loadJudge(spec: string, baseDir = process.cwd()): Promise<JudgeSpec> {
  const eq = spec.indexOf("=");
  const [name, file] = eq > 0 ? [spec.slice(0, eq), spec.slice(eq + 1)] : [basename(spec).replace(/\.[^.]+$/, "").replace(/^rubric-?/, "") || "diff", spec];
  return { name, ...parseRubric(await readFile(resolve(baseDir, file), "utf8")) };
}
