import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // evals/ is a separate package installed in Phase 2.
    exclude: [...configDefaults.exclude, "evals/**"],
  },
});
