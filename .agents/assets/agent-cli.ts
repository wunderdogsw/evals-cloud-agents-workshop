/** Longest a read-only agent review may run before the helper stops it. */
export const REVIEW_TIMEOUT_MS = 10 * 60_000;

/** Characters of diff a review prompt carries. A longer diff is cut, and the prompt says so. */
export const MAX_REVIEW_DIFF = 60_000;

/**
 * Cursor CLI arguments for a headless run. Write mode passes `--force` so the agent can edit and run
 * commands without approval. Read mode uses ask mode: read-only, shell blocked, and nothing that waits
 * for an approval, so the prompt must already carry everything the agent needs to run a command for.
 */
export function cursorArgs(prompt: string, mode: "write" | "read"): string[] {
  const access = mode === "write" ? ["--force"] : ["--mode", "ask"];
  return ["-p", prompt, "--output-format", "json", "--trust", ...access];
}

/** Review instructions with the diff inlined, so the reviewer needs no shell to see the change. */
export function reviewPrompt(base: string, diff: string): string {
  const cut = diff.length > MAX_REVIEW_DIFF;
  const shown = cut ? `${diff.slice(0, MAX_REVIEW_DIFF)}\n[diff cut at ${MAX_REVIEW_DIFF} characters; read the changed files for the rest]` : diff;
  return `Review the change below: the diff of this branch against ${base}. You can read files in this checkout for context. Follow REVIEW.md if it exists, otherwise AGENTS.md / CLAUDE.md. Do not modify any files.
Report only real problems (bugs, missing tests, broken conventions, risky changes, edits to evals/suites/*/cases.jsonl or thresholds), most severe first, each with file:line and a one-line fix. If there are none, say so in one sentence. Markdown, under 300 words.

<diff>
${shown || "(no changes)"}
</diff>`;
}
