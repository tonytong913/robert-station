// @vitest-environment node

import { describe, expect, it } from "vitest";

import electronConfig from "../../electron.vite.config";

type ExternalizeDepsPlugin = {
  name?: string;
  config?: (config: MutableBuildConfig, env: { command: "build"; mode: string }) => void;
};

type MutableBuildConfig = {
  build: {
    rollupOptions?: {
      external?: unknown[];
    };
  };
};

describe("electron vite config", () => {
  it("bundles workspace runtime packages in the main process", () => {
    const desktopConfig = electronConfig as { main?: { plugins?: unknown[] } };
    const mainConfig = desktopConfig.main;
    const externalizePlugin = mainConfig?.plugins?.find((plugin): plugin is ExternalizeDepsPlugin => {
      return isExternalizeDepsPlugin(plugin);
    });

    expect(externalizePlugin).toBeDefined();

    const config: MutableBuildConfig = { build: {} };
    const pluginConfig = externalizePlugin?.config;

    expect(pluginConfig).toBeDefined();

    if (typeof pluginConfig === "function") {
      pluginConfig(config, { command: "build", mode: "test" });
    }

    const external = config.build.rollupOptions?.external ?? [];

    expect(external).not.toContain("@robert-station/agent-runtime");
  });

  it("keeps ws optional native dependencies external in the main process", () => {
    const desktopConfig = electronConfig as { main?: MainProcessConfig };
    const external = desktopConfig.main?.build?.rollupOptions?.external ?? [];

    expect(external).toContain("bufferutil");
    expect(external).toContain("utf-8-validate");
  });
});

function isExternalizeDepsPlugin(plugin: unknown): plugin is ExternalizeDepsPlugin {
  return typeof plugin === "object"
    && plugin !== null
    && "name" in plugin
    && plugin.name === "vite:externalize-deps";
}

type MainProcessConfig = {
  build?: {
    rollupOptions?: {
      external?: unknown[];
    };
  };
  plugins?: unknown[];
};
