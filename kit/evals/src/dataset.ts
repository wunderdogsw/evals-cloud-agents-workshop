import { readFile } from "node:fs/promises";
import type { EvalCase } from "./types.ts";

/** Load a JSONL dataset. Blank lines and lines starting with `//` are ignored. */
export async function loadCases<I = unknown, E = unknown>(path: string): Promise<EvalCase<I, E>[]> {
  const text = await readFile(path, "utf8");
  return parseJsonl<EvalCase<I, E>>(text, path);
}

export function parseJsonl<T>(text: string, source = "<inline>"): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("//")) return;
    let row: any;
    try {
      row = JSON.parse(line);
    } catch (e) {
      throw new Error(`${source}:${i + 1}: invalid JSON — ${(e as Error).message}`);
    }
    if (row && typeof row === "object" && "input" in row) {
      if (typeof row.id !== "string" || !row.id) throw new Error(`${source}:${i + 1}: every case needs a string "id"`);
      if (seen.has(row.id)) throw new Error(`${source}:${i + 1}: duplicate case id "${row.id}"`);
      seen.add(row.id);
    }
    out.push(row as T);
  });
  return out;
}
