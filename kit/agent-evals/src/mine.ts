import { git } from "./sh.ts";
import type { AgentTask } from "./types.ts";

export interface MineOptions {
  /** Passed to `git log`, e.g. "6 months ago". */
  since?: string;
  limit?: number;
  /** Regex deciding which paths count as tests. */
  testPattern?: RegExp;
  /** Max non-test files touched — bigger changes make poor agent tasks. */
  maxSourceFiles?: number;
  testCommand: string;
  /** Only first-parent history of this ref (default HEAD) — i.e. what actually landed. */
  ref?: string;
}

export interface MinedCandidate extends AgentTask {
  meta: { subject: string; author: string; date: string; sourceFiles: string[]; testFiles: string[]; linesChanged: number };
}

/** Lockfiles, generated and workshop files don't count as source changes. */
const IGNORED = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|packages\.lock\.json|poetry\.lock|uv\.lock|Cargo\.lock|go\.sum)$|^evals\/|^\.workshop\//;

export const DEFAULT_TEST_PATTERN = /(^|\/)(tests?|__tests__|spec|specs)\/|[._-](test|spec)s?\.[a-z]+$|Tests?\.(cs|java|kt|py)$/i;

/**
 * Find landed changes that touched both source and tests. Each becomes a candidate task:
 * base = parent, hidden tests = the test files from the change, reference = the change itself.
 * Candidates are a starting point — a human must rewrite each prompt into an issue-like description.
 */
export async function mineTasks(repo: string, o: MineOptions): Promise<MinedCandidate[]> {
  const testRe = o.testPattern ?? DEFAULT_TEST_PATTERN;
  const fmt = "%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%b%x1e";
  const log = await git(repo, `log --first-parent ${o.ref ?? "HEAD"} --format=${JSON.stringify(fmt)}${o.since ? ` --since=${JSON.stringify(o.since)}` : ""} -n ${(o.limit ?? 30) * 10}`);
  const out: MinedCandidate[] = [];
  for (const rec of log.split("\x1e").map((s) => s.trim()).filter(Boolean)) {
    const [sha, parents, author, date, subject, body] = rec.split("\x1f") as [string, string, string, string, string, string];
    const parentList = parents.split(" ").filter(Boolean);
    if (parentList.length === 0) continue;
    // For merge commits, diff against the first parent = the whole MR/PR.
    const base = parentList[0]!;
    const numstat = await git(repo, `diff --numstat --no-renames ${base} ${sha}`);
    const files = numstat
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [a, r, p] = l.split("\t");
        return { path: p!, lines: (Number(a) || 0) + (Number(r) || 0) };
      })
      .filter((f) => !IGNORED.test(f.path));
    const testFiles = files.filter((f) => testRe.test(f.path)).map((f) => f.path);
    const sourceFiles = files.filter((f) => !testRe.test(f.path)).map((f) => f.path);
    if (!testFiles.length || !sourceFiles.length || sourceFiles.length > (o.maxSourceFiles ?? 6)) continue;
    // Only test files that exist after the change can be hidden tests.
    const existing = (await git(repo, `diff --name-only --no-renames --diff-filter=AM ${base} ${sha}`)).split("\n").filter((p) => testRe.test(p));
    if (!existing.length) continue;
    out.push({
      id: `${sha.slice(0, 8)}-${subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "")}`,
      base,
      reference: sha,
      prompt: `TODO: rewrite as an issue. Original commit message:\n${subject}\n\n${body.trim()}`.trim(),
      testCommand: o.testCommand,
      hiddenTests: { paths: existing },
      meta: { subject, author, date, sourceFiles, testFiles, linesChanged: files.reduce((s, f) => s + f.lines, 0) },
    });
    if (out.length >= (o.limit ?? 30)) break;
  }
  return out;
}
