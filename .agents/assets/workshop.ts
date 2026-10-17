/**
 * Workshop helper used by the guide. Run via:  pnpm workshop <command> …
 *
 *   attach <git-url | local-path | sample> [--name n] [--participant p]
 *   profile <name> [--redetect]          (keeps manually corrected commands unless --redetect)
 *   install <name> <component…> [--suite s] [--force]
 *       components: evals | subject-cost-coder | ci-evals | cursor-env | agents-section | review-md | agent-tasks
                   optional, only where Claude may run in CI: ci-evals-live | ci-claude | ci-review
 *   delegate <name> (--issue n | --task "…" | --task-file f) [--agent claude|cursor] [--no-push]
 *       run Claude Code or the Cursor CLI headless on a fresh branch, then push it and open an MR/PR
 *   review <name> <branch> [--agent claude|cursor] [--post]
 *       read-only agent review of a branch; --post puts it on the MR/PR via glab/gh
 *   catchup <phase> [--participant p]
 *   status
 */
import { execSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TARGETS = join(ROOT, "targets");
const STATE = join(ROOT, ".workshop");
const PROGRESS = join(STATE, "progress.json");
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

function readJson<T = any>(p: string, fallback: T): T {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;
}
function writeJson(p: string, v: unknown) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
}

function initialProgress() {
  const phases: Record<string, unknown> = {};
  for (let i = 1; i <= 10; i++) phases[String(i)] = { status: "not_started", startedAt: null, completedAt: null };
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

function slug(s: string) {
  return s.toLowerCase().replace(/\.git$/, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "target";
}

function attach(src: string, opts: { name?: string; participant?: string }) {
  mkdirSync(TARGETS, { recursive: true });
  const participant = slug(opts.participant ?? (tryRun("git config user.name") || process.env.USER || "me"));
  const branch = `workshop/${participant}`;
  let name: string;
  let source: Profile["source"];

  if (src === "sample") {
    name = opts.name ?? "cost-coder";
    source = "sample";
    const dest = join(TARGETS, name);
    if (existsSync(dest)) die(`targets/${name} already exists. Pick another --name or remove it.`);
    cpSync(join(ROOT, "samples", "cost-coder"), dest, {
      recursive: true,
      filter: (p) => !/(^|\/)(node_modules|\.eval-runs|\.agent-runs)(\/|$)/.test(relative(join(ROOT, "samples"), p)),
    });
    run(`git init -q -b main`, dest);
    run(`git add -A && git -c user.email=workshop@example.invalid -c user.name=workshop commit -qm "Initial commit: cost-coder sample"`, dest);
    run(`git checkout -q -b ${branch}`, dest);
  } else if (/^(https?:\/\/|git@|ssh:\/\/)/.test(src)) {
    name = opts.name ?? slug(basename(src));
    source = "url";
    const dest = join(TARGETS, name);
    if (existsSync(dest)) die(`targets/${name} already exists. Pick another --name or remove it.`);
    run(`git clone ${JSON.stringify(src)} ${JSON.stringify(dest)}`);
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
    run(`git worktree add ${exists ? "" : `-b ${branch}`} ${JSON.stringify(dest)} ${exists ? branch : ""}`.replace(/\s+/g, " "), abs);
  }

  const progress = readJson<any>(PROGRESS, initialProgress());
  progress.participant ??= participant;
  writeJson(PROGRESS, progress);
  log(`✓ attached targets/${name} (${source}) on branch ${branch}`);
  profile(name, { source, workBranch: branch });
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
    // pnpm targets without their own workspace file would be swallowed by the control room's workspace.
    cmd.install = pm === "pnpm" ? (has("pnpm-workspace.yaml") ? "pnpm install" : "pnpm install --ignore-workspace") : pm === "npm" ? (has("package-lock.json") ? "npm ci" : "npm install") : `${pm} install`;
    if (pkg.scripts?.build) cmd.build = `${runner} build`;
    if (pkg.scripts?.test) cmd.test = pm === "npm" ? "npm test" : `${pm} test`;
    if (pm === "pnpm" && !has("pnpm-workspace.yaml")) notes.push("pnpm target without pnpm-workspace.yaml: install with --ignore-workspace inside the control room.");
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
    workBranch: extra.workBranch ?? prev.workBranch ?? (tryRun("git branch --show-current", dir) || "workshop/me"),
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
      for (const f of ["package.json", "README.md", ".gitignore", "pnpm-workspace.yaml"]) done.push(`evals/${f}: ${copyTemplate(join(T, "evals-folder", f), join(ev, f), vars, force)}`);
      mkdirSync(join(ev, "runner"), { recursive: true });
      for (const f of readdirSync(join(KIT, "evals", "src"))) {
        const body = readFileSync(join(KIT, "evals", "src", f), "utf8");
        writeFileSync(join(ev, "runner", f), `// Vendored from the Evals & Cloud Agents Workshop kit (kit/evals/src/${f}). Update there, not here.\n${body.replace(/^#!.*\n/, "")}`);
      }
      done.push("evals/runner/: vendored");
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
    default:
      die(`unknown component "${component}"`);
  }
  for (const d of done) log(`✓ ${d}`);
}

// ───────────────────────────── catchup ─────────────────────────────

function catchup(phase: number, participant?: string) {
  if (!(phase >= 2 && phase <= 10)) die("catchup <phase>: phase 2–10 = the phase you want to START");
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

  if (phase > 2) {
    install(name, ["evals"], { suite: "cost-coder" });
    const src = join(KIT, "catchup", "cost-coder", "evals", "suites", "cost-coder");
    const dest = join(dir, "evals", "suites", "cost-coder");
    cpSync(src, dest, { recursive: true, force: true });
    writeFileSync(join(dest, "suite.ts"), readFileSync(join(dest, "suite.ts"), "utf8").replace("__CLASSIFY_IMPORT__", "../../../src/classify.ts").replace("__TRACKS__", JSON.stringify(["../../../src/classify.ts", "../../../src/codes.ts", "../../../src/llm"])));
    commit("workshop: eval suite (catch-up)");
  }
  if (phase > 4) {
    // Phase 4 reference change: tighter rationale rules (v1 → v2 takes the reference suite from ~0% to ~80%).
    const cls = join(dir, "src", "classify.ts");
    const v2 = readFileSync(join(KIT, "catchup", "cost-coder", "prompt-v2.txt"), "utf8").replace(/\n+$/, "");
    writeFileSync(cls, readFileSync(cls, "utf8").replace("Pick the single best cost code for the line.`;", `Pick the single best cost code for the line.${v2}\`;`));
    commit("feature: rationale rules (prompt v2, catch-up)");
  }
  if (phase > 6) install(name, ["agent-tasks"], {});
  if (phase > 9) {
    install(name, ["agents-section", "review-md"], {});
    commit("workshop: agent instructions (catch-up)");
  }
  run(`git checkout -q -B ${p.workBranch}`, dir);

  // CI and cloud-agent files depend on the host, which is unknown until the sample is pushed somewhere.
  const later = [phase > 5 && "ci-evals", phase > 7 && "cursor-env"].filter(Boolean) as string[];

  const progress = readJson<any>(PROGRESS, initialProgress());
  const now = new Date().toISOString();
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
    log(`! Needs a remote first (Phase 5 doc, "No remote yet"). Then, on main:`);
    log(`    pnpm workshop profile ${name}`);
    log(`    pnpm workshop install ${name} ${later.join(" ")}`);
    log(`    cd targets/${name} && git checkout main && git add -A && git commit -m "workshop: CI + agents (catch-up)" && git push && git checkout ${p.workBranch} && git merge -q main`);
  }
  if (phase > 5) {
    log(`! The CI gate needs a recording made with a real model (your Claude Code or Cursor login):`);
    log(`    pnpm --dir targets/${name}/evals eval suites/cost-coder/suite.ts --record   # then commit evals/suites/cost-coder/last-run.json on main`);
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
function runArgs(cmd: string, args: string[], cwd: string, timeoutMs = 60 * 60_000): { code: number | null; stdout: string } {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  return { code: r.status, stdout: r.stdout ?? "" };
}

function lastJson(s: string): any {
  for (const line of s.trim().split("\n").reverse()) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  return {};
}

function agentRun(agent: AgentCli, prompt: string, cwd: string, mode: "write" | "read"): { ok: boolean; summary: string; costUsd?: number } {
  if (agent === "claude") {
    const args =
      mode === "write"
        ? ["-p", prompt, "--output-format", "json", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash", "--max-turns", "80"]
        : ["-p", prompt, "--output-format", "json", "--permission-mode", "dontAsk", "--allowedTools", "Read,Glob,Grep,Bash(git diff *),Bash(git log *),Bash(git show *)", "--max-turns", "30"];
    const r = runArgs("claude", args, cwd);
    const out = lastJson(r.stdout);
    return { ok: r.code === 0 && out.subtype === "success", summary: String(out.result ?? out.subtype ?? "no output"), costUsd: out.total_cost_usd };
  }
  // Cursor CLI: --force lets it write; without it, it only proposes changes.
  const r = runArgs("agent", ["-p", prompt, "--output-format", "json", "--trust", ...(mode === "write" ? ["--force"] : [])], cwd);
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

function delegate(name: string, o: { task?: string; taskFile?: string; issue?: string; agent?: string; push?: boolean }) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const agent = pickAgent(o.agent);
  let title: string;
  let body: string;
  if (o.issue) ({ title, body } = fetchIssue(p, dir, o.issue));
  else if (o.taskFile) {
    body = readFileSync(o.taskFile, "utf8");
    title = oneLine(body.split("\n")[0]!.replace(/^#+\s*/, ""), 70);
  } else if (o.task) {
    body = o.task;
    title = oneLine(o.task, 70);
  } else return die("delegate needs --issue <n>, --task \"…\" or --task-file <file>");

  const hasRemote = Boolean(p.remote);
  if (hasRemote) tryRun(`git fetch -q origin ${p.defaultBranch}`, dir);
  const base = hasRemote ? `origin/${p.defaultBranch}` : p.defaultBranch;
  const branch = `agent/${agent}-${o.issue ? `issue-${o.issue}-` : ""}${slug(title).slice(0, 30)}-${Date.now().toString(36).slice(-4)}`;
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
- Before you finish, run the eval gate exactly as CI will: \`pnpm --dir evals verify suites/<suite>/suite.ts\` for each suite in evals/suites/. If it says "stale", re-run that suite with \`--record\` (see evals/README.md), and commit the updated last-run.json. If the recorded run misses the threshold, fix the cause — never edit cases, thresholds or last-run.json by hand.
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
    run(
      `git push -q -u origin ${branch} -o merge_request.create -o merge_request.target=${p.defaultBranch} ` +
        `-o merge_request.title=${JSON.stringify(oneLine(mrTitle, 120))} -o merge_request.label=agent:${agent} ` +
        `-o merge_request.description=${JSON.stringify(oneLine(`Delegated to ${agent} from the workshop.${o.issue ? ` Closes #${o.issue}.` : ""} Agent summary is in the first comment / commit message.`, 300))}`,
      wt,
    );
    log(`✓ pushed ${branch} and opened an MR (GitLab prints its link above). Paste the summary above as the first MR comment.`);
  } else {
    run(`git push -q -u origin ${branch}`, wt);
    if (onPath("gh")) {
      const bodyFile = join(wt, "..", `${branch.replace(/\//g, "_")}.summary.md`);
      log(run(`gh pr create --base ${p.defaultBranch} --head ${branch} --title ${JSON.stringify(mrTitle)} --body-file ${JSON.stringify(bodyFile)}`, wt));
    } else log(`✓ pushed ${branch}. Open the PR: ${p.hostUrl}/${p.projectPath}/compare/${p.defaultBranch}...${branch}`);
  }
  log(`Workspace kept at ${wt} (git worktree of targets/${name}).`);
}

function review(name: string, branch: string, o: { agent?: string; post?: boolean }) {
  const dir = targetDir(name);
  const p = profileOf(name);
  const agent = pickAgent(o.agent);
  if (p.remote) tryRun(`git fetch -q origin ${p.defaultBranch} ${branch}`, dir);
  const head = p.remote ? `origin/${branch}` : branch;
  const base = p.remote ? `origin/${p.defaultBranch}` : p.defaultBranch;
  const wt = join(tmpdir(), "workshop-review", slug(branch));
  if (existsSync(wt)) tryRun(`git worktree remove --force ${JSON.stringify(wt)}`, dir);
  run(`git worktree add -q --detach ${JSON.stringify(wt)} ${head}`, dir);
  const prompt = `Review the changes on this branch: run \`git diff ${base}...HEAD\`. Follow REVIEW.md if it exists, otherwise AGENTS.md / CLAUDE.md. Do not modify any files.
Report only real problems (bugs, missing tests, broken conventions, risky changes, edits to evals/suites/*/cases.jsonl or thresholds), most severe first, each with file:line and a one-line fix. If there are none, say so in one sentence. Markdown, under 300 words.`;
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

// ───────────────────────────── main ─────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    name: { type: "string" },
    participant: { type: "string" },
    suite: { type: "string" },
    force: { type: "boolean" },
    redetect: { type: "boolean" },
    task: { type: "string" },
    "task-file": { type: "string" },
    issue: { type: "string" },
    agent: { type: "string" },
    "no-push": { type: "boolean" },
    post: { type: "boolean" },
  },
});

try {
  switch (cmd) {
    case "attach":
      if (!positionals[0]) die("attach <git-url | local-path | sample>");
      attach(positionals[0]!, { name: values.name, participant: values.participant });
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
    case "catchup":
      catchup(Number(positionals[0]), values.participant);
      break;
    case "status": {
      const pr = readJson<any>(PROGRESS, null);
      if (!pr) log("No .workshop/progress.json yet.");
      else log(JSON.stringify({ activeTarget: pr.activeTarget, currentPhase: pr.currentPhase, targets: Object.keys(pr.targets) }, null, 2));
      break;
    }
    default:
      log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]!.replace(/^\/\*\*?|^ \* ?/gm, ""));
  }
} catch (e) {
  die((e as Error).message);
}

