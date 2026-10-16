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

/** Everything the agent changed since the `eval-base` tag, including anything it committed itself. */
export async function diffStat(dir: string, exclude: string[] = []): Promise<{ files: number; added: number; removed: number; patch: string }> {
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
  return { files, added, removed, patch };
}
