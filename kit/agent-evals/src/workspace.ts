import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { git, sh } from "./sh.ts";
import type { AgentTask } from "./types.ts";

/**
 * Create a history-free snapshot of `repo` at `rev` in `dir`, committed once as "base".
 * No history means the agent can't `git show` the real solution.
 */
export async function snapshot(repo: string, rev: string, dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const r = await sh(`git -C ${JSON.stringify(repo)} archive --format=tar ${rev} | tar -x -C ${JSON.stringify(dir)}`);
  if (r.code !== 0) throw new Error(`snapshot ${rev}: ${r.stderr.trim()}`);
  await commitAll(dir, "base");
}

export async function commitAll(dir: string, message: string): Promise<void> {
  const init = (await sh("git rev-parse --git-dir", { cwd: dir })).code === 0 ? "" : "git init -q && ";
  await sh(`${init}git add -A && git -c user.email=eval@workshop -c user.name=eval commit -qm ${JSON.stringify(message)} --no-verify --allow-empty`, { cwd: dir });
}

/** Put hidden tests into the workspace. Returns the list of paths written. */
export async function applyHiddenTests(task: AgentTask, repo: string, dir: string, tasksFileDir: string): Promise<string[]> {
  const h = task.hiddenTests;
  if (!h) return [];
  const written: string[] = [];
  if (h.dir) {
    const src = resolve(tasksFileDir, h.dir);
    await cp(src, dir, { recursive: true, force: true });
    const r = await sh(`cd ${JSON.stringify(src)} && find . -type f`);
    written.push(...r.stdout.split("\n").filter(Boolean).map((p) => p.replace(/^\.\//, "")));
  }
  const from = h.fromCommit ?? task.reference;
  if (h.paths?.length) {
    if (!from) throw new Error(`task ${task.id}: hiddenTests.paths needs fromCommit or reference`);
    for (const p of h.paths) {
      const content = await git(repo, `show ${from}:${JSON.stringify(p)}`);
      await mkdir(dirname(join(dir, p)), { recursive: true });
      await writeFile(join(dir, p), content);
      written.push(p);
    }
  }
  return written;
}

/** Overlay the reference solution's non-test changes (used by `validate`). */
export async function applyReference(task: AgentTask, repo: string, dir: string, tasksFileDir: string): Promise<void> {
  if (task.referenceDir) {
    await cp(resolve(tasksFileDir, task.referenceDir), dir, { recursive: true, force: true });
    return;
  }
  if (!task.reference) throw new Error(`task ${task.id} has no reference commit or referenceDir`);
  const files = (await git(repo, `diff --name-only --diff-filter=AMR ${task.base} ${task.reference}`)).split("\n").filter(Boolean);
  for (const f of files) {
    const content = await git(repo, `show ${task.reference}:${JSON.stringify(f)}`);
    await mkdir(dirname(join(dir, f)), { recursive: true });
    await writeFile(join(dir, f), content);
  }
  const deleted = (await git(repo, `diff --name-only --diff-filter=D ${task.base} ${task.reference}`)).split("\n").filter(Boolean);
  for (const f of deleted) await rm(join(dir, f), { force: true });
}

/** Where the agent-eval CI recording lives in a target. Never shown to the agent. */
export const AGENT_SUITE_DIR = "evals/suites/agent";

/** Agent customisation files: instructions, rules, skills, hooks, settings, MCP config. */
export const AGENT_FILES = ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".claude", ".cursor", ".cursorrules", ".mcp.json"];

/**
 * Remove paths from a fresh workspace before the agent starts. `withoutSetup` also removes every agent
 * customisation file, at any depth, so the agent works from the code alone.
 */
export async function strip(dir: string, opts: { withoutSetup?: boolean; extra?: string[] } = {}): Promise<string[]> {
  const removed: string[] = [];
  for (const rel of [AGENT_SUITE_DIR, ...(opts.extra ?? [])]) {
    if (existsSync(join(dir, rel))) {
      await rm(join(dir, rel), { recursive: true, force: true });
      removed.push(rel);
    }
  }
  if (opts.withoutSetup) {
    const names = AGENT_FILES.map((n) => `-name ${JSON.stringify(n)}`).join(" -o ");
    const found = await sh(`find . -path ./node_modules -prune -o -path ./.git -prune -o \\( ${names} \\) -prune -print`, { cwd: dir });
    for (const p of found.stdout.split("\n").filter(Boolean)) {
      const rel = p.replace(/^\.\//, "");
      if (rel.split("/").includes("node_modules")) continue;
      await rm(join(dir, rel), { recursive: true, force: true });
      removed.push(rel);
    }
  }
  return removed;
}

/** Is this repo-relative path an agent customisation file (or inside one of the agent folders)? */
export const isAgentFile = (rel: string) => rel.split("/").some((seg) => AGENT_FILES.includes(seg));

/**
 * Replace the snapshot's agent files with the ones committed at `rev` (default HEAD) of the target.
 * Mined tasks start from old commits; this makes every task run with the setup you're measuring now.
 */
export async function overlaySetup(repo: string, dir: string, rev = "HEAD"): Promise<string[]> {
  await strip(dir, { withoutSetup: true });
  const files = (await git(repo, `ls-tree -r --name-only ${rev}`)).split("\n").filter((f) => f && isAgentFile(f));
  if (files.length) {
    const list = files.map((f) => JSON.stringify(f)).join(" ");
    const r = await sh(`git -C ${JSON.stringify(repo)} archive --format=tar ${rev} -- ${list} | tar -x -C ${JSON.stringify(dir)}`);
    if (r.code !== 0) throw new Error(`overlay agent setup from ${rev}: ${r.stderr.trim()}`);
  }
  return files;
}

/** Everything the agent changed since the `eval-base` tag, including anything it committed itself. */
export async function diffStat(dir: string, exclude: string[] = []): Promise<{ files: number; added: number; removed: number; patch: string; nameStatus: string }> {
  await sh(`git add -A`, { cwd: dir });
  const ex = exclude.map((p) => ` ':(exclude)${p}'`).join("");
  const num = await sh(`git diff --cached --numstat eval-base -- .${ex}`, { cwd: dir });
  let added = 0, removed = 0, files = 0;
  for (const line of num.stdout.split("\n").filter(Boolean)) {
    const [a, r] = line.split("\t");
    files++;
    added += Number(a) || 0;
    removed += Number(r) || 0;
  }
  const patch = (await sh(`git diff --cached eval-base -- .${ex}`, { cwd: dir })).stdout;
  const nameStatus = (await sh(`git diff --cached --name-status eval-base -- .${ex}`, { cwd: dir })).stdout;
  return { files, added, removed, patch, nameStatus };
}
