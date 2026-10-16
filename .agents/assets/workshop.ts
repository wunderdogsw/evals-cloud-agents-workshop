/**
 * Workshop helper used by the guide. Run via:  pnpm workshop <command> …
 *
 *   attach <git-url | local-path | sample> [--name n] [--participant p]
 *   profile <name> [--redetect]          (keeps manually corrected commands unless --redetect)
 *   install <name> <component…> [--suite s] [--force]
 *       components: evals | subject-cost-coder | ci-evals | ci-claude | ci-review | cursor-env | agents-section | review-md | agent-tasks
 *   catchup <phase> [--participant p]
 *   status
 */
import { execSync } from "node:child_process";
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
      cpSync(join(ROOT, "samples", "cost-coder", "data"), join(sub, "data"), { recursive: true });
      done.push("evals/subject/cost-coder/: classify.ts, codes.ts, data/ — import from ../../subject/cost-coder/classify.ts");
      break;
    }
    case "ci-evals":
    case "ci-claude":
    case "ci-review": {
      const file = { "ci-evals": "workshop-evals.yml", "ci-claude": p.host === "github" ? "workshop-claude.yml" : "workshop-claude-agent.yml", "ci-review": "workshop-claude-review.yml" }[component]!;
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
    writeFileSync(join(dest, "suite.ts"), readFileSync(join(dest, "suite.ts"), "utf8").replace("__CLASSIFY_IMPORT__", "../../../src/classify.ts"));
    commit("workshop: eval suite (catch-up)");
  }
  if (phase > 6) install(name, ["agent-tasks"], {});
  if (phase > 9) {
    install(name, ["agents-section", "review-md"], {});
    commit("workshop: agent instructions (catch-up)");
  }
  run(`git checkout -q -B ${p.workBranch}`, dir);

  // CI and cloud-agent files depend on the host, which is unknown until the sample is pushed somewhere.
  const later = [phase > 5 && "ci-evals", phase > 7 && "ci-claude", phase > 8 && "cursor-env", phase > 9 && "ci-review"].filter(Boolean) as string[];

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
}

// ───────────────────────────── main ─────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: { name: { type: "string" }, participant: { type: "string" }, suite: { type: "string" }, force: { type: "boolean" }, redetect: { type: "boolean" } },
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

