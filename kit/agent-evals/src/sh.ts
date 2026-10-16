import { spawn } from "node:child_process";

export interface ShResult {
  code: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/** Run a shell command, capture output, never throw on non-zero exit. */
export function sh(command: string, opts: { cwd?: string; timeoutMs?: number; env?: Record<string, string | undefined>; input?: string } = {}): Promise<ShResult> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(command, { shell: true, cwd: opts.cwd, env: { ...process.env, ...opts.env } });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? 10 * 60_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, durationMs: Date.now() - t0, timedOut });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(e), durationMs: Date.now() - t0, timedOut });
    });
    child.stdin.on("error", () => {}); // child may exit before reading stdin
    child.stdin.end(opts.input ?? "");
  });
}

/** Run a program with an argument array — no shell, so prompts with backticks/$ are passed verbatim. */
export function spawnArgs(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number; env?: Record<string, string | undefined> } = {}): Promise<ShResult> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    // Drop the parent Claude Code session marker so a nested `claude` starts as a fresh session.
    const env = { ...process.env, ...opts.env };
    delete env.CLAUDECODE;
    const child = spawn(cmd, args, { cwd: opts.cwd, env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? 10 * 60_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, durationMs: Date.now() - t0, timedOut });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(e), durationMs: Date.now() - t0, timedOut });
    });
    child.stdin.on("error", () => {});
    child.stdin.end();
  });
}

export async function git(repo: string, args: string, opts: { timeoutMs?: number } = {}): Promise<string> {
  const r = await sh(`git -C ${JSON.stringify(repo)} ${args}`, opts);
  if (r.code !== 0) throw new Error(`git ${args}: ${r.stderr.trim()}`);
  return r.stdout;
}

export const tail = (s: string, n = 4000) => (s.length > n ? "…" + s.slice(-n) : s);
