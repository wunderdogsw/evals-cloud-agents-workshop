/**
 * Builds the slides for GitHub Pages:
 *   1. copies the speaker notes from docs/slides/notes.json into docs/slides/index.html, so the Notes button
 *      (or the N key) shows them to everyone, read-only;
 *   2. writes docs/slides/evals-cloud-agents.pdf: each slide (1600×900, final state) followed by a page with
 *      its speaker notes.
 *
 *   pnpm docs:slides            update index.html and write the PDF (needs Playwright with Chromium)
 *   pnpm docs:slides --check    exit 1 if index.html doesn't have the notes from notes.json (used by `pnpm test`)
 *
 * docs/slides/index.html is a copy of the "Evals & Cloud Agents" Claude artifact, and notes.json is a copy of
 * the notes saved in that artifact (one entry per slide, keyed by the slide title as a slug). To update the
 * slides, replace index.html with the artifact's HTML and keep its local changes: the PDF link in the toolbar,
 * the #static-notes script tag and useStaticNotes(). Then update notes.json and run this script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = join(ROOT, "docs", "slides");
const PAGE = join(DIR, "index.html");
const NOTES = join(DIR, "notes.json");
const PDF = join(DIR, "evals-cloud-agents.pdf");
const TAG = /(<script type="application\/json" id="static-notes">)[\s\S]*?(<\/script>)/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The page with notes.json inside the #static-notes tag. `<` is escaped so the JSON can't end the script tag. */
export function withNotes(page: string, notes: Record<string, string>): string {
  if (!TAG.test(page)) throw new Error('docs/slides/index.html has no <script type="application/json" id="static-notes"> tag');
  const json = JSON.stringify(notes).replace(/</g, "\\u003c");
  return page.replace(TAG, (_m, a, b) => `${a}${json}${b}`);
}

/** One 1600×900 page per slide: the slide number and title, then its notes. URLs become links. */
function notesHtml(slides: { title: string; text: string }[]): string {
  const body = slides
    .map((s, i) => {
      const text = esc(s.text || "No notes for this slide.").replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);
      return `<section><p class="n">Slide ${i + 1} of ${slides.length} · Speaker notes</p><h1>${esc(s.title)}</h1><div class="t">${text}</div></section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,700&display=swap">
<style>
@page{size:1600px 900px;margin:0}
html,body{margin:0;background:#fff;color:#14213d;font-family:"DM Sans","Helvetica Neue",Arial,sans-serif}
section{width:1600px;height:900px;box-sizing:border-box;padding:72px 96px;page-break-after:always;overflow:hidden}
.n{margin:0 0 8px;font-size:20px;letter-spacing:.06em;text-transform:uppercase;color:#5b6b85}
h1{margin:0 0 32px;font-size:44px;line-height:1.15}
.t{white-space:pre-wrap;font-size:24px;line-height:1.5;max-width:1300px}
a{color:#1d4ed8}
</style></head><body>
${body}
</body></html>`;
}

async function main() {
  const check = process.argv.includes("--check");
  const notes = JSON.parse(readFileSync(NOTES, "utf8")) as Record<string, string>;
  const current = readFileSync(PAGE, "utf8");
  const next = withNotes(current, notes);
  if (check) {
    if (next !== current) {
      console.error("docs/slides/index.html doesn't have the notes from docs/slides/notes.json. Run: pnpm docs:slides");
      process.exit(1);
    }
    console.log("✓ docs/slides/index.html has the notes from notes.json");
    return;
  }
  if (next !== current) writeFileSync(PAGE, next);

  let chromium: any, PDFDocument: any;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("needs Playwright: run `pnpm add -D playwright` and `npx playwright install chromium`");
  }
  ({ PDFDocument } = await import("pdf-lib"));
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});

  // The slides, each in its final state.
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const slides: { key: string; title: string }[] = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#deck .slide")].map((s) => ({ key: s.dataset.key!, title: s.dataset.title || "" })),
  );
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => (window as any).__prepPrint?.());
  await page.waitForTimeout(800);
  const slidesPdf = await page.pdf({ width: "1600px", height: "900px", printBackground: true, preferCSSPageSize: true });

  // One notes page per slide.
  const missing = slides.filter((s) => !notes[s.key]).map((s) => s.key);
  if (missing.length) console.warn(`! no notes for: ${missing.join(", ")}`);
  const np = await browser.newPage();
  await np.setContent(notesHtml(slides.map((s) => ({ title: s.title, text: notes[s.key] ?? "" }))), { waitUntil: "networkidle" });
  await np.evaluate(() => document.fonts.ready);
  const notesPdf = await np.pdf({ width: "1600px", height: "900px", printBackground: true, preferCSSPageSize: true });
  await browser.close();

  // Slide 1, notes 1, slide 2, notes 2, …
  const a = await PDFDocument.load(slidesPdf);
  const b = await PDFDocument.load(notesPdf);
  if (a.getPageCount() !== slides.length || b.getPageCount() !== slides.length) {
    throw new Error(`expected ${slides.length} slide and notes pages, got ${a.getPageCount()} and ${b.getPageCount()}`);
  }
  const out = await PDFDocument.create();
  out.setTitle("Admicom x Wunderdog – Evals & Cloud Agents (slides and speaker notes)");
  const sp = await out.copyPages(a, a.getPageIndices());
  const nps = await out.copyPages(b, b.getPageIndices());
  sp.forEach((p: any, i: number) => {
    out.addPage(p);
    out.addPage(nps[i]);
  });
  writeFileSync(PDF, await out.save());
  console.log(`✓ docs/slides/index.html (${Object.keys(notes).length} notes), ${PDF.slice(ROOT.length + 1)} (${slides.length} slides + notes)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`docs:slides: ${(e as Error).message}`);
    process.exit(2);
  });
}
