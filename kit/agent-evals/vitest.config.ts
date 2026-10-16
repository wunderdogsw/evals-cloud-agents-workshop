import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // fixtures/ holds hidden tests for the sample target — they only run inside task workspaces.
    exclude: [...configDefaults.exclude, "fixtures/**"],
    testTimeout: 60_000,
  },
});
