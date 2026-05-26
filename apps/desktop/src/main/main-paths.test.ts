import { describe, expect, it } from "vitest";

import { getMainAssetPaths } from "./main-paths";

describe("main asset paths", () => {
  it("resolves preload and renderer files from the compiled main module URL", () => {
    const paths = getMainAssetPaths(new URL("file:///app/out/main/main.js"));

    expect(paths.preloadPath).toBe("/app/out/preload/preload.js");
    expect(paths.rendererHtmlPath).toBe("/app/out/renderer/index.html");
  });
});
