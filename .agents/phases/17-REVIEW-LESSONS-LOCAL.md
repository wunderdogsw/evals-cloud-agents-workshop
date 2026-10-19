# Phase 17 — Act on review lessons, schedule locally

## What you do

1. **Read the report** — read the Phase 16 report from start to end and open the evidence of each finding.
2. **Decide on each finding** — fix or skip, with one reason, written in the report.
3. **Change the files** — make the change for one or two "fix" findings, and commit each on the workshop branch with the finding named in the commit message.
4. **Schedule it locally** — a local routine in Claude Desktop, or cron/launchd with `claude -p "/review-lessons …"` (Cursor: `agent -p`).

## Gate

- [ ] Every finding has a decision (fix / skip) and a reason.
- [ ] At least one change is committed and names its finding.
- [ ] The local schedule has run once and written a new report.

## Learning point

The agent finds the patterns in your review history, and you decide which ones are worth a change. A schedule on your laptop only runs while your laptop is on.

## Wanted outcome

Committed file changes and a local schedule, which Phase 18 moves to the cloud.

---

## 17.1 Read the report

### [LLM]

> Narrate: "In Phase 16 the agent read the review comments and wrote a report. Now you check that report against the real comments. A finding is only useful if the comments say what the finding says."

Run `pnpm workshop status` and read the profile. Like Phase 16, this phase needs no evals. It works for a target that skipped Day 1.

Find the report from Phase 16:

```bash
ls -l .workshop/targets/<name>/review-lessons/
```

The report is `<YYYY-MM-DD>.md`. A catch-up target has a reference report there, made from the sample's review history. If there is no report, run the skill once with the command from 16.2 before you continue.

Check that `targets/<name>/.claude/skills/review-lessons/SKILL.md` is committed on the workshop branch. 17.4 runs it from the target folder.

### [HUMAN]

They read the whole report, from the first line to the last. For each finding they:

- open the evidence links, all of them when there are only a few, and check that each comment says what "What reviewers said" says;
- open the file in "Where a change could help" in the target, and check whether it already has a rule about the problem;
- note anything the report got wrong: a comment that doesn't fit, a count that is too high, or a file that doesn't exist.

The guide doesn't read the evidence for them. If they ask, the guide may show how to find a comment.

### [BRANCH]

- **GitHub** (`host: github`) → the evidence links open in the browser. On GitHub Enterprise, they log in to that host first.
- **GitLab** (`host: gitlab`) → the evidence links end in `#note_<id>` and open the merge request at that comment.
- **Target is `sample` or a catch-up target** → the links point at `github.example.invalid`, which doesn't exist. The number at the end of a link is the comment's `id`. They find the comment in the review history and read its `body`:

  ```bash
  grep -rn '"id": 2010400' .workshop/targets/<name>/review-history/
  ```

- **The report has no findings, or only one** → that is a result too. Ask whether the window was too small. They run the skill again with a wider window (16.2). If there is still no finding, they write one finding into the report themselves: a review comment they know comes back in their team, in the same format, with at least one evidence link.

## 17.2 Decide on each finding

### [LLM]

> Narrate: "The agent found the patterns. You decide which ones are worth a change. Not every pattern needs one."

Explain what makes a good reason. Don't decide for them.

- **Fix** when the problem came back in several PRs/MRs, a small change in one file could stop it, and the team would agree with the rule.
- **Skip** when it was a one-off, it is already fixed, it is one person's taste, no file change would help, or the change is too big for today. "Skip" is a real decision, not a failure.
- If the file in "where" already has the rule, more text in the same file is unlikely to help. A file that checks the rule is stronger than a file that only states it: a test config, a lint rule or a CI job checks it on every change. An instruction file only asks the agent.

The decisions go into the Phase 16 report, one line under each finding:

```markdown
- Decision: fix — <reason in one sentence>
```

or

```markdown
- Decision: skip — <reason in one sentence>
```

The scheduled runs in 17.4 write new files, so these decisions stay in this report.

### [HUMAN]

They write a decision and a reason under every finding. The reason refers to what they found in 17.1: how many PRs/MRs, whether the rule already exists, whether the team would agree.

The guide reads the decisions and asks a question when a reason is missing or doesn't match the evidence. For example: "The rule is already in `AGENTS.md`, and it came back three times. Would more text in `AGENTS.md` stop it?" The guide doesn't change a decision.

On the sample or a catch-up target, the report names `AGENTS.md` as the place where a rule already exists for most findings. A good "fix" reason then says why the new place is stronger than `AGENTS.md`.

## 17.3 Change the files

### [LLM]

> Narrate: "Now you make the change. Keep it small: one finding per commit, so anyone can see which comment pattern each change answers."

Explain:

- The change goes into the file the report names, or into a better one the participant found in 17.1. It can be an agent file (`CLAUDE.md`, `AGENTS.md`, a `.claude/rules/` or `.cursor/rules/` file, a skill or a hook) or another file (lint config, test config, a test helper, a PR/MR template, a CI job).
- One commit per finding. The commit message names the finding, in the form `workshop: <what changed> (review-lessons: <finding title>)`.
- They don't push. Phase 18 uses the branch as it is.

Check whether the target has a Phase 14 recording:

```bash
ls targets/<name>/evals/suites/agent/last-run.json 2>/dev/null
```

If it exists and the change touches an agent file, say this once: the agent eval gate from Phase 14 will report the recording as stale on the next push, because a tracked file changed after the recording. This phase doesn't need any eval work. Don't say more about it.

### [HUMAN]

They write the change themselves, for one or two "fix" findings.

Before they commit, the guide checks the change against the finding: would it have stopped the comments in the evidence? If a comment would still be possible after the change, the guide says which one. They run the target's own tests, and its lint or typecheck if the profile or the target's `AGENTS.md` lists one.

Then they commit each change on its own:

```bash
git -C targets/<name> add <files>
git -C targets/<name> status --short
git -C targets/<name> commit -m "workshop: <what changed> (review-lessons: <finding title>)"
```

Under the finding in the report, they add one line with the commit:

```markdown
- Change: <short commit hash> <file>
```

### [BRANCH]

- **The change is a CI job** → it runs only after a push. They commit it on the workshop branch and run the same command on their machine once. They don't push in this phase.
- **The change needs the team first** (for example, a lint rule that fails on old code) → they change the decision to `skip — needs the team first`, and pick a smaller finding for today.
- **Target is `sample` or a catch-up target** → the same task. The sample has no `.github/` folder. They can still add a file there.

## 17.4 Schedule it locally

### [LLM]

> Narrate: "A report you run once gets old. A schedule runs the skill every week, so new review comments show up without anyone asking. On your laptop, it runs only while the laptop is on. Phase 18 moves it to the cloud."

Check which tools are installed, and say so in one line:

```bash
claude --version 2>/dev/null; agent --version 2>/dev/null; uname -s
```

Explain the choices, from the Claude Code and Cursor docs:

- **Claude Desktop local routine.** Claude Desktop 1.1.5368 or later. It runs while the app is open and the computer is awake. If the computer sleeps at the scheduled time, the run is skipped. After a wake, Desktop starts one catch-up run for the latest missed time in the last seven days. Each routine has its own permission mode. **Run now** starts it at once. Desktop saves the routine in `~/.claude/scheduled-tasks/<task-name>/`.
- **Claude Code CLI with launchd (macOS) or cron (Linux).** `claude -p "/review-lessons <arguments>"` runs a project skill without the interactive screen. From Claude Code v2.1.302, a `-p` run starts in Manual mode and denies every call that needs approval, so the command lists exactly what the run may do. launchd runs a missed job when the Mac wakes. cron skips it.
- **Cursor CLI with launchd or cron.** The Cursor CLI has no scheduler of its own. `agent -p` runs one prompt and exits.
- **`/loop`** runs a prompt again and again, but only inside one open session. Recurring tasks expire after 7 days. Use it only for a quick try, not as the schedule.

Each scheduled run writes `scheduled-<YYYY-MM-DD>.md` next to the Phase 16 report. The new name keeps the decisions from 17.2 safe.

A schedule is persistent configuration on the participant's machine, outside any repo. **Before you add one, show the exact entry and ask once.** Use a weekly schedule. Phase Complete tells them how to remove it.

For the launchd and cron paths, write a small script outside the target, so the schedule entry stays short. Fill in the absolute paths and the `PATH` from their shell (`echo $PATH`), because launchd and cron start with an almost empty environment. Replace any folder that belongs to one shell session or one tool version, for example a `fnm_multishells` or `nvm/versions` folder, with a stable folder that has `node`, `claude` and `gh` (`command -v node claude gh` shows where they are). Use the arguments their own skill takes, from 16.2, with the new report path. Claude Code version, saved as `.workshop/targets/<name>/review-lessons.sh`:

```sh
#!/bin/sh
# Runs the review-lessons skill once and writes a dated report.
set -eu
WORKSHOP="<absolute path of the workshop repo>"
NAME="<name>"
STATE="$WORKSHOP/.workshop/targets/$NAME"
REPORT="$STATE/review-lessons/scheduled-$(date +%Y-%m-%d).md"
export PATH="<PATH from their shell>"
export USER="$(id -un)" LOGNAME="$(id -un)"
cd "$WORKSHOP/targets/$NAME"
claude -p "/review-lessons $REPORT" \
  --permission-mode dontAsk \
  --max-budget-usd 2 \
  --output-format json \
  --add-dir "$STATE" \
  --allowedTools "Bash(gh api *)" "Bash(glab api *)" "Bash(git remote get-url *)" "Edit(/$STATE/review-lessons/**)" \
  > "$STATE/review-lessons/scheduled-run.json"
test -s "$REPORT"
```

Explain the script line by line:

- `USER` and `LOGNAME` let `claude` find the login that macOS keeps in the keychain. Without them, the run says "Not logged in".
- `dontAsk` denies every call that the list doesn't allow, so a run never waits for an answer.
- `--add-dir` lets it read the workshop files for this target, for example the review history.
- `Bash(gh api *)` and `Bash(glab api *)` allow the API calls. They also allow write calls, so the skill's own read-only rule is what keeps the run to reads.
- `Edit(//<path>/**)` allows writing only in the report folder. The `//` means an absolute path. In the script, `/` plus `$STATE` gives `//`.
- `--max-budget-usd 2` stops the run at about 2 dollars. `scheduled-run.json` has the cost in `total_cost_usd`. Report it after each test run.

The log may say `Ignoring … permissions.allow entries from .claude/settings.json: this workspace has not been trusted`. This happens when nobody has opened Claude Code in the target interactively and accepted the trust question. The run still works, because the script lists everything it may do. To remove the message, open Claude Code in `targets/<name>` once and accept.

### [HUMAN]

They choose the path that fits their machine, read the entry the guide shows, and say yes before anything is added. Then they run the schedule once and read the new report.

They check the new report the same way as in 17.1: does every finding have its three parts? Is a finding they fixed in 17.3 still there? It should be, because the old comments are still in the window. It goes away only when new PRs/MRs push them out.

### [BRANCH]

- **Claude Desktop** → in the **Code** tab, **Routines**, then **New routine** and **Local**. Name: `review-lessons-<name>`. Folder: the absolute path of `targets/<name>`, with the worktree option off. Permission mode: **Manual**. Schedule: **Weekly**, with a day and time. Instructions, with the arguments their skill takes:

  ```text
  /review-lessons <absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons/scheduled-<today's date as YYYY-MM-DD>.md
  ```

  Claude fills in the date when the routine runs. They click **Run now**, and answer each permission prompt with "always allow". The routine's later runs then don't stop to ask. Allow rules in `~/.claude/settings.json` also apply to these runs.
- **Claude Code CLI on macOS** → launchd. The guide writes the script above and `~/Library/LaunchAgents/workshop.review-lessons.<name>.plist`, after the participant says yes:

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>Label</key><string>workshop.review-lessons.<name></string>
    <key>ProgramArguments</key>
    <array><string>/bin/sh</string><string><absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons.sh</string></array>
    <key>StartCalendarInterval</key>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <key>StandardOutPath</key><string><absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons/launchd.log</string>
    <key>StandardErrorPath</key><string><absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons/launchd.log</string>
  </dict>
  </plist>
  ```

  This runs every Monday at 9:00. Load it, run it once through launchd, and read the result:

  ```bash
  plutil -lint ~/Library/LaunchAgents/workshop.review-lessons.<name>.plist
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/workshop.review-lessons.<name>.plist
  launchctl kickstart gui/$(id -u)/workshop.review-lessons.<name>
  ```

  `kickstart` returns at once, but the run takes a few minutes. Wait until `scheduled-run.json` is written and `launchd.log` stops growing, then check the result. `last exit code = 0` means it worked:

  ```bash
  launchctl print gui/$(id -u)/workshop.review-lessons.<name> | grep -i "last exit"
  ```

  To change the plist later, unload it first with `launchctl bootout gui/$(id -u)/workshop.review-lessons.<name>`. A second `bootstrap` of a loaded job fails with `Bootstrap failed: 5`.

  If `launchd.log` says `Operation not permitted`, the workshop repo is probably in `~/Documents`, `~/Desktop` or `~/Downloads`, which macOS protects. Take the Claude Desktop path instead.
- **Claude Code CLI on Linux** → cron. The guide writes the script above, then adds this line after the participant says yes. It runs every Monday at 9:00:

  ```text
  0 9 * * 1 /bin/sh <absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons.sh >> <absolute path of the workshop repo>/.workshop/targets/<name>/review-lessons/cron.log 2>&1
  ```

  ```bash
  (crontab -l 2>/dev/null; echo "<the line above>") | crontab -
  ```

  cron can't be started on demand. To run it once, they run the script with an empty environment, the way cron starts it. This proves the script and the entry, not that cron itself has run it. To see cron run it too, add a second line for a few minutes from now, wait for `cron.log`, then remove that line:

  ```bash
  env -i HOME="$HOME" /bin/sh .workshop/targets/<name>/review-lessons.sh
  ```

- **Windows** → take the Claude Desktop path.
- **Only Cursor, no Claude Code** → the same script and the same launchd or cron entry. The `claude` line changes to:

  ```sh
  agent -p --force --trust --workspace "$WORKSHOP/targets/$NAME" \
    "Follow .claude/skills/review-lessons/SKILL.md with these arguments: $REPORT" \
    > "$STATE/review-lessons/scheduled-run.txt"
  git -C "$WORKSHOP/targets/$NAME" status --short >> "$STATE/review-lessons/scheduled-run.txt"
  test -s "$REPORT"
  ```

  `--force` lets the agent run `gh api` or `glab api` without asking, as in 16.3. `git status` at the end must print nothing. The Cursor docs recommend an API key for scripts. If the test run says the agent is not logged in, the participant creates a key in the Cursor dashboard and saves it in a file outside any repo, readable only by them: `chmod 600`. The script reads it with `export CURSOR_API_KEY="$(cat <that file>)"`. The key never goes into the schedule entry, the target or the chat. If they prefer no key on disk, they take the Claude Desktop path. The Cursor CLI prints no cost figure. Say so.
- **GitLab** (`host: gitlab`) → the same schedule. The skill uses `glab api`, which the allow list already has. If the API calls fail in the test run, run `glab auth status`.
- **Target is `sample` or a catch-up target** → add the review-history folder to the skill's arguments, in the script's `claude -p` line and in the Desktop instructions. With the reference skill from catch-up, the script's line is:

  ```sh
  claude -p "/review-lessons $REPORT --data $STATE/review-history" \
  ```

  The findings stay much the same each week, because the history doesn't change. Wording, counts and the suggested file can differ between runs, and a file they changed in 17.3 changes what the report suggests. That is fine for this phase.

## 17.5 Gate check

The participant confirms, and you verify:

- [ ] Every finding has a decision (fix / skip) and a reason. — in the Phase 16 report `.workshop/targets/<name>/review-lessons/<YYYY-MM-DD>.md`, every `###` finding has a `- Decision: fix — …` or `- Decision: skip — …` line with a reason after the dash
- [ ] At least one change is committed and names its finding. — `git -C targets/<name> log --stat --grep "review-lessons:"` on `dev-days-workshop/<participant>` shows the commit, its message names a finding title from the report, and the report has its `- Change:` line
- [ ] The local schedule has run once and written a new report. — `ls -l .workshop/targets/<name>/review-lessons/scheduled-*.md` shows a file written after the schedule was added, with findings in the Phase 16 format; the schedule exists: the routine in Claude Desktop's **Routines** list with a run in its history, `launchctl print gui/$(id -u)/workshop.review-lessons.<name>`, or `crontab -l | grep review-lessons.sh`; on the CLI paths, report `total_cost_usd` from `scheduled-run.json`

---

## Phase Complete

The schedule stays on their machine after the workshop. Tell them how to remove it once Phase 18 has moved it to the cloud. `pnpm workshop cleanup` doesn't remove it.

- **Claude Desktop:** open the routine in **Routines**, click **Delete**, and check **Also delete files on disk**.
- **launchd:** `launchctl bootout gui/$(id -u)/workshop.review-lessons.<name>`, then `rm ~/Library/LaunchAgents/workshop.review-lessons.<name>.plist`.
- **cron:** `crontab -e`, and delete the line with `review-lessons.sh`.

Mark Phase 17 complete. Preview: "Phase 18 — ask how your company runs cloud agents, then move the skill to a cloud job that posts the analysis to your team."
