#!/usr/bin/env node
// PreToolUse hook: block edits to data/ (reference invoice lines and eval seeds). Exit 2 = block.
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || "{}");
const file = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? "");
const rel = file.startsWith(input.cwd ?? "\0") ? file.slice(input.cwd.length + 1) : file;
if (/(^|\/)data\//.test(rel)) {
  process.stderr.write(`Blocked: ${rel} is under data/, which holds reference data. Change code or tests instead.\n`);
  process.exit(2);
}
