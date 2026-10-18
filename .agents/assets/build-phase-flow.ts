/**
 * Builds the interactive evals flow page, docs/phase-flow/index.html, from the phase documents.
 *
 *   pnpm docs:flow            write the phase data into the page
 *   pnpm docs:flow --check    exit 1 if the page is out of date (used by `pnpm test`)
 *   pnpm docs:flow --images   also write flow-light.png and flow-dark.png for the README (needs Playwright)
 *
 * Only the text between PHASES:BEGIN and PHASES:END in the page is generated: steps, Gate, learning point
 * and wanted outcome are copied from each phase doc. The chart layout and the path notes below are written
 * by hand; update them when a phase changes its paths.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PAGE = join(ROOT, "docs", "phase-flow", "index.html");
const PHASES_DIR = join(ROOT, ".agents", "phases");
const LAST_EVALS_PHASE = 15;

/** Short notes on the other paths of a phase, shown under its steps. */
const BRANCHES: Record<number, { label: string; text: string }[]> = {
  4: [
    { label: "Create", text: "There are no agent files. `/init` writes `CLAUDE.md`, they audit the new file, and they add 3–5 rules their reviewers enforce." },
    { label: "Already good", text: "There are no instruction findings. They shorten the files instead of fixing them, keep each `CLAUDE.md` under about 200 lines, and move file-specific rules into `.claude/rules/`." },
  ],
  5: [{ label: "Already good", text: "A blocking hook or a run skill already exists. They don't add one. They trigger the existing hook on purpose, and turn off unused skills found with `/skill-doctor`." }],
  12: [{ label: "Agent broke no rule", text: "They test a change that makes the setup smaller, and keep it if no grader gets worse." }],
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The small part of Markdown the four top sections use: `code` and **bold**. */
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

function section(text: string, name: string): string {
  const m = new RegExp(`^## ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)(?=^## |^---\\s*$)`, "m").exec(text);
  if (!m) throw new Error(`missing "## ${name}"`);
  return m[1]!.trim();
}

export interface FlowPhase {
  n: number;
  part: string;
  title: string;
  file: string;
  do: string[];
  gate: string[];
  lp: string;
  out: string;
  branches?: { label: string; text: string }[];
}

export function buildPhases(dir = PHASES_DIR): FlowPhase[] {
  const out: FlowPhase[] = [];
  for (const f of readdirSync(dir).filter((x) => /^\d\d-.*\.md$/.test(x)).sort()) {
    const n = Number(f.slice(0, 2));
    if (n > LAST_EVALS_PHASE) continue;
    const text = readFileSync(join(dir, f), "utf8");
    const title = /^# Phase \d+ — (.+)$/m.exec(text)?.[1];
    if (!title) throw new Error(`${f}: no "# Phase N — Title" heading`);
    try {
      const doItems = section(text, "What you do").split("\n").filter((l) => /^\d+\.\s/.test(l));
      out.push({
        n,
        part: n <= 5 ? "A · Foundation" : n <= 11 ? "B · Measure" : n <= 13 ? "C · Improve" : "D · Protect",
        title,
        file: `.agents/phases/${f}`,
        do: doItems.map((l) => inline(l.replace(/^\d+\.\s+/, "")).replace(/^<strong>(.+?)<\/strong> — /, "<strong>$1</strong>: ")),
        gate: section(text, "Gate").split("\n").filter((l) => l.startsWith("- [ ] ")).map((l) => inline(l.slice(6))),
        lp: inline(section(text, "Learning point").replace(/\s*\n\s*/g, " ")),
        out: inline(section(text, "Wanted outcome").replace(/\s*\n\s*/g, " ")),
        ...(BRANCHES[n] ? { branches: BRANCHES[n]!.map((b) => ({ label: b.label, text: inline(b.text) })) } : {}),
      });
    } catch (e) {
      throw new Error(`${f}: ${(e as Error).message}`);
    }
  }
  if (out.length !== LAST_EVALS_PHASE) throw new Error(`expected ${LAST_EVALS_PHASE} evals phases, found ${out.length}`);
  return out;
}

const BLOCK = /(\/\* PHASES:BEGIN[^\n]*\n)[\s\S]*?(\n\/\* PHASES:END \*\/)/;

export function renderPage(page: string, phases: FlowPhase[]): string {
  if (!BLOCK.test(page)) throw new Error("docs/phase-flow/index.html has no PHASES:BEGIN … PHASES:END block");
  return page.replace(BLOCK, (_m, a, b) => `${a}const PHASES = ${JSON.stringify(phases, null, 1)};${b}`);
}

async function images() {
  let chromium: any;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("--images needs Playwright: run `npx playwright install chromium` and `pnpm add -D playwright`, or skip --images");
  }
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  for (const scheme of ["light", "dark"] as const) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(PAGE).href);
    await page.waitForTimeout(500);
    await page.locator(".wrap").screenshot({ path: join(dirname(PAGE), `flow-${scheme}.png`) });
    await page.close();
  }
  await browser.close();
  console.log("✓ docs/phase-flow/flow-light.png, flow-dark.png");
}

async function main() {
  const args = process.argv.slice(2);
  if (!existsSync(PAGE)) throw new Error(`${PAGE} not found`);
  const current = readFileSync(PAGE, "utf8");
  const next = renderPage(current, buildPhases());
  if (args.includes("--check")) {
    if (next !== current) {
      console.error("docs/phase-flow/index.html is out of date with the phase docs. Run: pnpm docs:flow");
      process.exit(1);
    }
    console.log("✓ docs/phase-flow/index.html matches the phase docs");
    return;
  }
  if (next !== current) writeFileSync(PAGE, next);
  console.log(`✓ docs/phase-flow/index.html ${next !== current ? "updated" : "already up to date"}`);
  if (args.includes("--images")) await images();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`docs:flow: ${(e as Error).message}`);
    process.exit(2);
  });
}
