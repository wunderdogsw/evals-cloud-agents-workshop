import { defineSuite, exactMatch, hasShape, shellTask } from "../../runner/index.ts";

/**
 * Skeleton suite. Phase 2 replaces every TODO.
 *
 * The task adapter decides how the eval reaches your feature:
 *   - TypeScript target: import the function directly.
 *       import { classifyLine } from "../../../src/classify.ts";
 *       task: (input) => classifyLine(input),
 *   - Any language, CLI entry point: shellTask("dotnet run --project src/Foo.Cli -- --json")
 *     (case input → stdin as JSON, stdout parsed as JSON)
 *   - Running service: httpTask("http://localhost:8080/api/classify")
 */
export default defineSuite({
  name: "example", // TODO: name it after the feature
  cases: "./cases.jsonl",
  task: shellTask("echo '{\"answer\":\"TODO\"}'"), // TODO: point at your feature
  graders: [
    hasShape({ answer: "string" }), // TODO: the fields your feature returns
    exactMatch("answer"), // TODO: compare the field that has a right answer
  ],
  threshold: { passRate: 0.8 }, // TODO: Phase 5 — pick a number you can defend
  tracks: [], // TODO: Phase 5 — files/folders of the feature under test, e.g. ["../../../src/classify.ts"]
});
