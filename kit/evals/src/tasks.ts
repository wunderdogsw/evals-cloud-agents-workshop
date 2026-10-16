import { spawn } from "node:child_process";
import type { Task } from "./types.ts";

/**
 * Adapt any program into a task: the case input is written to stdin as JSON,
 * the program prints its output as JSON (or plain text) on stdout.
 * Lets a TypeScript eval suite test a .NET, Java, Python… feature unchanged.
 *
 *   task: shellTask("dotnet run --project src/CostCoder.Cli -- --json")
 */
export function shellTask<I = unknown, O = unknown>(
  command: string,
  opts: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; parse?: "json" | "text" } = {},
): Task<I, O> {
  return (input) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true, cwd: opts.cwd, env: { ...process.env, ...opts.env } });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`timed out after ${opts.timeoutMs ?? 60_000}ms`));
      }, opts.timeoutMs ?? 60_000);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`exit ${code}: ${err.trim().slice(0, 500)}`));
        if (opts.parse === "text") return resolve(out.trim() as O);
        try {
          resolve(JSON.parse(out) as O);
        } catch {
          reject(new Error(`stdout was not JSON: ${out.slice(0, 200)}`));
        }
      });
      child.stdin.on("error", () => {}); // child may exit before reading stdin
      child.stdin.end(typeof input === "string" ? input : JSON.stringify(input));
    });
}

/** POST the case input as JSON to a running service and use the JSON response as output. */
export function httpTask<I = unknown, O = unknown>(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number } = {}): Task<I, O> {
  return async (input) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...opts.headers },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as O;
  };
}
