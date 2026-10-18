#!/usr/bin/env node
/**
 * Push guard: keeps workshop changes reversible on real (possibly production) repos.
 *
 * In a workshop target, an agent may only push to branches under `dev-days-workshop/`,
 * may not force-push, push tags, merge into the default branch, or open an MR/PR that
 * targets anything outside `dev-days-workshop/`. Repos that aren't workshop targets are
 * left alone. Throwaway targets (sample, catch-up) and facilitator mirrors listed in
 * `.workshop/facilitator.json` → "mirrors" are not restricted.
 *
 * Used three ways:
 *   - Claude Code PreToolUse hook (.claude/settings.json): reads the hook JSON on stdin, exit 2 blocks.
 *   - Cursor beforeShellExecution hook (.cursor/hooks.json, with --cursor): prints {"permission": …}.
 *   - Imported by .agents/assets/workshop.ts before every push it makes itself.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PREFIX = "dev-days-workshop/";
export const isWorkshopRef = (ref) => typeof ref === "string" && ref.startsWith(PREFIX) && ref.length > PREFIX.length;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Split a shell line into simple commands. Naive about quotes on purpose: it errs towards checking more. */
function segments(line) {
  return line.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
}

function tokens(seg) {
  const out = [];
  for (const m of seg.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const stripHeads = (r) => r.replace(/^refs\/heads\//, "");

/** Value of a flag given as `--flag value`, `--flag=value` or `-f value`. */
function flagValue(args, names) {
  for (let i = 0; i < args.length; i++) {
    for (const n of names) {
      if (args[i] === n) return args[i + 1] ?? "";
      if (n.startsWith("--") && args[i].startsWith(n + "=")) return args[i].slice(n.length + 1);
    }
  }
  return undefined;
}

function checkPush(args, ctx) {
  const problems = [];
  const opts = [];
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-o" || a === "--push-option" || a === "--repo" || a === "--receive-pack" || a === "--exec") {
      opts.push(`${a}=${args[i + 1] ?? ""}`);
      i++;
    } else if (a.startsWith("-")) opts.push(a);
    else pos.push(a);
  }
  const short = opts.filter((o) => /^-[a-zA-Z]+$/.test(o)).join("");
  const has = (...names) => opts.some((o) => names.some((n) => o === n || o.startsWith(n + "=")));
  if (short.includes("f") || has("--force", "--force-with-lease", "--force-if-includes")) problems.push("force-push is not allowed");
  if (has("--mirror", "--all", "--tags", "--prune")) problems.push("--mirror, --all, --tags and --prune push more than your workshop branch");
  for (const o of opts) {
    const m = /merge_request\.target=(.+)$/.exec(o);
    if (m && !isWorkshopRef(m[1])) problems.push(`the MR would target "${m[1]}"; target your workshop branch instead`);
  }
  const deleting = short.includes("d") || has("--delete");
  const refspecs = pos.slice(1);
  const targets = [];
  if (refspecs.length === 0) {
    if (!ctx.currentBranch) problems.push("pushing from a detached HEAD; name the branch explicitly");
    else targets.push(ctx.currentBranch);
  }
  for (let r of refspecs) {
    if (r.startsWith("+")) {
      problems.push(`"${r}" force-pushes`);
      r = r.slice(1);
    }
    // "src:dst" pushes src to dst; ":dst" deletes dst; a bare name pushes to the same name.
    let dst = r.includes(":") ? r.slice(r.indexOf(":") + 1) : r;
    if (dst === "HEAD") dst = ctx.currentBranch ?? "";
    if (dst.startsWith("refs/tags/")) {
      if (!isWorkshopRef(dst.slice("refs/tags/".length))) problems.push(`pushing tag "${dst}" is not allowed`);
      continue;
    }
    targets.push(stripHeads(dst));
  }
  for (const t of targets) {
    if (!isWorkshopRef(t)) problems.push(`"${t || "(unknown)"}" is outside ${PREFIX}*${deleting ? " (delete)" : ""}`);
  }
  return problems;
}

/**
 * Check one shell command line. `contextFor(dir)` returns null for repos the guard doesn't cover,
 * or { currentBranch, defaultBranch, unrestricted }.
 */
export function checkCommand(line, cwd, contextFor) {
  const problems = [];
  let dir = cwd;
  for (const seg of segments(line)) {
    const t = tokens(seg);
    if (t[0] === "cd" && t[1]) {
      dir = isAbsolute(t[1]) ? t[1] : resolve(dir, t[1]);
      continue;
    }
    if (t[0] === "git") {
      let i = 1;
      let gdir = dir;
      while (i < t.length && t[i].startsWith("-")) {
        if (t[i] === "-C") {
          gdir = isAbsolute(t[i + 1]) ? t[i + 1] : resolve(gdir, t[i + 1]);
          i += 2;
        } else if (t[i] === "-c") i += 2;
        else i++;
      }
      const sub = t[i];
      if (sub !== "push" && sub !== "merge") continue;
      const ctx = contextFor(gdir);
      if (!ctx || ctx.unrestricted) continue;
      if (sub === "push") problems.push(...checkPush(t.slice(i + 1), ctx));
      if (sub === "merge" && ctx.currentBranch && ctx.currentBranch === ctx.defaultBranch)
        problems.push(`merging into the default branch "${ctx.defaultBranch}" is not allowed`);
      continue;
    }
    const isGh = t[0] === "gh" && t[1] === "pr" && (t[2] === "create" || t[2] === "edit");
    const isGlab = t[0] === "glab" && t[1] === "mr" && (t[2] === "create" || t[2] === "update");
    if (isGh || isGlab) {
      const ctx = contextFor(dir);
      if (!ctx || ctx.unrestricted) continue;
      const names = isGh ? ["--base", "-B"] : ["--target-branch", "-b"];
      const base = flagValue(t.slice(3), names);
      const creating = t[2] === "create";
      if (base === undefined && creating) problems.push(`set ${names[0]} to your workshop branch; the default would be "${ctx.defaultBranch}"`);
      else if (base !== undefined && !isWorkshopRef(base)) problems.push(`the ${isGh ? "PR" : "MR"} would target "${base}"; target your workshop branch instead`);
    }
  }
  return { allowed: problems.length === 0, problems };
}

function git(dir, args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const commonDirCache = new Map();
function commonDir(dir) {
  if (!commonDirCache.has(dir)) commonDirCache.set(dir, git(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  return commonDirCache.get(dir);
}

/** Real context: is `dir` inside a workshop target (or a worktree of one), and on which branch? */
export function contextFor(dir) {
  if (!existsSync(dir)) return null;
  const common = commonDir(dir);
  if (!common) return null;
  const targetsDir = join(ROOT, ".workshop", "targets");
  if (!existsSync(targetsDir)) return null;
  let profile = null;
  for (const name of readdirSync(targetsDir)) {
    const f = join(targetsDir, name, "profile.json");
    if (!existsSync(f)) continue;
    const p = JSON.parse(readFileSync(f, "utf8"));
    const tdir = resolve(ROOT, p.path ?? join("targets", name));
    if (existsSync(tdir) && commonDir(tdir) === common) {
      profile = p;
      break;
    }
  }
  if (!profile) return null;
  const fac = existsSync(join(ROOT, ".workshop", "facilitator.json")) ? JSON.parse(readFileSync(join(ROOT, ".workshop", "facilitator.json"), "utf8")) : {};
  const remote = profile.remote ?? "";
  const mirror = Array.isArray(fac.mirrors) && fac.mirrors.some((m) => typeof m === "string" && m && remote.includes(m));
  return {
    currentBranch: git(dir, ["branch", "--show-current"]) || null,
    defaultBranch: profile.defaultBranch ?? "main",
    unrestricted: profile.source === "sample" || profile.source === "catchup" || mirror,
  };
}

export function explain(problems) {
  return `Blocked by the workshop push guard: ${problems.join("; ")}. Workshop work stays on ${PREFIX}<participant> branches so it can be undone (see AGENTS.md → Target safety).`;
}

async function main() {
  const cursor = process.argv.includes("--cursor");
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch {}
  const command = cursor ? input.command : input.tool_input?.command;
  const cwd = input.cwd || process.cwd();
  if (typeof command !== "string") {
    if (cursor) process.stdout.write(JSON.stringify({ permission: "ask" }));
    return;
  }
  const res = checkCommand(command, cwd, contextFor);
  if (cursor) {
    const msg = res.allowed ? undefined : explain(res.problems);
    process.stdout.write(JSON.stringify(res.allowed ? { permission: "ask" } : { permission: "deny", user_message: msg, agent_message: msg }));
    return;
  }
  if (!res.allowed) {
    process.stderr.write(explain(res.problems) + "\n");
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
