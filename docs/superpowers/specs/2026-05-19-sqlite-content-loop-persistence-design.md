# SQLite Content Loop Persistence Design

Date: 2026-05-19

## Purpose

Persist the current content loop locally so the desktop app can restart without losing topics, promoted projects, drafts, and source references.

This is a narrow storage slice. It turns the existing repository boundary into a disk-backed implementation while keeping the renderer, preload API, and user workflow unchanged.

## Scope

Included:

- Add a SQLite-backed implementation of the existing `ContentLoopRepository`.
- Use the existing SQL schema for `topics`, `source_references`, `content_projects`, and `draft_versions`.
- Seed the database on first run when no topics exist.
- Persist topic promotion so reload returns the promoted topic, new project, new draft, and selected project.
- Store the desktop database under Electron `app.getPath("userData")`.
- Keep `InMemoryContentLoopRepository` for renderer tests and simple unit tests.

Deferred:

- Full migration versioning.
- Server sync.
- encrypted secrets.
- AI provider settings.
- publish package persistence.
- metric snapshots and review reports.
- local file asset storage.

## Architecture

The existing repository interface remains the stable contract:

```ts
export interface ContentLoopRepository {
  loadContentLoop(): Promise<PersistedContentLoopState>;
  promoteTopic(topicId: string): Promise<PersistedContentLoopState>;
}
```

A new `SqliteContentLoopRepository` will live in `packages/local-store`. It owns database initialization, seed insertion, row serialization, and row-to-domain mapping. Electron main process will create one repository instance and pass it into the existing IPC registration function.

Renderer code does not change shape. It still calls:

- `window.robertStation.contentLoop.load()`
- `window.robertStation.contentLoop.promoteTopic(topicId)`

This keeps filesystem and database access out of the renderer.

## SQLite Driver Choice

Use Node's built-in `node:sqlite` `DatabaseSync` API for this first disk-backed slice.

Reasoning:

- The current runtime is Node 24, where `node:sqlite` is available.
- It avoids adding native dependencies such as `better-sqlite3` before packaging requirements are clear.
- The repository API remains async even if the internal driver is synchronous, so the implementation can later switch drivers without changing Electron IPC or React code.

Known tradeoff:

- `node:sqlite` is still experimental and emits a warning in this runtime. That is acceptable for the local PoC stage; if packaging or runtime stability becomes an issue, the repository can move to `better-sqlite3` behind the same interface.

## Data Model

The first disk-backed implementation persists these existing domain records:

- `Topic`
- `SourceReference`
- `ContentProject`
- `DraftVersion`

Tables already exist in `SQLITE_SCHEMA`:

- `topics`
- `source_references`
- `content_projects`
- `draft_versions`
- `columns`
- `workspaces`

The repository will seed the minimum parent records needed for foreign keys:

- one workspace row for `workspace_robert-station`;
- four column rows based on `DEFAULT_COLUMNS`;
- seeded topics and source references from `createSampleContentLoopSeed()`.

JSON fields:

- `Topic.targetPlatforms` stored as `target_platforms_json`;
- `Topic.score` stored as `score_json`.

Selected project:

- For this slice, `selectedProjectId` is derived from the most recently updated or created project after promotion.
- A dedicated UI-state table is deferred until we add more persisted view preferences.

## File Location

Desktop main process will create the database at:

```text
<electron userData>/robert-station.sqlite
```

Tests will use temporary database paths under the OS temp directory.

The repository will accept an explicit `databasePath` so tests and future server-side tools can create isolated stores.

## Error Handling

Repository construction should initialize schema immediately. If schema creation fails, construction fails and Electron startup should surface the error through the main process instead of silently falling back to memory.

`promoteTopic(topicId)` should remain idempotent:

- if the topic does not exist, return the current loaded state;
- if the topic is already promoted, return the current loaded state;
- otherwise update topic status and insert one project plus one draft in a transaction.

## Testing

Tests should cover behavior, not driver internals:

- opening a new repository on the same database path reloads seeded topics;
- promoting a topic persists across repository instances;
- promoting an unknown or already promoted topic does not duplicate projects;
- schema initialization creates required tables from `SQLITE_SCHEMA`.

The renderer tests keep using `InMemoryContentLoopRepository`; Electron IPC tests can remain type/build coverage for now.

## Success Criteria

This slice is complete when:

1. `SqliteContentLoopRepository` exists and implements `ContentLoopRepository`.
2. A promoted topic survives repository re-creation against the same database file.
3. Electron main process uses the SQLite repository at `app.getPath("userData")`.
4. Existing renderer behavior and tests still pass.
5. Full workspace test, typecheck, build, and production dependency audit pass.
