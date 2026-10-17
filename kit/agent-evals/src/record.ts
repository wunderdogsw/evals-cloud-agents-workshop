import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fingerprint, writeRecording, type RunResult, type Threshold } from "@workshop/evals";
import { loadJudge, loadRules, type JudgeSpec, type RuleGrader } from "./rules.ts";
import { sh } from "./sh.ts";

export const SUITE_CONFIG = "agent-suite.json";

/**
 * `<target>/evals/suites/agent/agent-suite.json` — what the CI gate checks for agent runs.
 *
 *   {
 *     "name": "agent",
 *     "rules": "rules.ts",                      // rule graders, in this folder
 *     "judges": { "R5": "rubric-r5.md" },      // one rubric per judgement rule, in this folder
 *     "threshold": { "graders": { "rule:R4": 1, "hidden-tests": 0.6, "judge:R5": 0.6 } },
 *     "tracks": ["../../../CLAUDE.md", "../../../AGENTS.md", "../../../.claude"]
 *   }
 *
 * `tracks` are relative to this folder. The folder itself (config, rules, rubrics) is always fingerprinted.
 */
export interface AgentSuiteConfig {
  name?: string;
  rules?: string;
  judges?: Record<string, string>;
  threshold: Threshold;
  tracks: string[];
}

export interface LoadedSuite {
  dir: string;
  config: AgentSuiteConfig;
  rules: RuleGrader[];
  judges: JudgeSpec[];
}

export async function loadAgentSuite(dir: string): Promise<LoadedSuite> {
  const abs = resolve(dir);
  const file = join(abs, SUITE_CONFIG);
  if (!existsSync(file)) throw new Error(`no ${SUITE_CONFIG} in ${abs}`);
  const config = JSON.parse(readFileSync(file, "utf8")) as AgentSuiteConfig;
  if (!config.threshold || !Object.keys(config.threshold).length) throw new Error(`${SUITE_CONFIG}: set a threshold — the gate has nothing to check without one`);
  if (!Array.isArray(config.tracks) || !config.tracks.length) throw new Error(`${SUITE_CONFIG}: list the agent files the recording tracks in "tracks"`);
  const rules = config.rules ? await loadRules(join(abs, config.rules)) : [];
  const judges = await Promise.all(Object.entries(config.judges ?? {}).map(([name, f]) => loadJudge(`${name}=${f}`, abs)));
  return { dir: abs, config, rules, judges };
}

/**
 * Before a recorded run: the recording must describe committed files, because the agent runs on
 * `git archive` snapshots of the target, not on its working tree.
 */
export async function assertCommitted(repo: string, suite: LoadedSuite): Promise<void> {
  const paths = [suite.dir, ...suite.config.tracks.map((t) => resolve(suite.dir, t))].map((p) => JSON.stringify(relative(repo, p) || "."));
  const st = await sh(`git status --porcelain -- ${paths.join(" ")}`, { cwd: repo });
  const dirty = st.stdout.split("\n").filter((l) => l && !l.endsWith("last-run.json"));
  if (dirty.length) throw new Error(`commit these first — the agent runs on committed files:\n${dirty.join("\n")}`);
}

export function suiteFingerprint(suite: LoadedSuite): Record<string, string> {
  return fingerprint(suite.dir, suite.config.tracks);
}

/** After the run: refuse if anything tracked changed while it ran, then write last-run.json. */
export function recordAgentRun(suite: LoadedSuite, before: Record<string, string>, result: RunResult, meta: { agent: string; models: Record<string, string> }): string {
  const after = suiteFingerprint(suite);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => before[f] !== after[f]);
  if (changed.length) throw new Error(`tracked files changed during the run, not recording: ${changed.join(", ")}`);
  if (result.summary.errors) throw new Error(`${result.summary.errors} task(s) errored — fix them and run again before recording`);
  return writeRecording(suite.dir, result, { provider: meta.agent, models: meta.models, tracks: suite.config.tracks });
}
