import { describe, expect, it } from "vitest";
import { buildWorkspaceRepositoryPaths } from "./file-repository";

describe("file repository paths", () => {
  it("keeps project files under one predictable workspace directory", () => {
    const paths = buildWorkspaceRepositoryPaths("/Users/robert/RobertStation", "workspace_robert-station");

    expect(paths.root).toBe("/Users/robert/RobertStation/workspace_robert-station");
    expect(paths.assets).toBe("/Users/robert/RobertStation/workspace_robert-station/assets");
    expect(paths.imports).toBe("/Users/robert/RobertStation/workspace_robert-station/imports");
    expect(paths.exports).toBe("/Users/robert/RobertStation/workspace_robert-station/exports");
  });
});
