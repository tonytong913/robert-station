import { describe, expect, it } from "vitest";
import { SQLITE_SCHEMA } from "./schema";

describe("SQLite schema", () => {
  it("contains core foundation tables", () => {
    for (const table of ["workspaces", "personas", "platform_accounts", "columns", "content_projects", "assets"]) {
      expect(SQLITE_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("tracks sync metadata on local-first entities", () => {
    expect(SQLITE_SCHEMA).toContain("remote_id TEXT");
    expect(SQLITE_SCHEMA).toContain("sync_status TEXT NOT NULL DEFAULT 'local'");
    expect(SQLITE_SCHEMA).toContain("updated_at TEXT NOT NULL");
  });
});
