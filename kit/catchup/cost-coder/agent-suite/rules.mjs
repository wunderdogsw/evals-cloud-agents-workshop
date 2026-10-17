// Reference rule graders for cost-coder (catch-up). Rules from kit/catchup/cost-coder/expectations.md.
// Keep this file free of imports: the workshop kit loads it from the target.

/** @type {{ name: string, description?: string, tasks?: string[], grade: (ctx: any) => any }[]} */
export default [
  {
    // R1 — tests run offline: no test file the agent wrote may reach the real model client.
    name: "R1",
    description: "Tests pass offline; no real API calls in unit tests",
    grade: (ctx) => {
      const real = /@anthropic-ai\/sdk|ANTHROPIC_API_KEY|claudeCodeClient\(|cursorClient\(/;
      const offenders = ctx.patch
        .split(/^diff --git /m)
        .filter((chunk) => /^a\/test\/\S+ /.test(chunk))
        .filter((chunk) => chunk.split("\n").some((l) => l.startsWith("+") && !l.startsWith("+++") && real.test(l)))
        .map((chunk) => chunk.slice(2, chunk.indexOf(" ")));
      return { pass: offenders.length === 0, reason: `real model client in ${offenders.join(", ")}` };
    },
  },
  {
    // R3 — every new src module comes with test/<module>.test.ts.
    name: "R3",
    description: "New modules get a matching test/<module>.test.ts",
    tasks: ["vat-split", "credit-note", "csv-import", "code-lookup"],
    grade: (ctx) => {
      const modules = ctx.added("src/*.ts").map((p) => p.slice("src/".length, -".ts".length));
      const missing = modules.filter((m) => ctx.added(`test/${m}.test.ts`).length === 0);
      return { pass: modules.length > 0 && missing.length === 0, reason: modules.length ? `no test for ${missing.join(", ")}` : "no new module in src/" };
    },
  },
  {
    // R4 — reference data is never edited.
    name: "R4",
    description: "Never edit files under data/",
    grade: (ctx) => {
      const hits = ctx.touched("data/**");
      return { pass: hits.length === 0, reason: `edited ${hits.join(", ")}` };
    },
  },
];
