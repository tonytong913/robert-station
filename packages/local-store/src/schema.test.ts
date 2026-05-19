import { describe, expect, it } from "vitest";
import { SQLITE_SCHEMA, getSqliteSchemaStatements } from "./schema";

describe("SQLite schema", () => {
  it("contains core foundation and content loop tables", () => {
    for (const table of [
      "workspaces",
      "personas",
      "platform_accounts",
      "columns",
      "topics",
      "content_projects",
      "draft_versions",
      "source_references",
      "platform_packages",
      "publish_records",
      "archive_records",
      "knowledge_items",
      "assets"
    ]) {
      expect(SQLITE_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("tracks sync metadata on local-first entities", () => {
    expect(SQLITE_SCHEMA).toContain("remote_id TEXT");
    expect(SQLITE_SCHEMA).toContain("sync_status TEXT NOT NULL DEFAULT 'local'");
    expect(SQLITE_SCHEMA).toContain("updated_at TEXT NOT NULL");
  });

  it("returns executable statements without empty entries", () => {
    const statements = getSqliteSchemaStatements();

    expect(statements.length).toBeGreaterThan(8);
    expect(statements.every((statement) => statement.endsWith(";"))).toBe(true);
    expect(statements.every((statement) => statement.trim().length > 1)).toBe(true);
  });
});
