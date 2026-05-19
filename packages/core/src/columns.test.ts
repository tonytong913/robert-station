import { describe, expect, it } from "vitest";
import { DEFAULT_COLUMNS, createDefaultWorkspaceSeed } from "./columns";

describe("default content columns", () => {
  it("treats AI, finance, parenting, and fitness as equal-priority columns", () => {
    expect(DEFAULT_COLUMNS.map((column) => column.slug)).toEqual([
      "ai",
      "finance",
      "parenting",
      "fitness"
    ]);
    expect(new Set(DEFAULT_COLUMNS.map((column) => column.priority))).toEqual(new Set([1]));
  });

  it("creates a workspace seed with one persona and four columns", () => {
    const seed = createDefaultWorkspaceSeed("Robert Station");

    expect(seed.workspace.name).toBe("Robert Station");
    expect(seed.personas).toHaveLength(1);
    expect(seed.columns).toHaveLength(4);
    expect(seed.platformAccounts).toEqual([]);
    expect(seed.columns.every((column) => column.workspaceId === seed.workspace.id)).toBe(true);
  });
});
