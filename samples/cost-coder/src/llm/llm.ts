// Copied from the workshop kit (kit/evals/src/llm.ts) so this sample stands alone. Keep in sync.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { estimateCostUsd } from "./models.ts";

/**
 * Structured model calls for the feature-under-test and the LLM judge.
 *
 * Three interchangeable providers, chosen by EVALS_PROVIDER (or auto-detected):
 *   claude-code — `claude -p --json-schema …`, authenticated by the participant's Claude subscription
 *                 (their normal Claude Code login, or CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` in CI).
 *                 No API key needed. This is the workshop default.
 *   cursor      — `agent -p` (Cursor CLI), authenticated by the Cursor subscription (login or CURSOR_API_KEY).
 *   api         — Anthropic Messages API with ANTHROPIC_API_KEY.
 */
export interface StructuredCall {
  model: string;
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  toolName?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface StructuredResult<T> {
  data: T;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmClient {
  readonly provider?: string;
  structured<T>(call: StructuredCall): Promise<StructuredResult<T>>;
}

export type Provider = "claude-code" | "cursor" | "api";

let shared: LlmClient | undefined;

export function isMock(): boolean {
  return process.env.EVALS_MOCK === "1" || process.env.EVALS_MOCK === "true";
}

/** Swap the client (tests, mock mode, a gateway…). */
export function setLlmClient(client: LlmClient | undefined) {
  shared = client;
}

function onPath(bin: string): boolean {
  const dirs = (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":");
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd"] : [""];
  return dirs.some((d) => exts.some((e) => d && existsSync(join(d, bin + e))));
}

export function resolveProvider(): Provider {
  const p = process.env.EVALS_PROVIDER as Provider | undefined;
  if (p) {
    if (!["claude-code", "cursor", "api"].includes(p)) throw new Error(`EVALS_PROVIDER must be claude-code, cursor or api (got "${p}")`);
    return p;
  }
  if (onPath("claude")) return "claude-code";
  if (onPath("agent")) return "cursor";
  if (process.env.ANTHROPIC_API_KEY) return "api";
  throw new Error(
    "No model provider found. Install Claude Code and log in (`claude`), or install the Cursor CLI and log in (`agent login`), " +
      "or set ANTHROPIC_API_KEY. Or run offline with EVALS_MOCK=1.",
  );
}

export function llm(): LlmClient {
  if (shared) return shared;
  const p = resolveProvider();
  shared = p === "claude-code" ? claudeCodeClient() : p === "cursor" ? cursorClient() : anthropicClient();
  return shared;
}

// ───────────────────────── helpers ─────────────────────────

/** Empty working dir so the CLI loads no project CLAUDE.md, hooks, MCP servers or rules. */
function scratchDir(): string {
  const d = join(tmpdir(), "workshop-evals-llm");
  mkdirSync(d, { recursive: true });
  return d;
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE; // allow running from inside a Claude Code session
    const child = spawn(cmd, args, { cwd: scratchDir(), env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`could not start ${cmd}: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on("error", () => {});
    child.stdin.end();
  });
}

function lastJsonLine(s: string): any {
  const lines = s.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]!);
    } catch {}
  }
  throw new Error(`no JSON in output: ${s.slice(0, 300)}`);
}

/** First balanced {...} object in free text (Cursor has no schema flag). */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const src = fenced ? fenced[1]! : text;
  const start = src.indexOf("{");
  if (start < 0) throw new Error(`no JSON object in: ${text.slice(0, 200)}`);
  let depth = 0;
  let inStr = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(src.slice(start, i + 1));
  }
  throw new Error(`unbalanced JSON in: ${text.slice(0, 200)}`);
}

// ───────────────────────── providers ─────────────────────────

/** Claude Code headless with tools disabled — a plain model call on the participant's subscription. */
export function claudeCodeClient(bin = process.env.EVALS_CLAUDE_BIN ?? "claude"): LlmClient {
  return {
    provider: "claude-code",
    async structured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
      const args = [
        "-p",
        call.prompt,
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(call.schema),
        "--tools",
        "",
        "--strict-mcp-config",
        "--no-session-persistence",
        "--model",
        call.model,
        ...(call.system ? ["--system-prompt", call.system] : []),
      ];
      const r = await run(bin, args, 180_000);
      const out = lastJsonLine(r.stdout);
      if (out.is_error || out.subtype !== "success" || out.structured_output === undefined) {
        throw new Error(`claude -p failed (${out.subtype ?? r.code}): ${String(out.result ?? r.stderr).slice(0, 300)}`);
      }
      return {
        data: out.structured_output as T,
        // On a subscription this is Claude Code's estimate of the equivalent API cost, not a bill.
        costUsd: typeof out.total_cost_usd === "number" ? out.total_cost_usd : 0,
        inputTokens: out.usage?.input_tokens ?? 0,
        outputTokens: out.usage?.output_tokens ?? 0,
      };
    },
  };
}

/**
 * Cursor CLI headless, no --force (cannot edit files). Model: EVALS_CURSOR_MODEL, or Cursor's default.
 * Cursor model names differ from Anthropic IDs, so call.model is ignored unless EVALS_CURSOR_MODEL is set.
 */
export function cursorClient(bin = process.env.EVALS_CURSOR_BIN ?? "agent"): LlmClient {
  return {
    provider: "cursor",
    async structured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
      const prompt = [
        call.system ? `<instructions>\n${call.system}\n</instructions>` : "",
        call.prompt,
        `Do not use any tools or read any files. Respond with ONLY a JSON object (no prose, no code fence) that matches this JSON Schema:\n${JSON.stringify(call.schema)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const model = process.env.EVALS_CURSOR_MODEL;
      const r = await run(bin, ["-p", prompt, "--output-format", "json", "--trust", ...(model ? ["--model", model] : [])], 180_000);
      if (r.code !== 0) throw new Error(`agent -p failed (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 300)}`);
      const out = lastJsonLine(r.stdout);
      return { data: extractJsonObject(String(out.result ?? "")) as T, costUsd: 0, inputTokens: 0, outputTokens: 0 };
    },
  };
}

/** Anthropic Messages API (needs ANTHROPIC_API_KEY). Loaded lazily so the SDK isn't required otherwise. */
export function anthropicClient(): LlmClient {
  let client: any;
  return {
    provider: "api",
    async structured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
      if (!client) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        client = new Anthropic();
      }
      const toolName = call.toolName ?? "submit";
      const res = await client.messages.create({
        model: call.model,
        max_tokens: call.maxTokens ?? 1024,
        ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
        ...(call.system ? { system: call.system } : {}),
        tools: [{ name: toolName, description: "Submit your answer.", input_schema: call.schema }],
        tool_choice: { type: "tool", name: toolName },
        messages: [{ role: "user", content: call.prompt }],
      });
      const block = res.content.find((b: any) => b.type === "tool_use");
      if (!block) throw new Error(`model did not call ${toolName}`);
      const inputTokens = res.usage.input_tokens;
      const outputTokens = res.usage.output_tokens;
      return { data: block.input as T, inputTokens, outputTokens, costUsd: estimateCostUsd(call.model, inputTokens, outputTokens) };
    },
  };
}
