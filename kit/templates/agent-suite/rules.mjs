// Rule graders for the agent evals: one per code-checkable rule in expectations.md.
// Each grader sees the agent's change (not its words) and returns { pass, reason } or a boolean.
// Keep this file free of imports: the workshop kit loads it from here.
//
// ctx.changes            [{ path, status: "A" | "M" | "D" | "R" }]
// ctx.touched(glob)      changed paths matching a glob, e.g. "data/**"
// ctx.added(glob?)       added paths, optionally matching a glob
// ctx.patch              the full diff
// ctx.run(command)       { code, output } from a command in the task workspace (fresh runs only)
// ctx.task               { id, prompt, tags }
//
// Prove each grader with a planted violation:
//   pnpm agent-evals grade-patch targets/<name> --tasks <tasks-file> --task <id> --patch planted.diff --rules <this file>

/** @type {{ name: string, description?: string, tasks?: string[], grade: (ctx: any) => any }[]} */
export default [
  // Example — "Never edit files under data/":
  // {
  //   name: "R4",
  //   description: "Never edit files under data/",
  //   grade: (ctx) => {
  //     const hits = ctx.touched("data/**");
  //     return { pass: hits.length === 0, reason: `edited ${hits.join(", ")}` };
  //   },
  // },
];
