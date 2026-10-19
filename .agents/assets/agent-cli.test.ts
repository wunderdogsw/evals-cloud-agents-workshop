import { test } from "node:test";
import assert from "node:assert/strict";
import { cursorArgs, MAX_REVIEW_DIFF, reviewPrompt } from "./agent-cli.ts";

test("Cursor read mode is ask mode and never forces", () => {
  const argv = cursorArgs("review", "read");
  assert.deepEqual(argv.slice(argv.indexOf("--mode"), argv.indexOf("--mode") + 2), ["--mode", "ask"]);
  assert.ok(!argv.includes("--force"));
  assert.ok(argv.includes("--trust"));
});

test("Cursor write mode forces and is not ask mode", () => {
  const argv = cursorArgs("fix it", "write");
  assert.ok(argv.includes("--force"));
  assert.ok(!argv.includes("--mode"));
});

test("the review prompt carries the diff and asks for no shell", () => {
  const p = reviewPrompt("origin/dev-days-workshop/mikko", "diff --git a/x b/x\n+1");
  assert.match(p, /<diff>\ndiff --git a\/x b\/x\n\+1\n<\/diff>/);
  assert.match(p, /against origin\/dev-days-workshop\/mikko/);
  assert.doesNotMatch(p, /run `git diff/);
});

test("a long diff is cut and the prompt says so", () => {
  const p = reviewPrompt("main", "x".repeat(MAX_REVIEW_DIFF + 10));
  assert.match(p, /diff cut at/);
  assert.ok(p.length < MAX_REVIEW_DIFF + 2_000);
});

test("an empty diff is named", () => {
  assert.match(reviewPrompt("main", ""), /\(no changes\)/);
});
