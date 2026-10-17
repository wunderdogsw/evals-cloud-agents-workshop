import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCommand } from "./push-guard.mjs";

const T = "/repo/targets/app";
const real = (branch: string | null = "dev-days-workshop/mikko") => (dir: string) =>
  dir.startsWith(T) ? { currentBranch: branch, defaultBranch: "main", unrestricted: false } : null;
const ok = (cmd: string, ctx = real(), cwd = T) => assert.equal(checkCommand(cmd, cwd, ctx).allowed, true, cmd);
const blocked = (cmd: string, ctx = real(), cwd = T) => assert.equal(checkCommand(cmd, cwd, ctx).allowed, false, cmd);

test("pushes to the workshop branch are allowed", () => {
  ok("git push");
  ok("git push -u origin dev-days-workshop/mikko");
  ok("git push origin HEAD");
  ok("git push origin HEAD:dev-days-workshop/mikko-agent-x");
  ok("git push origin --delete dev-days-workshop/mikko-agent-x");
});

test("pushes outside dev-days-workshop/* are blocked", () => {
  blocked("git push origin main");
  blocked("git push origin HEAD:main");
  blocked("git push origin feature/x");
  blocked("git push", real("main"));
  blocked("git push", real(null));
  blocked("git push origin --delete main");
  blocked("git push origin :release");
});

test("force, mirror, all and tags are blocked even on the workshop branch", () => {
  blocked("git push --force");
  blocked("git push -uf origin dev-days-workshop/mikko");
  blocked("git push --force-with-lease origin dev-days-workshop/mikko");
  blocked("git push origin +dev-days-workshop/mikko");
  blocked("git push --tags");
  blocked("git push --all origin");
  blocked("git push origin refs/tags/v1.0");
});

test("GitLab push options must target the workshop branch", () => {
  ok("git push -u origin dev-days-workshop/mikko-agent-x -o merge_request.create -o merge_request.target=dev-days-workshop/mikko");
  blocked("git push -u origin dev-days-workshop/mikko-agent-x -o merge_request.create -o merge_request.target=main");
});

test("merging into the default branch is blocked", () => {
  blocked("git merge dev-days-workshop/mikko", real("main"));
  ok("git merge main", real("dev-days-workshop/mikko"));
});

test("MR/PR creation must target the workshop branch", () => {
  ok("gh pr create --base dev-days-workshop/mikko --title x");
  blocked("gh pr create --title x");
  blocked("gh pr create -B main");
  ok("glab mr create --target-branch dev-days-workshop/mikko");
  blocked("glab mr create -b main");
  blocked("gh pr edit 3 --base main");
});

test("compound commands, cd and git -C are followed", () => {
  blocked("git status && git push origin main");
  blocked("cd targets/app && git push origin main", real(), "/repo");
  blocked("git -C targets/app push origin main", real(), "/repo");
  ok("git -C targets/app push origin dev-days-workshop/mikko", real(), "/repo");
});

test("repos that aren't workshop targets, and unrestricted targets, are left alone", () => {
  ok("git push origin main", real(), "/somewhere/else");
  ok("git push --force origin main", () => ({ currentBranch: "main", defaultBranch: "main", unrestricted: true }));
  ok("npm test && git status");
});
