import { test } from "node:test";
import assert from "node:assert/strict";
import { changeRequestProblems, cloudBranchName, cloudTaskPrompt, cursorAgentRequest, remoteWebUrl } from "./cloud-agent.ts";

const W = "dev-days-workshop/mikko";

test("the cloud branch sits under the workshop branch", () => {
  assert.equal(cloudBranchName(W, "parse-invoice-csv", "a1b2"), "dev-days-workshop/mikko-cloud-parse-invoice-csv-a1b2");
  assert.equal(cloudBranchName(W, "a-very-long-title-that-goes-on-and-on-forever", "x"), "dev-days-workshop/mikko-cloud-a-very-long-title-that-goes-on-x");
  assert.equal(cloudBranchName(W, "add-searchcodes-to-src-lookup.ts", "z6ul"), "dev-days-workshop/mikko-cloud-add-searchcodes-to-src-lookup-z6ul");
  assert.equal(cloudBranchName(W, "...", "z6ul"), "dev-days-workshop/mikko-cloud-task-z6ul");
});

test("a task given as one line is not repeated", () => {
  const p = cloudTaskPrompt({ title: "Add searchCodes", body: "Add searchCodes", branch: `${W}-cloud-x`, base: W });
  assert.equal(p.match(/Add searchCodes/g)?.length, 1);
});

test("the task prompt names the branch and the base, and opens no pull request", () => {
  const p = cloudTaskPrompt({ title: "Parse CSV", body: "Add parseInvoiceCsv.", branch: `${W}-cloud-parse-csv-a1b2`, base: W });
  assert.match(p, /Work on the branch dev-days-workshop\/mikko-cloud-parse-csv-a1b2 and push only to that branch/);
  assert.match(p, /Do not open a pull request/);
  assert.match(p, /into dev-days-workshop\/mikko, ready for review/);
});

test("a cloud pull request from the workshop branch into it, ready for review, has no problems", () => {
  assert.deepEqual(changeRequestProblems({ head: `${W}-cloud-x-a1b2`, base: W, isDraft: false }, W), []);
});

test("a cursor/… head, a wrong base and a draft are each reported", () => {
  const problems = changeRequestProblems({ head: "cursor/parse-invoice-csv-0663", base: "main", isDraft: true }, W);
  assert.equal(problems.length, 3);
  assert.match(problems[0]!, /head branch is cursor\/parse-invoice-csv-0663/);
  assert.match(problems[1]!, /base branch is main/);
  assert.match(problems[2]!, /draft/);
});

test("the workshop branch itself is not a valid head", () => {
  assert.equal(changeRequestProblems({ head: W, base: W, isDraft: false }, W).length, 1);
});

test("remotes become https URLs without credentials or .git", () => {
  assert.equal(remoteWebUrl("git@github.com:juusokor/cost-coder.git"), "https://github.com/juusokor/cost-coder");
  assert.equal(remoteWebUrl("ssh://git@gitlab.example.com/group/sub/repo.git"), "https://gitlab.example.com/group/sub/repo");
  assert.equal(remoteWebUrl("https://token@github.com/juusokor/cost-coder.git"), "https://github.com/juusokor/cost-coder");
  assert.equal(remoteWebUrl("https://github.com/juusokor/cost-coder"), "https://github.com/juusokor/cost-coder");
});

test("the API request starts on the cloud branch, pushes to it, and opens no pull request", () => {
  const r = cursorAgentRequest({ name: "Parse CSV", prompt: "do it", remote: "git@github.com:o/r.git", branch: `${W}-cloud-x-a1b2` });
  assert.deepEqual(r.repos, [{ url: "https://github.com/o/r", startingRef: `${W}-cloud-x-a1b2` }]);
  assert.equal(r.workOnCurrentBranch, true);
  assert.equal(r.autoCreatePR, false);
  assert.deepEqual(r.prompt, { text: "do it" });
});
