import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // evals/ is a separate package installed by the workshop kit.
    exclude: [...configDefaults.exclude, "evals/**"],
  },
});
