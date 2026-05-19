import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
