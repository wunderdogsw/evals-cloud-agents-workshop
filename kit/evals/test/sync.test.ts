import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The sample target carries its own copy of the provider code so it stands alone when attached.
describe("sample keeps provider code in sync", () => {
  for (const f of ["llm", "models"]) {
    it(`${f}.ts`, () => {
      const kit = readFileSync(new URL(`../src/${f}.ts`, import.meta.url), "utf8");
      const sample = readFileSync(new URL(`../../../samples/cost-coder/src/llm/${f}.ts`, import.meta.url), "utf8").split("\n").slice(1).join("\n");
      expect(sample).toBe(kit);
    });
  }
});
