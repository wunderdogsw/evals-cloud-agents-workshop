import { existsSync } from "node:fs";
import { classifyLine, type InvoiceLine } from "./classify.ts";

/**
 * Usage:
 *   pnpm classify "Telinevuokra 4 vk"                      → classify one description
 *   echo '{"description":"..."}' | pnpm classify --json    → JSON in, JSON out (used by shellTask)
 */
async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const args = process.argv.slice(2);
  let line: InvoiceLine;
  if (args.includes("--json")) {
    let s = "";
    for await (const chunk of process.stdin) s += chunk;
    line = JSON.parse(s);
  } else {
    const description = args.filter((a) => !a.startsWith("--")).join(" ");
    if (!description) throw new Error('usage: pnpm classify "<invoice line description>"');
    line = { description };
  }
  console.log(JSON.stringify(await classifyLine(line), null, 2));
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
