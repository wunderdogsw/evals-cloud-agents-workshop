/**
 * Checks that phase documents follow the phase format in
 * `.claude/skills/build-phase/template.md`, and that the phase docs, the
 * AGENTS.md phase map and the phase count in the workshop state agree.
 *
 *   pnpm lint:phases [--strict] [file …]
 *
 * With no files, checks every `.agents/phases/*.md`. Docs still in the old
 * format (no "## What you do") are reported as not migrated; --strict turns
 * that into an error.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface PhaseMapRow {
  phase: number;
  title: string;
  document: string;
}

export interface DocResult {
  file: string;
  phase: number | null;
  title: string | null;
  legacy: boolean;
  errors: string[];
  /** Built-in-looking slash commands mentioned in backticks, e.g. "/doctor". */
  commands: string[];
}

interface Section {
  title: string;
  body: string;
}

const TOP_SECTIONS = ["What you do", "Gate", "Learning point", "Wanted outcome"];
const STEP_BLOCKS = ["[LLM]", "[HUMAN]", "[BRANCH]"];
const MIN_ITEMS = 2;
const MAX_ITEMS = 4;

function splitSections(text: string, level: "##" | "###"): { head: string; sections: Section[] } {
  const marker = `${level} `;
  const lines = text.split("\n");
  const sections: Section[] = [];
  const head: string[] = [];
  let current: Section | null = null;
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence;
    if (!inFence && line.startsWith(marker)) {
      current = { title: line.slice(marker.length).trim(), body: "" };
      sections.push(current);
    } else if (current) current.body += line + "\n";
    else head.push(line);
  }
  return { head: head.join("\n"), sections };
}

/** Rough sentence count: enough to catch a paragraph where one sentence was asked for. */
export function countSentences(text: string): number {
  const prose = text
    .replace(/^\s*-{3,}\s*$/gm, "")
    .replace(/`[^`]*`/g, "x")
    .replace(/\b(e\.g|i\.e|etc|vs)\./gi, "$1")
    .trim();
  if (!prose) return 0;
  return prose.split(/[.!?](?:\s+|$)/).filter((s) => s.trim().length > 0).length;
}

function listLines(body: string, pattern: RegExp): string[] {
  return body.split("\n").filter((l) => pattern.test(l));
}

export function findCommands(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/`(\/[a-z][a-z0-9-]*)(?:\s[^`]*)?`/g)) found.add(m[1]);
  return [...found].sort();
}

export function lintPhaseDoc(text: string, file: string, map?: Map<number, PhaseMapRow>): DocResult {
  const result: DocResult = { file, phase: null, title: null, legacy: false, errors: [], commands: findCommands(text) };
  const err = (m: string) => result.errors.push(m);

  const h1 = text.match(/^# Phase (\d+) — (.+)$/m);
  if (!h1) {
    err('first heading must be "# Phase <N> — <Title>"');
    return result;
  }
  const n = Number(h1[1]);
  result.phase = n;
  result.title = h1[2].trim();

  const { sections } = splitSections(text, "##");
  if (!sections.some((s) => s.title === "What you do")) {
    result.legacy = true;
    return result;
  }

  if (/<(?:N|Title|Action \d+|check \d+|…)>/.test(text)) err("template placeholders left in the document");

  // Top four sections, in order, before anything else.
  const top = sections.slice(0, TOP_SECTIONS.length).map((s) => s.title);
  if (top.join("|") !== TOP_SECTIONS.join("|")) {
    err(`the first sections must be ${TOP_SECTIONS.map((t) => `"## ${t}"`).join(", ")} in that order (found: ${top.join(", ")})`);
    return result;
  }
  const [doSec, gateSec, learnSec, outcomeSec] = sections;

  const doLines = listLines(doSec.body, /^\d+\.\s/);
  const actions: string[] = [];
  for (const line of doLines) {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s+—\s+\S/);
    if (m) actions.push(m[1].trim());
    else err(`"What you do" item must read "N. **<Action>** — <one line>": ${line.trim()}`);
  }
  if (doLines.length < MIN_ITEMS || doLines.length > MAX_ITEMS)
    err(`"What you do" needs ${MIN_ITEMS}–${MAX_ITEMS} numbered items (found ${doLines.length})`);

  const gateItems = listLines(gateSec.body, /^- \[ \] \S/);
  if (gateItems.length < MIN_ITEMS || gateItems.length > MAX_ITEMS)
    err(`"Gate" needs ${MIN_ITEMS}–${MAX_ITEMS} "- [ ]" checks (found ${gateItems.length})`);

  const learn = countSentences(learnSec.body);
  if (learn < 1 || learn > 2) err(`"Learning point" must be 1–2 sentences (found ${learn})`);
  const outcome = countSentences(outcomeSec.body);
  if (outcome !== 1) err(`"Wanted outcome" must be 1 sentence (found ${outcome})`);

  // Sub-steps: one per action, same labels, same order, then "Gate check".
  const rest = sections.slice(TOP_SECTIONS.length);
  const steps: { minor: number; label: string; body: string }[] = [];
  const after: string[] = [];
  for (const s of rest) {
    const m = s.title.match(/^(\d+)\.(\d+)\s+(.+)$/);
    if (m) {
      if (after.length) err(`sub-step "${s.title}" comes after "${after[0]}"`);
      if (Number(m[1]) !== n) err(`sub-step "${s.title}" is numbered for phase ${m[1]}, not ${n}`);
      steps.push({ minor: Number(m[2]), label: m[3].trim(), body: s.body });
    } else if (s.title === "Room Gate" || s.title === "Phase Complete") {
      after.push(s.title);
    } else {
      err(`unexpected section "## ${s.title}"`);
    }
  }
  steps.forEach((s, i) => {
    if (s.minor !== i + 1) err(`sub-step ${n}.${s.minor} should be ${n}.${i + 1}`);
  });

  const last = steps[steps.length - 1];
  if (!last || last.label !== "Gate check") {
    err(`the last sub-step must be "## ${n}.${steps.length + 1} Gate check"`);
  } else {
    const checks = listLines(last.body, /^- \[ \] \S/);
    if (checks.length !== gateItems.length)
      err(`"Gate check" has ${checks.length} checks but "Gate" has ${gateItems.length}`);
    for (const c of checks) if (!/ — \S/.test(c)) err(`"Gate check" item must say how it is verified ("<check> — <how>"): ${c.trim()}`);
  }

  const work = last && last.label === "Gate check" ? steps.slice(0, -1) : steps;
  if (work.length !== actions.length)
    err(`${actions.length} "What you do" items but ${work.length} sub-steps before the Gate check`);
  work.forEach((s, i) => {
    if (actions[i] !== undefined && s.label !== actions[i])
      err(`sub-step ${n}.${s.minor} is "${s.label}" but "What you do" item ${i + 1} is "${actions[i]}"`);
    const blocks = splitSections(s.body, "###").sections.map((b) => b.title);
    for (const b of blocks) if (!STEP_BLOCKS.includes(b)) err(`sub-step ${n}.${s.minor}: unexpected block "### ${b}"`);
    if (!blocks.includes("[HUMAN]")) err(`sub-step ${n}.${s.minor} has no "### [HUMAN]" block`);
  });

  if (after[after.length - 1] !== "Phase Complete") err('the document must end with "## Phase Complete"');
  else {
    const done = rest[rest.length - 1].body;
    if (!done.includes(`Mark Phase ${n} complete`)) err(`"Phase Complete" must say "Mark Phase ${n} complete"`);
    if (!/Preview:/.test(done)) err('"Phase Complete" must include a "Preview:" of the next phase');
  }

  if (map) {
    const row = map.get(n);
    const doc = `.agents/phases/${basename(file)}`;
    if (!row) err(`phase ${n} is not in the AGENTS.md phase map`);
    else {
      if (row.title !== result.title) err(`title "${result.title}" differs from the phase map ("${row.title}")`);
      if (row.document !== doc) err(`phase map points phase ${n} to ${row.document}, not ${doc}`);
    }
  }
  return result;
}

export function parsePhaseMap(agentsMd: string): Map<number, PhaseMapRow> {
  const map = new Map<number, PhaseMapRow>();
  const { sections } = splitSections(agentsMd, "##");
  const sec = sections.find((s) => s.title === "Phase map");
  if (!sec) return map;
  const rows = sec.body.split("\n").filter((l) => l.trim().startsWith("|"));
  if (rows.length < 2) return map;
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const header = cells(rows[0]);
  const iPhase = header.indexOf("Phase");
  const iTitle = header.indexOf("Title");
  const iDoc = header.indexOf("Document");
  for (const r of rows.slice(2)) {
    const c = cells(r);
    const phase = Number(c[iPhase]);
    if (!Number.isInteger(phase)) continue;
    map.set(phase, { phase, title: c[iTitle], document: c[iDoc].replace(/`/g, "") });
  }
  return map;
}

/** Cross-file checks: phase map, phase files and phase counts in the workshop state agree. */
export function lintRepo(root: string, docs: DocResult[]): string[] {
  const errors: string[] = [];
  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  const map = parsePhaseMap(agents);
  const count = map.size;
  if (count === 0) return ["AGENTS.md has no readable \"## Phase map\" table"];

  for (let i = 1; i <= count; i++) if (!map.has(i)) errors.push(`phase map: phases must be numbered 1–${count} with no gaps (missing ${i})`);
  for (const row of map.values())
    if (!existsSync(join(root, row.document))) errors.push(`phase map: phase ${row.phase} points to ${row.document}, which does not exist`);

  const seen = new Map<number, string>();
  for (const d of docs) {
    if (d.phase === null) continue;
    const prev = seen.get(d.phase);
    if (prev) errors.push(`phase ${d.phase} is defined by both ${prev} and ${d.file}`);
    seen.set(d.phase, d.file);
  }

  const progress = agents.match(/"phases":\s*\{([\s\S]*?)\n\s*\}\n/);
  const progressCount = progress ? (progress[1].match(/"\d+":\s*\{/g) ?? []).length : 0;
  if (progressCount !== count)
    errors.push(`AGENTS.md initial progress.json lists ${progressCount} phases, the phase map ${count}`);

  const helper = join(root, ".agents/assets/workshop.ts");
  if (existsSync(helper)) {
    const src = readFileSync(helper, "utf8");
    const init = src.match(/for \(let i = 1; i <= (\d+); i\+\+\) phases\[/);
    if (init && Number(init[1]) !== count)
      errors.push(`.agents/assets/workshop.ts creates ${init[1]} phases in progress.json, the phase map has ${count}`);
    const catchup = src.match(/phase >= 2 && phase <= (\d+)/);
    if (catchup && Number(catchup[1]) !== count)
      errors.push(`.agents/assets/workshop.ts catchup accepts phases up to ${catchup[1]}, the phase map has ${count}`);
  }
  return errors;
}

function main(argv: string[]) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const strict = argv.includes("--strict");
  const named = argv.filter((a) => !a.startsWith("--"));
  const phaseDir = join(root, ".agents/phases");
  const all = readdirSync(phaseDir).filter((f) => f.endsWith(".md")).sort().map((f) => join(phaseDir, f));
  const files = named.length ? named.map((f) => resolve(f)) : all;

  const map = parsePhaseMap(readFileSync(join(root, "AGENTS.md"), "utf8"));
  const results = files.map((f) => lintPhaseDoc(readFileSync(f, "utf8"), relative(root, f), map));
  const allResults = named.length ? all.map((f) => lintPhaseDoc(readFileSync(f, "utf8"), relative(root, f), map)) : results;
  const repoErrors = lintRepo(root, allResults);

  let failed = 0;
  for (const r of results) {
    if (r.legacy) {
      console.log(`${strict ? "✗" : "•"} ${r.file}: old format, not migrated yet`);
      if (strict) failed++;
    } else if (r.errors.length) {
      failed++;
      console.log(`✗ ${r.file}`);
      for (const e of r.errors) console.log(`    - ${e}`);
    } else console.log(`✓ ${r.file}`);
  }
  if (repoErrors.length) {
    failed++;
    console.log("✗ phase map and workshop state");
    for (const e of repoErrors) console.log(`    - ${e}`);
  }
  const commands = [...new Set(results.flatMap((r) => (r.legacy ? [] : r.commands)))].sort();
  if (commands.length)
    console.log(`\nSlash commands mentioned (confirm each against https://code.claude.com/docs/en/commands): ${commands.join(" ")}`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
