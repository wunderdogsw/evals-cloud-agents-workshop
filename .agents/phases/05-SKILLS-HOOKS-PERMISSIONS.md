# Phase 5 — Add skills, hooks and permissions

## What you do

1. **Add a run-and-verify skill** — `/run-skill-generator` writes down how to build and run the target, as `.claude/skills/run-<name>/`.
2. **Test the skill with an eval** — write one eval case for the skill and run it with `claude plugin eval`, with and without the skill.
3. **Enforce one rule with a hook** — add a `PreToolUse` hook with `/update-config`, confirm it in `/hooks`, then break the rule on purpose.
4. **Set permissions** — run `/fewer-permission-prompts`, then review the allow list in `/permissions` and commit everything.

## Gate

- [ ] The skill, the hook and the permissions are committed on the workshop branch.
- [ ] The skill eval ran with and without the skill, and `findings.md` records the result and what they changed because of it.
- [ ] A hook (new or existing) blocked a deliberate violation in this session.

## Learning point

If a rule must never be broken, put it in a hook, not in `CLAUDE.md`. An instruction asks the agent to follow a rule, but a hook stops the action that breaks it.

## Wanted outcome

A complete agent setup, committed on the workshop branch, that Phases 6–15 use as the standard to measure the agent against.

---

## 5.1 Add a run-and-verify skill

### [LLM]

> Narrate: "Instructions tell the agent what you want. A skill gives it steps to follow. A hook blocks actions that break a rule. Permissions decide what it may do without asking you."

Explain: `/run-skill-generator` starts the app from a clean environment. It writes down what worked (install commands, environment variables, launch script) as a project skill. Then `/run`, `/verify` and other agents in the repo follow that skill, so they don't have to work out the steps again. Cursor reads `.claude/skills/` too.

### [HUMAN]

In the target session they run `/run-skill-generator` and follow its steps. Then they read the generated `SKILL.md` and check one thing: do the commands match the ones that worked in Phase 1? They fix any command that doesn't match.

### [BRANCH]

- **Already good** (a working run or build skill exists) → don't add one. Run `/skill-doctor` in the terminal session (v2.1.252+). Turn off skills that use context but have never run, at project level only.
- **The app can't start locally** (it needs a cloud service) → let the skill record only the build and the tests. Write in the skill what is missing.

## 5.2 Test the skill with an eval

### [LLM]

> Narrate: "Before we build our own evals, try the one Claude Code ships. It answers one question: does this skill change what Claude does?"

Explain in three lines, from the Claude Code plugin evals docs (Claude Code v2.1.269 or later):

- `claude plugin eval` runs a test case (a prompt plus graders) several times with a plugin and several times without it. The difference is `Δ`.
- A grader is a pass/fail check. `regex` and `tool_used` graders cost nothing. An `llm` grader asks a judge model.
- Each run starts in an empty folder, with no `CLAUDE.md`, no project `.claude/` and no user settings. So this tests the skill on its own, not the repo's instructions. Phases 8–15 test those.

It works on plugins, so wrap the skill in a throwaway plugin outside the target. Nothing here is committed:

```bash
d=.workshop/targets/<name>/skill-eval
mkdir -p "$d/.claude-plugin" "$d/skills"
echo '{"name": "skill-eval"}' > "$d/.claude-plugin/plugin.json"
cp -R targets/<name>/.claude/skills/run-<name> "$d/skills/"
cd "$d" && claude plugin eval init --bare run-skill
```

This writes `evals/run-skill/prompt.md` and `evals/run-skill/graders/criteria.md` with placeholders.

### [HUMAN]

They write the case themselves:

1. **`prompt.md`** — a question a new teammate would type, without naming the skill. For example: "How do I start this app locally and check that it works?" In the frontmatter, set `allowed_tools: [Read, Skill]`.
2. **`graders/criteria.md`** — change it to a `regex` grader (`type: regex`, with a `pattern`) that matches the exact start or test command from the skill. Without the skill, Claude can't know that command, so this grader shows what the skill adds.
3. **`graders/skill-fired.md`** — a `tool_used` grader with `tool: Skill` and `input_match` set to the skill's name. It shows whether Claude chose the skill.

Then they run it from the plugin folder (one case, 3 runs with and 3 without, about 6 short runs):

```bash
claude plugin eval . --no-publish
```

They read `WITH`, `W/OUT` and `Δ`, and write one line in `findings.md` under `## Skill eval`. If `skill-fired` failed, Claude didn't pick the skill from a normal question. They improve the `description` in the skill's `SKILL.md` in the target, copy the skill again, and run again. Then the line also says what they changed.

Ask before they run: "What `Δ` do you expect?" Compare after.

### [BRANCH]

- **Already good** (they kept an existing skill in 5.1) → test that skill instead.
- **Claude Code older than v2.1.269** → run `claude update`. If they can't, they pair with someone who can, and still write their own case.
- **They mainly use Cursor** → `claude plugin eval` needs the Claude Code CLI. If they have no Claude Code login, they pair with someone who has one, and still write their own case and graders.
- **`Δ` is near zero and `skill-fired` passes** → the regex probably matches text Claude can guess without the skill. Make it match something only the skill knows, such as a script name or a port.

## 5.3 Enforce one rule with a hook

### [LLM]

Help them choose **one** rule from their instruction files. The rule must never be broken, and a script must be able to check it from the tool call alone. Examples: a protected directory, a file type nobody edits by hand, or a command that must never run. A good rule for a hook blocks a file write or a command. "Write good tests" can't be a hook.

Explain how a hook works, from the Claude Code hooks docs. A `PreToolUse` hook gets the tool call as JSON on stdin (`tool_name`, `tool_input`). Exit code 2 blocks the call and sends stderr to Claude as the reason. Put the config in the **project** `.claude/settings.json`, so it is committed. Put the script in `.claude/hooks/`, and refer to it through `${CLAUDE_PROJECT_DIR}`.

### [HUMAN]

They write the request themselves, for example:

```text
/update-config Add a PreToolUse hook in the project .claude/settings.json for Edit|Write that runs .claude/hooks/protect-data.mjs, and write that script: block any file_path under data/ with exit code 2 and a reason on stderr.
```

They read the script before they accept it. Then they restart the target session and check that `/hooks` lists it. Then they **break the rule on purpose**: they ask Claude to change a protected file. The hook must block the change, and Claude must report the reason.

### [BRANCH]

- **Target is `sample` (default `--setup broken`)** → the rule is "Never edit files under `data/`" from `AGENTS.md`.
- **Already good** (a blocking hook exists) → don't add one. Make the existing hook run on purpose, and confirm in `/hooks` that it is the project's hook.
- **They mainly use Cursor** → Cursor's project hooks are in `.cursor/hooks.json` (`"version": 1`). A `preToolUse` hook can block with exit code 2. Commands run from the project root, so use paths like `.cursor/hooks/protect-data.mjs`. Add it next to the Claude Code hook. One script can work for both tools if it can read the input from either one.
- **The hook doesn't run** → check `claude doctor` for a settings error. Check the matcher (`Edit|Write`). Check that the script is executable or is started with `node`.

## 5.4 Set permissions

### [LLM]

Explain: `/fewer-permission-prompts` looks through past session transcripts for common read-only Bash and MCP calls. It adds an allow list, sorted by priority, to the **project** `.claude/settings.json`. In a repo they have used only a little, it may find few calls. That is fine.

### [HUMAN]

In the target session they run `/fewer-permission-prompts`, then `/permissions`. They review every project rule. Read-only commands and the test command are fine. They remove anything that can write outside the repo, push, or run any code (`Bash(*)`, `Bash(git push:*)`). If it found nothing, they add the test and typecheck commands themselves.

Then they commit the setup in the target:

```bash
cd targets/<name>
for f in .claude/skills .claude/hooks .claude/settings.json .cursor/hooks.json .cursor/hooks; do [ -e "$f" ] && git add "$f"; done
git status --short
git commit -m "workshop: agent skill, hook and permissions"
```

Don't commit `.claude/settings.local.json`. It holds personal settings.

## 5.5 Gate check

The participant confirms, and you verify:

- [ ] The skill, the hook and the permissions are committed on the workshop branch. — `git -C targets/<name> log --stat -1` and `cat targets/<name>/.claude/settings.json`
- [ ] The skill eval ran with and without the skill, and `findings.md` records the result and what they changed because of it. — read `## Skill eval` in `.workshop/targets/<name>/findings.md` and the latest report under `.workshop/targets/<name>/skill-eval/evals/results/`
- [ ] A hook (new or existing) blocked a deliberate violation in this session. — they paste the blocked tool call and its reason from the target session

---

## Phase Complete

Mark Phase 5 complete. Preview: "Phase 6 — turn the rules in your new setup into expectations that code or a judge can check."
