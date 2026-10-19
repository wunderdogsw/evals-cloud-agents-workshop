/**
 * Workshop helper used by the guide. Run via:  pnpm workshop <command> …
 *
 *   attach <git-url | local-path | sample> [--name n] [--participant p] [--setup broken|good|none]
 *       --setup (sample only): the sample's agent setup — broken (default), good (reference fix) or none
 *   profile <name> [--redetect]          (keeps manually corrected commands unless --redetect)
 *   install <name> <component…> [--suite s] [--force]
 *       components: evals | subject-cost-coder | ci-evals | cursor-env | agents-section | review-md | agent-tasks | agent-suite | ci-agent-evals | review-history
                   optional, only where Claude may run in CI: ci-evals-live | ci-claude | ci-review
 *   delegate <name> (--issue n | --task "…" | --task-file f) [--agent claude|cursor] [--no-push]
 *       run Claude Code or the Cursor CLI headless on a fresh branch, then push it and open an MR/PR
 *   review <name> <branch> [--agent claude|cursor] [--post]
 *       read-only agent review of a branch; --post puts it on the MR/PR via glab/gh
 *   cloud <name> (--issue n | --task "…" | --task-file f) [--launch [--yes]]
 *       push a dev-days-workshop/<participant>-cloud-… branch and write the task text for a cloud agent;
 *       --launch starts a Cursor cloud agent on it through the API (needs CURSOR_API_KEY; --yes to spend budget)
 *   cloud-check <name> <branch | MR/PR number>
 *       open the cloud agent's MR/PR into the workshop branch, ready for review, or warn when head, base or draft is wrong
 *   catchup <phase> [--participant p]
 *   ci-check <name>
 *       list CI lines that look like deploys, so nobody's push to a real repo triggers production
 *   cleanup <name> [--yes]
 *       list (dry run) or undo everything the workshop created: MRs/PRs, dev-days-workshop/* branches
 *       (remote and local), the start tag, worktrees, and the backed-up ~/.claude / ~/.cursor files
 *   status
 *
 * Safety on real repos: all work happens on dev-days-workshop/<participant> branches, every push this
 * helper makes goes through .agents/assets/push-guard.mjs, and MRs/PRs target the workshop branch,
 * never the default branch.
 */
import { execSync, spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
// @ts-ignore — plain ESM module shared with the Claude Code / Cursor hooks.
import { checkCommand, contextFor, explain, PREFIX } from "./push-guard.mjs";
import { cursorArgs, REVIEW_TIMEOUT_MS, reviewPrompt } from "./agent-cli.ts";
import { changeRequestProblems, cloudBranchName, cloudTaskPrompt, cursorAgentRequest, CURSOR_AGENTS_URL, remoteWebUrl, type ChangeRequest } from "./cloud-agent.ts";
import { backupStep, mergeBackupRecords, type BackupRecord } from "./settings-backup.ts";

/** Every workshop branch starts with this, e.g. dev-days-workshop/mikko. */
const BRANCH_PREFIX: string = PREFIX;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TARGETS = join(ROOT, "targets");
const STATE = join(ROOT, ".workshop");
const PROGRESS = join(STATE, "progress.json");
/** Backup records kept next to the backups themselves, so they outlive a reset progress.json. */
const BACKUP_INDEX = join(STATE, "backups", "index.json");
const KIT = join(ROOT, "kit");

const log = (s: string) => console.log(s);
const die = (s: string): never => {
  console.error(`✗ ${s}`);
  process.exit(1);
};

function run(cmd: string, cwd = ROOT, quiet = false): string {
  try {
    return execSync(cmd, { cwd, stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"], encoding: "utf8" }).trim();
  } catch (e: any) {
    if (quiet) return "";
    throw new Error(`${cmd}: ${e.stderr ?? e.message}`);
  }
}
const tryRun = (cmd: string, cwd = ROOT) => run(cmd, cwd, true);
/** true when the command exits 0. */
function ok(cmd: string, cwd = ROOT): boolean {
  try {
    execSync(cmd, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Push through the same guard the agent hooks use; refuses anything outside dev-days-workshop/* on real repos. */
function guardedPush(args: string, dir: string): string {
  const cmd = `git push ${args}`;
  const res = checkCommand(cmd, dir, contextFor);
  if (!res.allowed) die(explain(res.problems));
  return run(cmd, dir);
}

function readJson<T = any>(p: string, fallback: T): T {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;
}
function writeJson(p: string, v: unknown) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
}

/** Number of phases, read from the AGENTS.md phase map so it never drifts from the docs. */
function phaseCount(): number {
  const md = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
  const sec = md.split(/^## /m).find((x) => x.startsWith("Phase map"));
  const nums = [...(sec ?? "").matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[1]));
  if (!nums.length) die("AGENTS.md has no phase map");
  return Math.max(...nums);
}

function initialProgress() {
  const phases: Record<string, unknown> = {};
  const count = phaseCount();
  for (let i = 1; i <= count; i++) phases[String(i)] = { status: "not_started", startedAt: null, completedAt: null };
  return { version: 1, participant: null, activeTarget: null, targets: {}, currentPhase: 1, phases };
}

function targetDir(name: string) {
  const d = join(TARGETS, name);
  if (!existsSync(d)) die(`no target "${name}" in targets/. Run: pnpm workshop attach …`);
  return d;
}

function profileOf(name: string): Profile {
  const p = join(STATE, "targets", name, "profile.json");
  if (!existsSync(p)) die(`target "${name}" has no profile. Run: pnpm workshop profile ${name}`);
  return readJson<Profile>(p, {} as Profile);
}

// ───────────────────────────── attach ─────────────────────────────

/**
 * Leave the target checked out on the participant's workshop branch, where every phase works.
 * Refuses to switch over uncommitted changes and says how to switch by hand instead.
 */
function checkOutWorkBranch(name: string): void {
  const dir = targetDir(name);
  const want = profileOf(name).workBranch;
  const current = tryRun("git branch --show-current", dir);
  if (current === want) return log(`✓ targets/${name} is on ${want}`);
  if (tryRun("git status --porcelain", dir)) {
    return log(`! targets/${name} is on ${current || "a detached HEAD"}, not ${want}, and has uncommitted changes. Commit or stash them, then: git -C targets/${name} checkout ${want}`);
  }
  run(`git checkout -q ${want}`, dir);
  log(`✓ targets/${name} switched from ${current || "a detached HEAD"} to ${want}`);
}

function slug(s: string) {
  return s.toLowerCase().replace(/\.git$/, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "target";
}

function attach(src: string, opts: { name?: string; participant?: string; setup?: string }) {
  mkdirSync(TARGETS, { recursive: true });
  const participant = slug(opts.participant ?? (tryRun("git config user.name") || process.env.USER || "me"));
  const branch = `${BRANCH_PREFIX}${participant}`;
  // Marks where the workshop started, so `cleanup` (or a person) can see and undo everything after it.
  const startTag = `${BRANCH_PREFIX}${participant}-start`;
  const tagStart = (repo: string, at: string) => {
    if (!tryRun(`git rev-parse --verify --quiet refs/tags/${startTag}`, repo)) run(`git tag ${startTag} ${at}`, repo);
  };
  let name: string;
  let source: Profile["source"];

  if (src === "sample") {
    // Three agent setups, so each path of Phases 2–5 can be tried on the sample:
    //   broken (default) — problems added on purpose; good — the reference fix; none — no CLAUDE.md or AGENTS.md.
    const setup = opts.setup ?? "broken";
    if (!["broken", "good", "none"].includes(setup)) die(`--setup must be broken, good or none (got "${setup}")`);
    name = opts.name ?? (setup === "broken" ? "cost-coder" : `cost-coder-${setup}`);
    source = "sample";
    const dest = join(TARGETS, name);
    if (existsSync(dest)) die(`targets/${name} already exists. Pick another --name or remove it.`);
    cpSync(join(ROOT, "samples", "cost-coder"), dest, {
      recursive: true,
      filter: (p) => !/(^|\/)(node_modules|\.eval-runs|\.agent-runs)(\/|$)/.test(relative(join(ROOT, "samples"), p)),
    });
    if (setup === "good") cpSync(join(KIT, "catchup", "cost-coder", "agent-setup"), dest, { recursive: true, force: true });
    if (setup === "none") for (const f of ["CLAUDE.md", "AGENTS.md"]) rmSync(join(dest, f), { force: true });
    if (setup !== "broken") log(`✓ sample agent setup: ${setup}`);
    run(`git init -q -b main`, dest);
    run(`git add -A && git -c user.email=workshop@example.invalid -c user.name=workshop commit -qm "Initial commit: cost-coder sample"`, dest);
    tagStart(dest, "HEAD");
    run(`git checkout -q -b ${branch}`, dest);
  } else if (/^(https?:\/\/|git@|ssh:\/\/)/.test(src)) {
    name = opts.name ?? slug(basename(src));
    source = "url";
    const dest = join(TARGETS, name);
    if (existsSync(dest)) die(`targets/${name} already exists. Pick another --name or remove it.`);
    run(`git clone ${JSON.stringify(src)} ${JSON.stringify(dest)}`);
    tagStart(dest, "HEAD");
    if (tryRun(`git rev-parse --verify --quiet refs/remotes/origin/${branch}`, dest)) run(`git checkout -q -b ${branch} --track origin/${branch}`, dest);
    else run(`git checkout -q -b ${branch}`, dest);
  } else {
    const abs = resolve(src.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
    if (!existsSync(join(abs, ".git"))) die(`${abs} is not a git checkout (no .git). Give a git URL, a checkout path, or "sample".`);
    name = opts.name ?? slug(basename(abs));
    source = "local";
    const dest = join(TARGETS, name);
    if (existsSync(dest)) die(`targets/${name} already exists. Pick another --name or remove it.`);
    // A worktree keeps the participant's own checkout untouched and shares its objects and remotes.
    const exists = tryRun(`git rev-parse --verify --quiet refs/heads/${branch}`, abs);
    tagStart(abs, exists ? branch : "HEAD");
    run(`git worktree add ${exists ? "" : `-b ${branch}`} ${JSON.stringify(dest)} ${exists ? branch : ""}`.replace(/\s+/g, " "), abs);
  }

  const progress = readJson<any>(PROGRESS, initialProgress());
  progress.participant ??= participant;
  writeJson(PROGRESS, progress);
  log(`✓ attached targets/${name} (${source}) on branch ${branch}, start marked by tag ${startTag}`);
  profile(name, { source, workBranch: branch, startTag });
  checkOutWorkBranch(name);
  backupUserSettings();
  ciCheck(name);
}

/**
 * Claude Code and Cursor commands (/doctor, /update-config, /fewer-permission-prompts …) can change files
 * in the participant's home folder, outside any branch. Keep a copy of each from before the workshop.
 */
function backupUserSettings() {
  const home = homedir();
  const files = [join(home, ".claude", "settings.json"), join(home, ".claude", "CLAUDE.md"), join(home, ".cursor", "hooks.json")];
  const progress = readJson<any>(PROGRESS, initialProgress());
  // The index next to the backups keeps the records when progress.json is reset, so a restart never re-backs-up.
  const known = mergeBackupRecords(progress.backups ?? [], readJson<BackupRecord[]>(BACKUP_INDEX, []));
  const now = new Date().toISOString();
  const records = files.map((from) => {
    const to = join(STATE, "backups", relative(home, from).replace(/[\\/]/g, "__"));
    const s = backupStep({ from, to: relative(ROOT, to), known, sourceExists: existsSync(from), backupFileTime: existsSync(to) ? statSync(to).mtime.toISOString() : null, now });
    if (s.kind === "copy") {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
      log(`✓ backed up ${from.replace(home, "~")} → ${relative(ROOT, to)}`);
    }
    if (s.kind === "adopt") log(`✓ kept the earlier backup of ${from.replace(home, "~")} in ${relative(ROOT, to)} (from ${s.record.at})`);
    return s.record;
  });
  progress.backups = mergeBackupRecords(records, known);
  writeJson(PROGRESS, progress);
  writeJson(BACKUP_INDEX, progress.backups);
}

// ───────────────────────────── profile ─────────────────────────────

interface Profile {
  name: string;
  path: string;
  source: "sample" | "url" | "local" | "catchup";
  remote: string | null;
  host: "gitlab" | "github" | "none";
  hostUrl: string | null;
  projectPath: string | null;
  defaultBranch: string;
  workBranch: string;
  startTag: string | null;
  ciCheck: { checkedAt: string; verdict: string; deployLines: number } | null;
  languages: string[];
  packageManager: string | null;
  commands: { install: string | null; build: string | null; test: string | null };
  ci: { gitlab: boolean; github: boolean; files: string[]; gitlabStages: string[] | null };
  agentFiles: string[];
  llmCallSites: { file: string; line: number; text: string }[];
  history: { commits6m: number; testTouching6m: number };
  evalSubject: "target-feature" | "sample-feature" | null;
  suite: string | null;
  notes: string[];
}

function detectHost(remote: string | null, dir: string): Pick<Profile, "host" | "hostUrl" | "projectPath"> {
  if (!remote) return { host: "none", hostUrl: null, projectPath: null };
  const m = /^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/(?:[^@/]+@)?|[^@]+@)([^/:]+)(?::\d+)?[/:](.+?)(?:\.git)?\/?$/.exec(remote);
  const host = m?.[1] ?? "";
  const path = m?.[2] ?? null;
  const kind = /github/i.test(host) ? "github" : /gitlab/i.test(host) || existsSync(join(dir, ".gitlab-ci.yml")) ? "gitlab" : existsSync(join(dir, ".github")) ? "github" : "gitlab";
  return { host: kind, hostUrl: host ? `https://${host}` : null, projectPath: path };
}

function listFiles(dir: string, depth = 3, acc: string[] = [], base = dir): string[] {
  if (depth < 0) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "bin", "obj", "dist", "build", "target", ".venv", "vendor", "evals"].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) listFiles(p, depth - 1, acc, base);
    else acc.push(relative(base, p));
  }
  return acc;
}

function detectCommands(dir: string, files: string[]): Pick<Profile, "languages" | "packageManager" | "commands" | "notes"> {
  const languages = new Set<string>();
  const notes: string[] = [];
  let pm: string | null = null;
  const cmd = { install: null as string | null, build: null as string | null, test: null as string | null };
  const has = (f: string) => existsSync(join(dir, f));
  if (has("package.json")) {
    languages.add(files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx")) ? "typescript" : "javascript");
    const pkg = readJson<any>(join(dir, "package.json"), {});
    pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lockb") || has("bun.lock") ? "bun" : "npm";
    const runner = pm === "npm" ? "npm run" : pm;
    // pnpm targets without their own workspace file would be swallowed by the workshop repo's workspace.
    cmd.install = pm === "pnpm" ? (has("pnpm-workspace.yaml") ? "pnpm install" : "pnpm install --ignore-workspace") : pm === "npm" ? (has("package-lock.json") ? "npm ci" : "npm install") : `${pm} install`;
    if (pkg.scripts?.build) cmd.build = `${runner} build`;
    if (pkg.scripts?.test) cmd.test = pm === "npm" ? "npm test" : `${pm} test`;
    if (pm === "pnpm" && !has("pnpm-workspace.yaml")) notes.push("pnpm target without pnpm-workspace.yaml: install with --ignore-workspace inside the workshop repo.");
  }
  if (files.some((f) => f.endsWith(".sln") || f.endsWith(".csproj"))) {
    languages.add("csharp");
    cmd.install ??= "dotnet restore";
    cmd.build ??= "dotnet build --no-restore";
    cmd.test ??= "dotnet test";
  }
  if (has("pom.xml")) {
    languages.add("java");
    cmd.install ??= "mvn -q -DskipTests dependency:go-offline";
    cmd.build ??= "mvn -q -DskipTests package";
    cmd.test ??= "mvn -q test";
  }
  if (has("build.gradle") || has("build.gradle.kts")) {
    languages.add(has("build.gradle.kts") ? "kotlin" : "java");
    const g = has("gradlew") ? "./gradlew" : "gradle";
    cmd.build ??= `${g} build -x test`;
    cmd.test ??= `${g} test`;
  }
  if (has("pyproject.toml") || has("requirements.txt")) {
    languages.add("python");
    cmd.install ??= has("uv.lock") ? "uv sync" : has("poetry.lock") ? "poetry install" : has("requirements.txt") ? "pip install -r requirements.txt" : "pip install -e .";
    cmd.test ??= has("uv.lock") ? "uv run pytest" : "pytest";
  }
  if (has("go.mod")) {
    languages.add("go");
    cmd.build ??= "go build ./...";
    cmd.test ??= "go test ./...";
  }
  if (!languages.size) notes.push("Could not detect the stack — ask the participant for install/build/test commands.");
  return { languages: [...languages], packageManager: pm, commands: cmd, notes };
}

const LLM_PATTERNS = /(@anthropic-ai\/sdk|from anthropic import|import anthropic|Anthropic\(|openai|OpenAIClient|AzureOpenAI|bedrock-runtime|BedrockRuntime|langchain|SemanticKernel|Microsoft\.Extensions\.AI|generativeai|vertexai|ChatCompletion|messages\.create)/i;

function findLlmCallSites(dir: string, files: string[]) {
  const out: Profile["llmCallSites"] = [];
  const code = files.filter((f) => /\.(ts|tsx|js|mjs|cs|java|kt|py|go)$/.test(f) && !/(^|\/)(test|tests|__tests__|spec)\//.test(f));
  for (const f of code.slice(0, 3000)) {
    let text: string;
    try {
      if (statSync(join(dir, f)).size > 400_000) continue;
      text = readFileSync(join(dir, f), "utf8");
    } catch {
      continue;
    }
    if (!LLM_PATTERNS.test(text)) continue;
    text.split("\n").forEach((l, i) => {
      if (LLM_PATTERNS.test(l) && out.length < 25) out.push({ file: f, line: i + 1, text: l.trim().slice(0, 140) });
    });
  }
  return out;
}

/** Never store or print credentials embedded in a remote URL. */
const redact = (url: string) => url.replace(/^(\w+:\/\/)[^@/]+@/, "$1");

function profile(name: string, extra: Partial<Profile> = {}, redetect = false) {
  const dir = targetDir(name);
  const prev = readJson<Partial<Profile>>(join(STATE, "targets", name, "profile.json"), {});
  const rawRemote = tryRun("git remote get-url origin", dir);
  const remote = rawRemote ? redact(rawRemote) : null;
  const defaultBranch =
    tryRun("git symbolic-ref --short refs/remotes/origin/HEAD", dir).replace(/^origin\//, "") ||
    (tryRun("git rev-parse --verify --quiet refs/heads/main", dir) ? "main" : tryRun("git rev-parse --verify --quiet refs/heads/master", dir) ? "master" : "main");
  const files = listFiles(dir, 4);
  const det = detectCommands(dir, files);
  const ciFiles = files.filter((f) => f === ".gitlab-ci.yml" || f.startsWith(".gitlab/ci/") || f.startsWith(".github/workflows/"));
  let gitlabStages: string[] | null = null;
  if (existsSync(join(dir, ".gitlab-ci.yml"))) {
    const m = /^stages:\s*\n((?:\s+-\s*.+\n?)+)/m.exec(readFileSync(join(dir, ".gitlab-ci.yml"), "utf8"));
    gitlabStages = m ? m[1]!.split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")).filter(Boolean) : null;
  }
  const commits6m = Number(tryRun(`git rev-list --count --first-parent --since="6 months ago" HEAD`, dir) || 0);
  const testTouching6m = Number(
    tryRun(`git log --first-parent --since="6 months ago" --name-only --format=%x00 HEAD | tr '\\0' '\\n' | grep -Eic '(^|/)(tests?|__tests__|spec)/|[._-](test|spec)s?\\.' || true`, dir) || 0,
  );
  const p: Profile = {
    name,
    path: relative(ROOT, dir),
    source: (extra.source ?? prev.source ?? "url") as Profile["source"],
    remote,
    ...detectHost(remote, dir),
    defaultBranch,
    workBranch: extra.workBranch ?? prev.workBranch ?? (tryRun("git branch --show-current", dir) || `${BRANCH_PREFIX}me`),
    startTag: extra.startTag ?? prev.startTag ?? null,
    ciCheck: prev.ciCheck ?? null,
    ...det,
    // Phase 1.4 corrections survive re-profiling.
    commands: !redetect && prev.commands ? prev.commands : det.commands,
    ci: { gitlab: existsSync(join(dir, ".gitlab-ci.yml")), github: existsSync(join(dir, ".github", "workflows")), files: ciFiles, gitlabStages },
    agentFiles: files.filter((f) => /(^|\/)(AGENTS\.md|CLAUDE\.md|\.cursorrules)$/.test(f) || f.startsWith(".cursor/rules/") || f.startsWith(".claude/")),
    llmCallSites: findLlmCallSites(dir, files),
    history: { commits6m, testTouching6m },
    evalSubject: prev.evalSubject ?? (extra.source === "sample" ? "target-feature" : null),
    suite: prev.suite ?? (extra.source === "sample" ? "cost-coder" : null),
    notes: det.notes,
  };
  if (p.host === "none") p.notes.push("No git remote: Day 1 works locally, Day 2 needs the target pushed to GitLab or GitHub.");
  writeJson(join(STATE, "targets", name, "profile.json"), p);
  const progress = readJson<any>(PROGRESS, initialProgress());
  progress.targets[name] = { profile: `.workshop/targets/${name}/profile.json`, host: p.host, evalSubject: p.evalSubject, suite: p.suite };
  progress.activeTarget = name;
  writeJson(PROGRESS, progress);
  log(JSON.stringify(p, null, 2));
  log(`\n✓ profile → .workshop/targets/${name}/profile.json (active target: ${name})`);
}

// ───────────────────────────── install ─────────────────────────────

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/__([A-Z_]+)__/g, (m, k) => (k in vars ? vars[k]! : m));
}

function copyTemplate(src: string, dest: string, vars: Record<string, string>, force: boolean): "written" | "exists" {
  if (existsSync(dest) && !force) return "exists";
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, fill(readFileSync(src, "utf8"), vars));
  return "written";
}

function ensureGitlabInclude(dir: string, localPath: string, p: Profile, stage: string): string[] {
  const ci = join(dir, ".gitlab-ci.yml");
  const line = `  - local: ${localPath}`;
  const out: string[] = [];
  if (!existsSync(ci)) {
    writeFileSync(ci, `stages:\n  - build\n  - test\n\ninclude:\n${line}\n`);
    return ["created .gitlab-ci.yml"];
  }
  const text = readFileSync(ci, "utf8");
  if (text.includes(localPath)) out.push(".gitlab-ci.yml already includes it");
  else if (/^include:\s*$/m.test(text)) {
    writeFileSync(ci, text.replace(/^include:\s*$/m, `include:\n${line}`));
    out.push("added to existing include: list");
  } else if (/^include:/m.test(text)) out.push(`MANUAL: .gitlab-ci.yml has a non-list include:. Add "${line.trim()}" to it by hand.`);
  else {
    writeFileSync(ci, text.replace(/\s*$/, "\n") + `\ninclude:\n${line}\n`);
    out.push("appended include:");
  }
  const stages = p.ci.gitlabStages;
  if (stages && !stages.includes(stage)) out.push(`CHECK: stages are [${stages.join(", ")}] — this job uses stage "${stage}". Add it or change the job's stage.`);
  if (/^workflow:/m.test(text)) out.push("CHECK: .gitlab-ci.yml has workflow: rules — make sure merge_request_event (and web/api for the agent) pipelines are allowed.");
  return out;
}

/** Agent files the agent-eval recording tracks, when the target has them. */
const AGENT_TRACK_CANDIDATES = ["CLAUDE.md", "AGENTS.md", ".claude", ".cursor/rules", ".cursor/hooks.json", ".cursor/hooks", ".mcp.json"];

/** Copy the eval runner into <target>/evals/ so CI can run `pnpm verify` without the workshop repo. */
function vendorRunner(ev: string, T: string, vars: Record<string, string>, force: boolean, done: string[]) {
  for (const f of ["package.json", "README.md", ".gitignore", "pnpm-workspace.yaml"]) done.push(`evals/${f}: ${copyTemplate(join(T, "evals-folder", f), join(ev, f), vars, force)}`);
  mkdirSync(join(ev, "runner"), { recursive: true });
  for (const f of readdirSync(join(KIT, "evals", "src"))) {
    const body = readFileSync(join(KIT, "evals", "src", f), "utf8");
    writeFileSync(join(ev, "runner", f), `// Vendored from the Evals & Cloud Agents Workshop kit (kit/evals/src/${f}). Update there, not here.\n${body.replace(/^#!.*\n/, "")}`);
  }
  done.push("evals/runner/: vendored");
}

function install(name: string, components: string[], opts: { suite?: string; force?: boolean }) {
  for (const c of components) installOne(name, c, opts);
}

function installOne(name: string, component: string, opts: { suite?: string; force?: boolean }) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const suite = opts.suite ?? p.suite ?? "main";
  const vars = {
    SUITE: suite,
    TARGET_INSTALL: p.evalSubject === "target-feature" && p.languages.some((l) => l === "typescript" || l === "javascript") ? (p.commands.install ?? "").replace(" --ignore-workspace", "") : "",
    DEFAULT_BRANCH: p.defaultBranch,
    INSTALL: (p.commands.install ?? "TODO").replace(" --ignore-workspace", ""),
    BUILD: p.commands.build ?? "n/a",
    TEST: p.commands.test ?? "TODO",
    PROJECT_SPECIFIC: "TODO: the one rule an outsider always gets wrong in this codebase.",
  };
  const T = join(KIT, "templates");
  const done: string[] = [];
  const force = Boolean(opts.force);

  switch (component) {
    case "evals": {
      const ev = join(dir, "evals");
      vendorRunner(ev, T, vars, force, done);
      const sdir = join(ev, "suites", suite);
      if (!existsSync(sdir)) {
        mkdirSync(sdir, { recursive: true });
        writeFileSync(join(sdir, "suite.ts"), readFileSync(join(T, "evals-folder", "suites", "example", "suite.ts"), "utf8").replace('name: "example"', `name: "${suite}"`));
        cpSync(join(T, "evals-folder", "suites", "example", "cases.jsonl"), join(sdir, "cases.jsonl"));
        done.push(`evals/suites/${suite}/: skeleton`);
      } else done.push(`evals/suites/${suite}/: exists`);
      done.push(ok(`pnpm install`, ev) ? "evals/: pnpm install done" : "evals/: run `pnpm install` there by hand (corepack enable first)");
      break;
    }
    case "agent-suite": {
      // Phase 9 on: rule graders, rubrics and (from Phase 14) the CI recording for the agent evals.
      const sdir = join(dir, "evals", "suites", "agent");
      const tracks = AGENT_TRACK_CANDIDATES.filter((t) => existsSync(join(dir, t))).map((t) => `../../../${t}`);
      const agentVars = { ...vars, TRACKS: JSON.stringify(tracks) };
      for (const f of ["README.md", "rules.mjs", "agent-suite.json"]) done.push(`evals/suites/agent/${f}: ${copyTemplate(join(T, "agent-suite", f), join(sdir, f), agentVars, force)}`);
      if (!tracks.length) done.push("NOTE: no agent files found to track; add them to agent-suite.json → tracks");
      break;
    }
    case "ci-agent-evals": {
      // The agent-eval gate: verifies evals/suites/agent/last-run.json. No model or secrets in CI.
      if (!existsSync(join(dir, "evals", "suites", "agent", "agent-suite.json"))) die("install `agent-suite` first");
      vendorRunner(join(dir, "evals"), T, vars, force, done);
      done.push(ok(`pnpm install`, join(dir, "evals")) ? "evals/: pnpm install done" : "evals/: run `pnpm install` there by hand (corepack enable first)");
      const file = "workshop-agent-evals.yml";
      if (p.host === "github") {
        done.push(`.github/workflows/${file}: ${copyTemplate(join(T, "ci", "github", file), join(dir, ".github", "workflows", file), vars, force)}`);
      } else {
        const rel = `.gitlab/ci/${file}`;
        done.push(`${rel}: ${copyTemplate(join(T, "ci", "gitlab", file), join(dir, rel), vars, force)}`);
        done.push(...ensureGitlabInclude(dir, rel, p, "test"));
        if (p.host === "none") done.push("NOTE: target has no remote yet — CI runs once it's pushed to GitLab.");
      }
      break;
    }
    case "subject-cost-coder": {
      // For targets with no LLM feature of their own: vendor the sample feature into evals/subject/.
      const sub = join(dir, "evals", "subject", "cost-coder");
      if (!existsSync(join(dir, "evals"))) die("install `evals` first");
      mkdirSync(sub, { recursive: true });
      for (const f of ["classify.ts", "codes.ts"]) cpSync(join(ROOT, "samples", "cost-coder", "src", f), join(sub, f));
      cpSync(join(ROOT, "samples", "cost-coder", "src", "llm"), join(sub, "llm"), { recursive: true });
      cpSync(join(ROOT, "samples", "cost-coder", "data"), join(sub, "data"), { recursive: true });
      done.push("evals/subject/cost-coder/: classify.ts, codes.ts, llm/, data/ — import from ../../subject/cost-coder/classify.ts");
      break;
    }
    case "ci-evals":
    case "ci-evals-live":
    case "ci-claude":
    case "ci-review": {
      // ci-evals is the default gate (verifies a committed recording; no model or secrets in CI).
      // ci-evals-live / ci-claude / ci-review run Claude inside CI — only where the organisation allows a CI credential.
      const file = {
        "ci-evals": "workshop-evals.yml",
        "ci-evals-live": "workshop-evals-live.yml",
        "ci-claude": p.host === "github" ? "workshop-claude.yml" : "workshop-claude-agent.yml",
        "ci-review": "workshop-claude-review.yml",
      }[component]!;
      if (p.host === "github") {
        done.push(`.github/workflows/${file}: ${copyTemplate(join(T, "ci", "github", file), join(dir, ".github", "workflows", file), vars, force)}`);
      } else {
        const rel = `.gitlab/ci/${file}`;
        done.push(`${rel}: ${copyTemplate(join(T, "ci", "gitlab", file), join(dir, rel), vars, force)}`);
        done.push(...ensureGitlabInclude(dir, rel, p, component === "ci-claude" ? "build" : "test"));
        if (p.host === "none") done.push("NOTE: target has no remote yet — CI runs once it's pushed to GitLab.");
      }
      break;
    }
    case "cursor-env": {
      const node = p.languages.every((l) => l === "typescript" || l === "javascript") && p.languages.length > 0;
      done.push(`.cursor/environment.json: ${copyTemplate(join(T, "cursor", node ? "environment.node.json" : "environment.dockerfile.json"), join(dir, ".cursor", "environment.json"), { ...vars, TARGET_INSTALL: (p.commands.install ?? "true").replace(" --ignore-workspace", "") }, force)}`);
      if (!node) done.push(`.cursor/Dockerfile: ${copyTemplate(join(T, "cursor", "Dockerfile.example"), join(dir, ".cursor", "Dockerfile"), vars, force)}`);
      // Cursor builds the VM from this file on the host's default branch only, not on the branch the agent starts on.
      const remoteDefault = p.remote ? tryRun("git ls-remote --symref origin HEAD", dir).match(/refs\/heads\/(\S+)\s+HEAD/)?.[1] : undefined;
      const defaultBranch = remoteDefault ?? p.defaultBranch;
      if (contextFor(dir)?.unrestricted) done.push(`! Cursor reads .cursor/environment.json only from ${defaultBranch}, the default branch${remoteDefault ? " on the host" : ""}. This target is throwaway, so commit the file on ${defaultBranch} and push it (confirm first).`);
      else done.push(`! Cursor reads .cursor/environment.json only from ${defaultBranch}, the default branch, and the workshop never commits there on a real repo. Put the install command in Cursor's saved environment instead (the setup Cursor offers when you start a cloud agent): ${p.commands.install ?? "your install command"}`);
      break;
    }
    case "agents-section": {
      const f = join(dir, "AGENTS.md");
      const section = fill(readFileSync(join(T, "agents-md", "agent-section.md"), "utf8"), vars);
      const cur = existsSync(f) ? readFileSync(f, "utf8") : `# AGENTS.md — ${name}\n`;
      if (cur.includes("workshop:agent-section") && !force) done.push("AGENTS.md: section already present");
      else {
        writeFileSync(f, cur.replace(/\s*$/, "\n\n") + section);
        done.push("AGENTS.md: section appended");
      }
      // Claude Code reads CLAUDE.md; Cursor reads AGENTS.md. Make sure both see the same instructions.
      const claude = join(dir, "CLAUDE.md");
      if (!existsSync(claude)) {
        writeFileSync(claude, "@AGENTS.md\n");
        done.push("CLAUDE.md: created (imports AGENTS.md)");
      } else if (!/AGENTS\.md/.test(readFileSync(claude, "utf8"))) {
        writeFileSync(claude, readFileSync(claude, "utf8").replace(/\s*$/, "\n\n") + "@AGENTS.md\n");
        done.push("CLAUDE.md: added @AGENTS.md import");
      }
      break;
    }
    case "review-md":
      done.push(`REVIEW.md: ${copyTemplate(join(T, "agents-md", "REVIEW.md"), join(dir, "REVIEW.md"), vars, force)}`);
      break;
    case "agent-tasks": {
      if (p.source !== "sample" && p.source !== "catchup") die("agent-tasks fixtures exist only for the sample target. For your repo: pnpm agent-evals mine …");
      const dest = join(STATE, "targets", name, "agent-tasks");
      cpSync(join(KIT, "agent-evals", "fixtures", "cost-coder"), dest, { recursive: true, force: true });
      done.push(`.workshop/targets/${name}/agent-tasks/tasks.jsonl (hidden tests stay outside the target)`);
      break;
    }
    case "review-history": {
      // Phase 16: the sample has no pull requests, so the review-lessons skill reads this made-up history instead of `gh api`.
      if (p.source !== "sample" && p.source !== "catchup") die("review-history exists only for the sample target. For your repo, the skill reads merged PRs/MRs with gh api or glab api.");
      const dest = join(STATE, "targets", name, "review-history");
      cpSync(join(KIT, "catchup", "cost-coder", "review-history"), dest, { recursive: true, force: true });
      done.push(`.workshop/targets/${name}/review-history/ (pulls.json and per-PR comments in gh api shapes; outside the target)`);
      break;
    }
    default:
      die(`unknown component "${component}"`);
  }
  for (const d of done) log(d.startsWith("! ") ? d : `✓ ${d}`);
}

// ───────────────────────────── catchup ─────────────────────────────

function catchup(phase: number, participant?: string) {
  const count = phaseCount();
  if (!(Number.isInteger(phase) && phase >= 2 && phase <= count)) die(`catchup <phase>: phase 2–${count} = the phase you want to START`);
  let name = "cost-coder-catchup";
  for (let i = 2; existsSync(join(TARGETS, name)); i++) name = `cost-coder-catchup-${i}`;
  attach("sample", { name, participant });
  const dir = join(TARGETS, name);
  const p = profileOf(name);
  writeJson(join(STATE, "targets", name, "profile.json"), { ...p, source: "catchup", evalSubject: "target-feature", suite: "cost-coder" });
  if (p.commands.install) log(ok(p.commands.install, dir) ? `✓ ${p.commands.install}` : `! ${p.commands.install} failed — run it in targets/${name}`);
  // This is a throwaway sample: reference work goes straight onto main, so a later push of main carries it.
  run(`git checkout -q main`, dir);
  const commit = (m: string) => run(`git add -A && git -c user.email=workshop@example.invalid -c user.name=workshop commit -qm ${JSON.stringify(m)} --allow-empty`, dir);

  // Evals section reference work (Phases 4–7): the fixed agent setup and the expectations.
  const setup = join(KIT, "catchup", "cost-coder", "agent-setup");
  const copy = (rel: string) => cpSync(join(setup, rel), join(dir, rel), { recursive: true, force: true });
  if (phase > 4) {
    for (const rel of ["CLAUDE.md", "AGENTS.md", ".claude/rules"]) copy(rel);
    commit("workshop: fix agent instructions (catch-up)");
  }
  if (phase > 5) {
    for (const rel of [".claude/skills", ".claude/hooks", ".claude/settings.json"]) copy(rel);
    commit("workshop: agent skill, hook and permissions (catch-up)");
  }
  if (phase > 6) {
    cpSync(join(KIT, "catchup", "cost-coder", "expectations.md"), join(STATE, "targets", name, "expectations.md"));
    log(`✓ .workshop/targets/${name}/expectations.md (reference)`);
  }
  if (phase > 7) install(name, ["agent-tasks"], {});
  // Phase 16 on: the review history the review-lessons skill reads.
  if (phase >= 16) install(name, ["review-history"], {});
  if (phase > 8) {
    // Facilitators record the sample's baseline runs before the workshop (see kit/catchup/cost-coder/baseline/README.md).
    const base = join(KIT, "catchup", "cost-coder", "baseline");
    const runs = existsSync(base) ? readdirSync(base).filter((d) => existsSync(join(base, d, "results.json"))) : [];
    for (const d of runs) cpSync(join(base, d), join(ROOT, ".eval-runs", d), { recursive: true, force: true });
    log(runs.length ? `✓ .eval-runs/: precomputed baseline (${runs.join(", ")})` : "! No precomputed baseline in kit/catchup/cost-coder/baseline/ — run Phase 8's two runs now, or ask a facilitator.");
  }
  // Phases 9–14 reference work: the agent suite folder with rules, rubrics and threshold.
  const suiteRef = join(KIT, "catchup", "cost-coder", "agent-suite");
  const suiteDir = join(dir, "evals", "suites", "agent");
  if (phase > 9) {
    install(name, ["agent-suite"], {});
    cpSync(join(suiteRef, "rules.mjs"), join(suiteDir, "rules.mjs"));
    commit("workshop: rule graders (catch-up)");
  }
  if (phase > 10) {
    for (const f of ["rubric-r5.md", "rubric-r6.md"]) cpSync(join(suiteRef, f), join(suiteDir, f));
    commit("workshop: judge rubrics (catch-up)");
  }
  if (phase > 13) {
    cpSync(join(suiteRef, "agent-suite.json"), join(suiteDir, "agent-suite.json"));
    commit("workshop: agent eval threshold (catch-up)");
  }

  if (phase > 18) {
    install(name, ["agents-section", "review-md"], {});
    commit("workshop: agent instructions (catch-up)");
  }
  run(`git checkout -q -B ${p.workBranch}`, dir);
  checkOutWorkBranch(name);

  // CI and cloud-agent files depend on the host, which is unknown until the sample is pushed somewhere.
  const later = [phase > 14 && "ci-agent-evals", phase > 16 && "cursor-env"].filter(Boolean) as string[];

  const progress = readJson<any>(PROGRESS, initialProgress());
  const now = new Date().toISOString();
  for (let i = 1; i <= count; i++) progress.phases[String(i)] ??= { status: "not_started", startedAt: null, completedAt: null };
  for (let i = 1; i < phase; i++) {
    const ph = progress.phases[String(i)];
    if (ph.status !== "complete") Object.assign(ph, { status: "complete", completedAt: now, note: "catch-up" });
  }
  progress.currentPhase = phase;
  progress.activeTarget = name;
  if (later.length) progress.targets[name] = { ...progress.targets[name], pendingInstall: later };
  writeJson(PROGRESS, progress);
  log(`\n✓ catch-up target targets/${name} ready to start Phase ${phase}.`);
  if (later.length) {
    log(`! Needs a remote first (Phase 14 doc, "No remote yet"). Then, on main:`);
    log(`    pnpm workshop profile ${name}`);
    log(`    pnpm workshop install ${name} ${later.join(" ")}`);
    log(`    cd targets/${name} && git checkout main && git add -A && git commit -m "workshop: CI + agents (catch-up)" && git push && git checkout ${p.workBranch} && git merge -q main`);
  }
  if (phase > 14) {
    log(`! The agent gate needs a recording made with your own Claude Code or Cursor login:`);
    log(`    pnpm agent-evals run targets/${name} --tasks .workshop/targets/${name}/agent-tasks/tasks.jsonl --agent claude --setup "pnpm install --ignore-workspace" --record targets/${name}/evals/suites/agent`);
  }
}

// ───────────────────────────── delegate / review ─────────────────────────────
// Tool-agnostic agents that run from the participant's machine with their own login (Claude Code or Cursor CLI)
// and push results to GitLab/GitHub with their own git credentials. No model credential ever goes into CI.

type AgentCli = "claude" | "cursor";

function onPath(bin: string): boolean {
  return ok(`command -v ${bin}`);
}

function pickAgent(requested?: string): AgentCli {
  if (requested === "claude" || requested === "cursor") return requested;
  if (requested) die(`--agent must be claude or cursor (got ${requested})`);
  if (onPath("claude")) return "claude";
  if (onPath("agent")) return "cursor";
  return die("Neither Claude Code (`claude`) nor the Cursor CLI (`agent`) is installed. Install one and log in.");
}

/** Run a CLI with an argument array (no shell), streaming its stderr so the participant sees progress. */
function runArgs(cmd: string, args: string[], cwd: string, timeoutMs = 60 * 60_000): { code: number | null; stdout: string; timedOut: boolean } {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  const timedOut = r.error !== undefined && "code" in r.error && r.error.code === "ETIMEDOUT";
  return { code: r.status, stdout: r.stdout ?? "", timedOut };
}

function lastJson(s: string): any {
  for (const line of s.trim().split("\n").reverse()) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  return {};
}

/** The push guard as a Claude Code hook, for headless runs that start outside the workshop repo. */
const GUARD_SETTINGS = JSON.stringify({
  hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: `node ${JSON.stringify(join(ROOT, ".agents", "assets", "push-guard.mjs"))}` }] }] },
});

function agentRun(agent: AgentCli, prompt: string, cwd: string, mode: "write" | "read"): { ok: boolean; summary: string; costUsd?: number } {
  const timeoutMs = mode === "read" ? REVIEW_TIMEOUT_MS : undefined;
  const timedOut = { ok: false, summary: `${agent} did not finish within ${Math.round((timeoutMs ?? 0) / 60_000)} minutes and was stopped.` };
  if (agent === "claude") {
    const args =
      mode === "write"
        ? ["-p", prompt, "--output-format", "json", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash", "--max-turns", "80", "--settings", GUARD_SETTINGS]
        : ["-p", prompt, "--output-format", "json", "--permission-mode", "dontAsk", "--allowedTools", "Read,Glob,Grep,Bash(git diff *),Bash(git log *),Bash(git show *)", "--max-turns", "30"];
    const r = runArgs("claude", args, cwd, timeoutMs);
    if (r.timedOut) return timedOut;
    const out = lastJson(r.stdout);
    return { ok: r.code === 0 && out.subtype === "success", summary: String(out.result ?? out.subtype ?? "no output"), costUsd: out.total_cost_usd };
  }
  const r = runArgs("agent", cursorArgs(prompt, mode), cwd, timeoutMs);
  if (r.timedOut) return timedOut;
  const out = lastJson(r.stdout);
  return { ok: r.code === 0, summary: String(out.result ?? "no output") };
}

const oneLine = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

function fetchIssue(p: Profile, dir: string, n: string): { title: string; body: string } {
  if (p.host === "gitlab" && onPath("glab")) {
    const j = JSON.parse(run(`glab issue view ${Number(n)} --output json`, dir));
    return { title: j.title, body: j.description ?? "" };
  }
  if (p.host === "github" && onPath("gh")) {
    const j = JSON.parse(run(`gh issue view ${Number(n)} --json title,body`, dir));
    return { title: j.title, body: j.body ?? "" };
  }
  return die(`Can't read issue #${n}: need ${p.host === "github" ? "gh" : "glab"} installed and logged in. Or pass the text with --task / --task-file.`);
}

/** The task for an agent: an issue from the host, a file whose first line is the title, or text. */
function taskOf(p: Profile, dir: string, o: { task?: string; taskFile?: string; issue?: string }, cmd: string): { title: string; body: string } {
  if (o.issue) return fetchIssue(p, dir, o.issue);
  if (o.taskFile) {
    const body = readFileSync(o.taskFile, "utf8");
    return { title: oneLine(body.split("\n")[0]!.replace(/^#+\s*/, ""), 70), body };
  }
  if (o.task) return { title: oneLine(o.task, 70), body: o.task };
  return die(`${cmd} needs --issue <n>, --task "…" or --task-file <file>`);
}

function delegate(name: string, o: { task?: string; taskFile?: string; issue?: string; agent?: string; push?: boolean }) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const agent = pickAgent(o.agent);
  const { title, body } = taskOf(p, dir, o, "delegate");

  // Agent work branches off the participant's workshop branch and its MR/PR targets that branch,
  // so nothing an agent does can land on the default branch of a real repo.
  const hasRemote = Boolean(p.remote);
  if (hasRemote) {
    if (!tryRun(`git ls-remote --heads origin ${p.workBranch}`, dir)) guardedPush(`-u origin ${p.workBranch}`, dir);
    tryRun(`git fetch -q origin ${p.workBranch}`, dir);
  }
  const base = hasRemote ? `origin/${p.workBranch}` : p.workBranch;
  const branch = `${p.workBranch}-agent-${agent}-${o.issue ? `issue-${o.issue}-` : ""}${slug(title).slice(0, 30)}-${Date.now().toString(36).slice(-4)}`;
  const wt = join(tmpdir(), "workshop-delegate", branch.replace(/\//g, "_"));
  run(`git worktree add -q -b ${branch} ${JSON.stringify(wt)} ${base}`, dir);
  log(`✓ ${agent} works in ${wt} on ${branch} (from ${base})`);
  if (p.commands.install) log(ok(p.commands.install, wt) ? `✓ ${p.commands.install}` : `! ${p.commands.install} failed — the agent will have to cope`);
  if (existsSync(join(wt, "evals", "package.json"))) ok("pnpm install --silent", join(wt, "evals"));

  const prompt = `${o.issue ? `Issue #${o.issue}: ` : ""}${title}

${body}

You are working unattended on branch ${branch}; nobody can answer questions, so make reasonable assumptions and list them at the end.
- Follow AGENTS.md / CLAUDE.md.
- Run the tests.
- Do not edit evals/suites/agent/ (rule graders, rubrics, thresholds, last-run.json). If evals/suites/agent/last-run.json exists, run the agent eval gate exactly as CI will: \`pnpm --dir evals verify suites/agent\`. If it says "stale" because you changed an agent file (CLAUDE.md, AGENTS.md, .claude/, .cursor/), say so in your summary: a person must record the agent evals again.
- Commit your work with clear messages. Do not push.
- Finish with a short summary: what you changed, what you assumed, what you did not do.`;
  log(`… running ${agent} (this can take several minutes)`);
  const t0 = Date.now();
  const res = agentRun(agent, prompt, wt, "write");
  log(`${res.ok ? "✓" : "!"} ${agent} finished in ${Math.round((Date.now() - t0) / 1000)}s${res.costUsd ? ` (≈$${res.costUsd.toFixed(2)} API-equivalent)` : ""}`);

  run(`git add -A`, wt);
  tryRun(`git -c user.name=${JSON.stringify(`${agent} agent (via ${tryRun("git config user.name") || "workshop"})`)} commit -qm ${JSON.stringify(`${agent}: ${title}`)} --no-verify`, wt);
  const commits = Number(tryRun(`git rev-list --count ${base}..HEAD`, wt) || 0);
  writeFileSync(join(wt, "..", `${branch.replace(/\//g, "_")}.summary.md`), res.summary);
  if (!commits) return die(`${agent} made no changes. Its summary:\n${res.summary}`);
  log(`\n${res.summary}\n`);

  if (o.push === false || !hasRemote) {
    log(`✓ ${commits} commit(s) on ${branch}${hasRemote ? "" : " — no remote, so nothing pushed"}. Workspace: ${wt}`);
    return;
  }
  const mrTitle = `${agent === "claude" ? "Claude" : "Cursor"}: ${title}`;
  if (p.host === "gitlab") {
    guardedPush(
      `-q -u origin ${branch} -o merge_request.create -o merge_request.target=${p.workBranch} ` +
        `-o merge_request.title=${JSON.stringify(oneLine(mrTitle, 120))} -o merge_request.label=agent:${agent} ` +
        `-o merge_request.description=${JSON.stringify(oneLine(`Delegated to ${agent} from the workshop.${o.issue ? ` Refs #${o.issue}.` : ""} Agent summary is in the first comment / commit message.`, 300))}`,
      wt,
    );
    log(`✓ pushed ${branch} and opened an MR into ${p.workBranch} (GitLab prints its link above). Paste the summary above as the first MR comment.`);
  } else {
    guardedPush(`-q -u origin ${branch}`, wt);
    if (onPath("gh")) {
      const bodyFile = join(wt, "..", `${branch.replace(/\//g, "_")}.summary.md`);
      log(run(`gh pr create --base ${p.workBranch} --head ${branch} --title ${JSON.stringify(mrTitle)} --body-file ${JSON.stringify(bodyFile)}`, wt));
    } else log(`✓ pushed ${branch}. Open the PR into ${p.workBranch}: ${p.hostUrl}/${p.projectPath}/compare/${p.workBranch}...${branch}`);
  }
  log(`Workspace kept at ${wt} (git worktree of targets/${name}).`);
}

function review(name: string, branch: string, o: { agent?: string; post?: boolean }) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const agent = pickAgent(o.agent);
  if (p.remote) tryRun(`git fetch -q origin ${p.workBranch} ${branch}`, dir);
  const head = p.remote ? `origin/${branch}` : branch;
  // Agent MRs/PRs target the workshop branch, so that's what the review compares against.
  const base = p.remote ? `origin/${p.workBranch}` : p.workBranch;
  const wt = join(tmpdir(), "workshop-review", slug(branch));
  if (existsSync(wt)) tryRun(`git worktree remove --force ${JSON.stringify(wt)}`, dir);
  run(`git worktree add -q --detach ${JSON.stringify(wt)} ${head}`, dir);
  const prompt = reviewPrompt(base, runArgs("git", ["diff", `${base}...HEAD`], wt).stdout);
  log(`… ${agent} is reviewing ${branch}`);
  const res = agentRun(agent, prompt, wt, "read");
  const md = `### 🤖 ${agent === "claude" ? "Claude" : "Cursor"} review\n\n${res.summary}\n`;
  const out = join(tmpdir(), "workshop-review", `${slug(branch)}.md`);
  writeFileSync(out, md);
  log(`\n${md}\n→ ${out}`);
  tryRun(`git worktree remove --force ${JSON.stringify(wt)}`, dir);
  if (!o.post) return log("Add --post to put this on the MR/PR (uses your glab/gh login).");
  if (p.host === "gitlab" && onPath("glab")) log(run(`glab mr note ${branch} --message ${JSON.stringify(md)}`, dir) || "✓ posted");
  else if (p.host === "github" && onPath("gh")) log(run(`gh pr comment ${branch} --body-file ${JSON.stringify(out)}`, dir) || "✓ posted");
  else log(`! no ${p.host === "github" ? "gh" : "glab"} CLI — paste ${out} into the MR/PR by hand.`);
}

// ───────────────────────────── cloud agents ─────────────────────────────

/**
 * Prepare a cloud agent's branch and task. The branch is created from the remote workshop branch and
 * pushed through the push guard here, because the guard does not run on the agent's VM. With --launch and
 * CURSOR_API_KEY it also starts a Cursor cloud agent on that branch through the Cloud Agents API.
 */
async function cloud(name: string, o: { task?: string; taskFile?: string; issue?: string; launch?: boolean; yes?: boolean }): Promise<void> {
  const dir = targetDir(name);
  const p = profileOf(name);
  if (!p.remote) die(`targets/${name} has no remote. A cloud agent clones the repo from its host, so push the workshop branch first (Phase 14, "No remote yet").`);
  const key = process.env.CURSOR_API_KEY;
  if (o.launch && !key) {
    die("--launch needs CURSOR_API_KEY set in your shell: a Cursor dashboard API key. The Cursor CLI login does not work with the Cloud Agents API. Without a key, run this command without --launch and start the agent from Cursor's Cloud dropdown.");
  }
  const { title, body } = taskOf(p, dir, o, "cloud");
  const branch = cloudBranchName(p.workBranch, slug(title), Date.now().toString(36).slice(-4));
  const prompt = cloudTaskPrompt({ title: o.issue ? `Issue #${o.issue}: ${title}` : title, body, branch, base: p.workBranch });
  if (o.launch && !o.yes) {
    log(`Would push ${branch} and start a Cursor cloud agent on it (${remoteWebUrl(p.remote!)}). This spends Cursor cloud-agent budget.`);
    return log("Run the same command again with --yes to start it.");
  }

  tryRun(`git fetch -q origin ${p.workBranch}`, dir);
  if (!tryRun(`git rev-parse --verify --quiet refs/remotes/origin/${p.workBranch}`, dir)) die(`origin has no ${p.workBranch} yet. Push it first: git -C targets/${name} push -u origin ${p.workBranch}`);
  run(`git branch --no-track ${branch} origin/${p.workBranch}`, dir);
  guardedPush(`-q origin ${branch}`, dir);
  log(`✓ pushed ${branch} from origin/${p.workBranch}`);
  const promptFile = join(STATE, "targets", name, "cloud", `${slug(branch)}.md`);
  mkdirSync(dirname(promptFile), { recursive: true });
  writeFileSync(promptFile, prompt + "\n");
  log(`✓ task text → ${relative(ROOT, promptFile)}`);
  const check = `pnpm workshop cloud-check ${name} ${branch}`;

  if (!o.launch) {
    log(`\nStart the agent from Cursor: Agent input → Cloud, repo ${remoteWebUrl(p.remote!)}, branch ${branch}, and paste the task text.`);
    log(`For a Claude Code cloud session (GitHub only), start it on ${branch} with the same task text.`);
    return log(`When the agent has pushed: ${check}`);
  }
  const res = await fetch(CURSOR_AGENTS_URL, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, "content-type": "application/json" },
    body: JSON.stringify(cursorAgentRequest({ name: title, prompt, remote: p.remote!, branch })),
  });
  const text = await res.text();
  if (!res.ok) die(`Cursor Cloud Agents API answered ${res.status}: ${text.slice(0, 300)}`);
  const started: { agent?: { id?: string; url?: string } } = JSON.parse(text);
  log(`✓ Cursor cloud agent ${started.agent?.id ?? ""} started: ${started.agent?.url ?? "see cursor.com/agents"}`);
  log(`When it has pushed: ${check}`);
}

/** The MR/PR for a branch name or number, as the host CLI reports it; null when there is none. */
function changeRequestOf(p: Profile, dir: string, ref: string): (ChangeRequest & { id: string }) | null {
  if (p.host === "gitlab") {
    const out = tryRun(`glab mr view ${JSON.stringify(ref)} -F json`, dir);
    if (!out) return null;
    const j = JSON.parse(out);
    return { id: String(j.iid), head: j.source_branch, base: j.target_branch, isDraft: Boolean(j.draft ?? j.work_in_progress), url: j.web_url };
  }
  const out = tryRun(`gh pr view ${JSON.stringify(ref)} --json number,headRefName,baseRefName,isDraft,url`, dir);
  if (!out) return null;
  const j = JSON.parse(out);
  return { id: String(j.number), head: j.headRefName, base: j.baseRefName, isDraft: j.isDraft, url: j.url };
}

/**
 * After a cloud agent has pushed: open its MR/PR into the workshop branch, ready for review, if there is
 * none yet; otherwise warn when the head, the base or the draft state is wrong, with the command that fixes it.
 */
function cloudCheck(name: string, ref: string): void {
  const dir = targetDir(name);
  const p = profileOf(name);
  if (p.host === "none") die(`targets/${name} has no GitHub or GitLab remote, so there is no MR/PR to check.`);
  if (!onPath(p.host === "gitlab" ? "glab" : "gh")) die(`cloud-check needs the ${p.host === "gitlab" ? "glab" : "gh"} CLI, logged in.`);
  let cr = changeRequestOf(p, dir, ref);
  if (!cr) {
    if (!ref.startsWith(`${p.workBranch}-`)) die(`no MR/PR found for ${ref}. Pass the cloud agent's branch (${p.workBranch}-cloud-…) or its MR/PR number.`);
    tryRun(`git fetch -q origin ${ref}`, dir);
    const subject = tryRun(`git log -1 --format=%s origin/${ref}`, dir);
    if (!subject) die(`origin has no branch ${ref} yet. Wait until the cloud agent has pushed, then run this again.`);
    const title = `Cloud agent: ${oneLine(subject, 100)}`;
    const body = `Opened by the workshop helper for a cloud agent's branch ${ref}. The agent's summary is in its last commit message or in the agent's chat.`;
    if (p.host === "gitlab") run(`glab mr create --source-branch ${ref} --target-branch ${p.workBranch} --title ${JSON.stringify(title)} --description ${JSON.stringify(body)} --yes`, dir);
    else run(`gh pr create --base ${p.workBranch} --head ${ref} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`, dir);
    cr = changeRequestOf(p, dir, ref) ?? die(`opened an MR/PR for ${ref} but could not read it back`);
    log(`✓ opened ${cr.url ?? cr.id} into ${p.workBranch}, ready for review`);
  }
  const problems = changeRequestProblems(cr, p.workBranch);
  if (!problems.length) return log(`✓ ${cr.url ?? cr.id}: ${cr.head} → ${cr.base}, ready for review`);
  log(`! ${cr.url ?? cr.id} needs attention:`);
  for (const problem of problems) log(`  - ${problem}`);
  const gl = p.host === "gitlab";
  if (cr.base !== p.workBranch) log(`  fix the base: ${gl ? `glab mr update ${cr.id} --target-branch ${p.workBranch}` : `gh pr edit ${cr.id} --base ${p.workBranch}`}`);
  if (cr.isDraft) log(`  mark it ready: ${gl ? `glab mr update ${cr.id} --ready` : `gh pr ready ${cr.id}`}`);
  if (!cr.head.startsWith(`${p.workBranch}-`)) {
    log(`  the head branch was created on the agent's VM, outside the push guard. Copy it to a workshop branch, close this ${gl ? "MR" : "PR"}, and check the copy:`);
    log(`    git -C targets/${name} fetch origin ${cr.head} && git -C targets/${name} push origin FETCH_HEAD:refs/heads/${p.workBranch}-cloud-copy`);
    log(`    pnpm workshop cloud-check ${name} ${p.workBranch}-cloud-copy`);
  }
  process.exitCode = 1;
}

// ───────────────────────────── ci-check / cleanup ─────────────────────────────

const DEPLOY_LINE =
  /\b(deploy\w*|release|publish|production|prod|helm\s+(upgrade|install)|kubectl\s+(apply|rollout|set)|terraform\s+apply|serverless\s+deploy|docker\s+push|npm\s+publish|az\s+webapp|aws\s+s3\s+(sync|cp))\b|^\s*environment:/i;
const HIDDEN_CI = /^\s*-?\s*(project|remote|template|component):|^\s*uses:\s*[\w.-]+\/[\w.-]+\/\.github\/workflows\//;

/**
 * Pushing a workshop branch or opening an MR runs the repo's existing pipelines. List the CI lines that
 * look like deploys so a human can confirm they only run on the default branch, tags or by hand.
 */
function ciCheck(name: string) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const hits: string[] = [];
  const hidden: string[] = [];
  for (const f of p.ci.files) {
    readFileSync(join(dir, f), "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (/^\s*#/.test(l)) return;
        if (DEPLOY_LINE.test(l)) hits.push(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`);
        if (HIDDEN_CI.test(l)) hidden.push(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`);
      });
  }
  const ctx = contextFor(dir);
  let verdict: string;
  if (!p.remote) verdict = "no remote: pushes and pipelines can't happen yet";
  else if (ctx?.unrestricted) verdict = "throwaway or mirror target: its pipelines can't reach production";
  else if (hits.length) verdict = "REVIEW: deploy-like CI lines found; confirm they never run on dev-days-workshop/* branches or MRs, or use a mirror";
  else if (hidden.length) verdict = "REVIEW: CI includes jobs defined elsewhere; check those before the first push";
  else verdict = "no deploy-like CI lines found";
  log(`\nCI check for targets/${name}: ${verdict}`);
  for (const h of hits) log(`  deploy?  ${h}`);
  for (const h of hidden) log(`  include  ${h}`);
  const f = join(STATE, "targets", name, "profile.json");
  writeJson(f, { ...readJson<any>(f, {}), ciCheck: { checkedAt: new Date().toISOString(), verdict, deployLines: hits.length } });
}

function cleanup(name: string, yes: boolean) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const common = tryRun("git rev-parse --path-format=absolute --git-common-dir", dir);
  const mainRepo = common ? dirname(common) : dir;
  const refs = (prefix: string) => tryRun(`git for-each-ref --format="%(refname:short)" ${prefix}`, dir).split("\n").filter(Boolean);
  // for-each-ref matches a pattern "up to a slash", so pass the prefix without its trailing slash.
  const ns = BRANCH_PREFIX.replace(/\/$/, "");
  const localBranches = refs(`refs/heads/${ns}`).filter((b) => b.startsWith(BRANCH_PREFIX));
  const tags = refs(`refs/tags/${ns}`).filter((t) => t.startsWith(BRANCH_PREFIX));
  const remoteBranches = p.remote
    ? tryRun(`git ls-remote --heads origin "${BRANCH_PREFIX}*"`, dir).split("\n").filter(Boolean).map((l) => l.split("refs/heads/")[1]!).filter(Boolean)
    : [];
  const worktrees = tryRun("git worktree list --porcelain", dir)
    .split("\n\n")
    .map((b) => ({ path: /^worktree (.+)$/m.exec(b)?.[1], branch: /^branch refs\/heads\/(.+)$/m.exec(b)?.[1] }))
    .filter((w) => w.path && w.branch?.startsWith(BRANCH_PREFIX) && resolve(w.path) !== resolve(mainRepo)) as { path: string; branch: string }[];
  let reviews: { id: string; head: string }[] = [];
  let reviewNote = "";
  if (p.host === "github" && onPath("gh")) {
    const j = tryRun(`gh pr list --state open --limit 200 --json number,headRefName`, dir);
    reviews = j ? JSON.parse(j).filter((r: any) => String(r.headRefName).startsWith(BRANCH_PREFIX)).map((r: any) => ({ id: String(r.number), head: r.headRefName })) : [];
  } else if (p.host === "gitlab" && onPath("glab")) {
    const j = tryRun(`glab mr list --per-page 100 --output json`, dir);
    reviews = j ? JSON.parse(j).filter((r: any) => String(r.source_branch).startsWith(BRANCH_PREFIX)).map((r: any) => ({ id: String(r.iid), head: r.source_branch })) : [];
  } else if (p.remote) reviewNote = `close open MRs/PRs from ${BRANCH_PREFIX}* branches by hand (no ${p.host === "github" ? "gh" : "glab"} CLI)`;
  const home = homedir();
  const backups = mergeBackupRecords(readJson<any>(PROGRESS, {}).backups ?? [], readJson<BackupRecord[]>(BACKUP_INDEX, []));
  const restore = backups.filter((b) => b.to && existsSync(b.from) && readFileSync(b.from, "utf8") !== readFileSync(join(ROOT, b.to), "utf8"));
  const created = backups.filter((b) => !b.to && existsSync(b.from));

  log(`Cleanup plan for targets/${name}:`);
  const list = (title: string, items: string[]) => items.length && log(`  ${title}:\n${items.map((i) => `    - ${i}`).join("\n")}`);
  list("close MRs/PRs", reviews.map((r) => `#${r.id} (${r.head})`));
  list("delete remote branches", remoteBranches);
  list("remove worktrees", worktrees.map((w) => `${w.path} (${w.branch})`));
  list("delete local branches", localBranches);
  list("delete tags", tags);
  list("restore from backup", restore.map((b) => `${b.from.replace(home, "~")} ← ${b.to}`));
  if (created.length) log(`  created during the workshop (review and remove by hand if unwanted):\n${created.map((b) => `    - ${b.from.replace(home, "~")}`).join("\n")}`);
  if (reviewNote) log(`  manual: ${reviewNote}`);
  if (!yes) return log(`\nDry run — nothing changed. Run \`pnpm workshop cleanup ${name} --yes\` to do it.`);

  for (const r of reviews) {
    if (p.host === "github") tryRun(`gh pr close ${r.id}`, dir);
    else tryRun(`glab mr close ${r.id}`, dir);
    log(`✓ closed #${r.id}`);
  }
  for (const b of remoteBranches) {
    guardedPush(`-q origin --delete ${b}`, dir);
    log(`✓ deleted remote branch ${b}`);
  }
  for (const w of worktrees) {
    run(`git worktree remove --force ${JSON.stringify(w.path)}`, mainRepo);
    log(`✓ removed worktree ${w.path}`);
  }
  if (existsSync(dir) && tryRun("git branch --show-current", dir).startsWith(BRANCH_PREFIX)) run(`git checkout -q ${p.defaultBranch}`, dir);
  for (const b of localBranches) {
    if (tryRun(`git branch -D ${b}`, mainRepo)) log(`✓ deleted local branch ${b}`);
    else log(`! could not delete ${b} (still checked out somewhere?)`);
  }
  for (const t of tags) {
    run(`git tag -d ${t}`, mainRepo);
    log(`✓ deleted tag ${t}`);
  }
  for (const b of restore) {
    const before = join(STATE, "backups", `${basename(b.to!)}.before-restore`);
    copyFileSync(b.from, before);
    copyFileSync(join(ROOT, b.to!), b.from);
    log(`✓ restored ${b.from.replace(home, "~")} (the workshop version is kept in ${relative(ROOT, before)})`);
  }
  if (existsSync(dir)) log(`\nThe folder targets/${name} is still there; delete it when you no longer need it.`);
}

// ───────────────────────────── main ─────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    name: { type: "string" },
    participant: { type: "string" },
    setup: { type: "string" },
    suite: { type: "string" },
    force: { type: "boolean" },
    redetect: { type: "boolean" },
    task: { type: "string" },
    "task-file": { type: "string" },
    issue: { type: "string" },
    agent: { type: "string" },
    "no-push": { type: "boolean" },
    post: { type: "boolean" },
    launch: { type: "boolean" },
    yes: { type: "boolean" },
  },
});

try {
  switch (cmd) {
    case "attach":
      if (!positionals[0]) die("attach <git-url | local-path | sample>");
      attach(positionals[0]!, { name: values.name, participant: values.participant, setup: values.setup });
      break;
    case "profile":
      profile(positionals[0] ?? readJson<any>(PROGRESS, {}).activeTarget ?? die("profile <name>"), {}, Boolean(values.redetect));
      break;
    case "install":
      if (positionals.length < 2) die("install <name> <component…>");
      install(positionals[0]!, positionals.slice(1), { suite: values.suite, force: values.force });
      break;
    case "delegate":
      delegate(positionals[0] ?? readJson<any>(PROGRESS, {}).activeTarget ?? die("delegate <name> --issue n | --task …"), {
        task: values.task,
        taskFile: values["task-file"],
        issue: values.issue,
        agent: values.agent,
        push: !values["no-push"],
      });
      break;
    case "review":
      if (positionals.length < 2) die("review <name> <branch> [--agent claude|cursor] [--post]");
      review(positionals[0]!, positionals[1]!, { agent: values.agent, post: values.post });
      break;
    case "cloud":
      await cloud(positionals[0] ?? readJson<any>(PROGRESS, {}).activeTarget ?? die("cloud <name> --issue n | --task …"), {
        task: values.task,
        taskFile: values["task-file"],
        issue: values.issue,
        launch: values.launch,
        yes: values.yes,
      });
      break;
    case "cloud-check":
      if (positionals.length < 2) die("cloud-check <name> <branch | MR/PR number>");
      cloudCheck(positionals[0]!, positionals[1]!);
      break;
    case "catchup":
      catchup(Number(positionals[0]), values.participant);
      break;
    case "ci-check":
      ciCheck(positionals[0] ?? readJson<any>(PROGRESS, {}).activeTarget ?? die("ci-check <name>"));
      break;
    case "cleanup":
      cleanup(positionals[0] ?? readJson<any>(PROGRESS, {}).activeTarget ?? die("cleanup <name> [--yes]"), Boolean(values.yes));
      break;
    case "status": {
      const pr = readJson<any>(PROGRESS, null);
      if (!pr) log("No .workshop/progress.json yet.");
      else {
        const branches = Object.fromEntries(Object.keys(pr.targets).filter((t) => existsSync(join(TARGETS, t))).map((t) => [t, tryRun("git branch --show-current", join(TARGETS, t)) || "(detached)"]));
        log(JSON.stringify({ activeTarget: pr.activeTarget, currentPhase: pr.currentPhase, targets: Object.keys(pr.targets), branches }, null, 2));
        if (pr.activeTarget && existsSync(join(TARGETS, pr.activeTarget))) checkOutWorkBranch(pr.activeTarget);
      }
      break;
    }
    default:
      log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]!.replace(/^\/\*\*?|^ \* ?/gm, ""));
  }
} catch (e) {
  die((e as Error).message);
}

