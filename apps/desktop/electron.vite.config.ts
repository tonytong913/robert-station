import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@robert-station/agent-runtime", "@robert-station/local-store", "@robert-station/core"]
      })
    ],
    build: {
      rollupOptions: {
        external: ["bufferutil", "utf-8-validate"]
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].js"
        }
      }
    }
  },
  renderer: {
    root: ".",
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer")
      }
    },
    build: {
      rollupOptions: {
        input: resolve("index.html")
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: ["src/renderer/test-setup.ts"]
    }
  }
});
