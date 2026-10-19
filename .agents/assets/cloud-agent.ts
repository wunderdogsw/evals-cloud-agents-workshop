/** Cursor Cloud Agents API endpoint that creates an agent and starts its first run. */
export const CURSOR_AGENTS_URL = "https://api.cursor.com/v1/agents";

/** A merge request or pull request as the host CLI reports it. */
export interface ChangeRequest {
  head: string;
  base: string;
  isDraft: boolean;
  url?: string;
}

/** Body of the Cursor Cloud Agents API call that starts an agent. */
export interface CursorAgentRequest {
  name: string;
  prompt: { text: string };
  repos: { url: string; startingRef: string }[];
  workOnCurrentBranch: true;
  autoCreatePR: false;
}

/**
 * The branch a cloud agent works and pushes on. It sits under the participant's workshop branch, so it
 * passes the push guard's rule even on a VM where the guard does not run.
 */
export function cloudBranchName(workBranch: string, titleSlug: string, suffix: string): string {
  const words = titleSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30).replace(/^-+|-+$/g, "");
  return `${workBranch}-cloud-${words || "task"}-${suffix}`;
}

/** Task text for a cloud agent: the task, the one branch it may push to, and no pull request of its own. */
export function cloudTaskPrompt(o: { title: string; body: string; branch: string; base: string }): string {
  const task = o.body.trim() === o.title.trim() ? o.title : `${o.title}\n\n${o.body}`;
  return `${task}

You are working unattended in a cloud VM; nobody can answer questions, so make reasonable assumptions and list them at the end.
- Work on the branch ${o.branch} and push only to that branch. Do not create any other branch.
- Do not open a pull request or merge request; the workshop helper opens one into ${o.base}, ready for review.
- Follow AGENTS.md / CLAUDE.md and run the tests.
- Do not edit evals/suites/agent/ (rule graders, rubrics, thresholds, last-run.json).
- Finish with a short summary: what you changed, what you assumed, what you did not do.`;
}

/**
 * What is wrong with a cloud agent's merge request or pull request: it must come from a branch under the
 * participant's workshop branch, target the workshop branch, and be ready for review. Empty when all hold.
 */
export function changeRequestProblems(cr: ChangeRequest, workBranch: string): string[] {
  const problems: string[] = [];
  if (!cr.head.startsWith(`${workBranch}-`)) problems.push(`head branch is ${cr.head}, not a ${workBranch}-… branch`);
  if (cr.base !== workBranch) problems.push(`base branch is ${cr.base}, not ${workBranch}`);
  if (cr.isDraft) problems.push("it is a draft, not ready for review");
  return problems;
}

/** The https URL of a git remote, as the Cursor API expects it: `git@host:group/repo.git` → `https://host/group/repo`. */
export function remoteWebUrl(remote: string): string {
  const ssh = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?\/?$/.exec(remote);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  return remote.replace(/^http:\/\//, "https://").replace(/\/\/[^@/]+@/, "//").replace(/(\.git)?\/?$/, "");
}

/** The API request that starts a Cursor cloud agent on an existing branch, pushing only to that branch. */
export function cursorAgentRequest(o: { name: string; prompt: string; remote: string; branch: string }): CursorAgentRequest {
  return {
    name: o.name.slice(0, 100),
    prompt: { text: o.prompt },
    repos: [{ url: remoteWebUrl(o.remote), startingRef: o.branch }],
    workOnCurrentBranch: true,
    autoCreatePR: false,
  };
}
