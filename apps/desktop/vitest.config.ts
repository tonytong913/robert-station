import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/renderer/**/*.test.tsx"],
    setupFiles: ["src/renderer/test-setup.ts"]
  }
});
