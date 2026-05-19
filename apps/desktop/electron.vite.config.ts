import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@robert-station/local-store", "@robert-station/core"]
      })
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
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
