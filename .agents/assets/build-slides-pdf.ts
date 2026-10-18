/**
 * Writes docs/slides/evals-cloud-agents.pdf from docs/slides/index.html: one 1600×900 page per slide,
 * each slide in its final state. Needs Playwright with Chromium.
 *
 *   pnpm docs:slides
 *
 * docs/slides/index.html is a copy of the "Evals & Cloud Agents" Claude artifact. To update the slides,
 * replace that file with the artifact's HTML (keep the PDF link in the toolbar), then run this script.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PAGE = join(ROOT, "docs", "slides", "index.html");
const PDF = join(ROOT, "docs", "slides", "evals-cloud-agents.pdf");

async function main() {
  let chromium: any;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("needs Playwright: run `pnpm add -D playwright` and `npx playwright install chromium`");
  }
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  // The deck puts every slide in its final state before printing.
  await page.evaluate(() => (window as any).__prepPrint?.());
  await page.waitForTimeout(800);
  await page.pdf({ path: PDF, width: "1600px", height: "900px", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log(`✓ ${PDF.slice(ROOT.length + 1)}`);
}

main().catch((e) => {
  console.error(`docs:slides: ${(e as Error).message}`);
  process.exit(2);
});
