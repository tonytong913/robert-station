# Archive Assistant V0 Design

Date: 2026-05-19

## Purpose

Add the first archive-and-knowledge slice. After a project has a draft and optional platform package, the user should be able to archive it into a stable local record and extract a small reusable knowledge item for later review.

This slice does not implement post-publish data analysis. It creates the local archive model and the sync-ready shape needed for the future self-hosted server archive.

## Scope

Included:

- Add `ArchiveRecord` for a content project's archived snapshot.
- Add `KnowledgeItem` for reusable conclusions extracted from the project.
- Add deterministic archive generation from project, latest draft, latest platform package, topic, and sources.
- Persist archive records and knowledge items in SQLite.
- Expose archive generation through Electron IPC and preload.
- Add an Archive action and Knowledge view in the desktop app.

Deferred:

- Server API and sync queue execution.
- publish URL and manual publish status.
- CSV/Excel metrics import.
- review reports based on performance data.
- full-text search and embeddings.
- editing archived knowledge items.

## User Flow

1. User promotes a topic into a project.
2. User generates or reviews a draft.
3. User optionally generates a Xiaohongshu package.
4. User clicks `Archive project`.
5. App creates or replaces one archive record for the project.
6. App creates or replaces a knowledge item linked to that archive record.
7. User opens `Knowledge` to see reusable lessons across archived projects.

## Architecture

The feature adds one repository workflow:

```ts
archiveProject(projectId: string): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define `ArchiveRecord`, `KnowledgeItem`, and deterministic archive generation.
- `@robert-station/local-store`: find the project, latest draft, latest package, topic, and sources; upsert archive and knowledge records.
- Electron main process: validate project ID and delegate to repository.
- Preload: expose `window.robertStation.contentLoop.archiveProject(projectId)`.
- Renderer: add `Archive project` action and a `Knowledge` screen.

Renderer does not access filesystem, database, server credentials, or future sync tokens.

## Data Model

Add `ArchiveRecord`:

```ts
interface ArchiveRecord {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  draftVersionId?: EntityId;
  platformPackageId?: EntityId;
  title: string;
  summary: string;
  sourceCount: number;
  packageCount: number;
  status: "archived";
  createdAt: string;
  updatedAt: string;
}
```

Add `KnowledgeItem`:

```ts
interface KnowledgeItem {
  id: EntityId;
  workspaceId: EntityId;
  archiveRecordId: EntityId;
  contentProjectId: EntityId;
  columnSlug: ContentColumnSlug;
  title: string;
  lesson: string;
  evidence: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

SQLite adds:

- `archive_records`
- `knowledge_items`

Both tables include `remote_id`, `sync_status`, `created_at`, and `updated_at` so future server archive sync can attach remote IDs without changing the local entity model.

The repository state adds:

```ts
archiveRecords: ArchiveRecord[];
knowledgeItems: KnowledgeItem[];
```

## Generation Rules

V0 archive generation is deterministic and conservative.

Inputs:

- `ContentProject`
- latest `DraftVersion` when available
- latest `PlatformPackage` when available
- source `Topic` when available
- related `SourceReference[]`
- timestamp

Outputs:

- one `ArchiveRecord` per content project;
- one `KnowledgeItem` per archive record.

IDs are deterministic:

```text
archive-record_<project-id>
knowledge-item_<project-id>
```

Repeated archive generation for the same project replaces the archive and knowledge item. This keeps v0 simple while still giving the latest project state a stable archive entry.

Archive summary uses:

- topic hook if present;
- latest draft title/body;
- platform package platform and title if present;
- source count and package count.

Knowledge lesson uses a practical conclusion format:

```text
Reusable lesson: <project angle> works best when the draft, source notes, and platform package stay linked.
```

This is intentionally not a performance review. Metrics-based conclusions remain deferred until data import exists.

## Persistence

Repository behavior:

- find the project by `projectId`;
- find latest draft by version and timestamp;
- find latest platform package by updated timestamp;
- find source topic and project/topic source references;
- if project is missing, return current state unchanged;
- generate archive and knowledge item;
- upsert both records in one transaction;
- update the project status to `archived`;
- return full content-loop state with `selectedProjectId` set to the project.

Records are loaded newest first.

## UI

Navigation adds one screen:

```text
Knowledge
```

Creation Studio adds:

- `Archive project` button beside generation actions;
- loading and inline error state;
- a small archive status area when the selected project has an archive record.

Knowledge screen shows:

- empty state if no archived knowledge exists;
- list of knowledge items;
- each item displays column, title, lesson, evidence, and tags.

The UI remains operational and compact. This is not a search interface yet.

## Error Handling

Repository-level missing project:

- return the current state unchanged.

IPC-level invalid project ID:

- reject with:

```text
Invalid content project id.
```

Renderer-level failure:

- show:

```text
Could not archive project. Try again.
```

Existing draft, package, and prior archive content must remain visible when archive generation fails.

## Testing

Core tests:

- archive generation creates deterministic archive and knowledge IDs;
- source count and package count are captured;
- knowledge item uses the project's column slug and evidence.

Local-store tests:

- in-memory repository archives a project and creates one knowledge item;
- repeated archive generation replaces the same archive and knowledge item;
- SQLite repository persists archive records and knowledge items across repository instances;
- missing project does not insert archive records.

Desktop tests:

- preload/loader calls `archiveProject(projectId)`;
- IPC rejects empty project IDs;
- Creation Studio archives the selected project and shows archived status;
- archive failure shows an inline error and keeps current draft/package content visible;
- Knowledge screen lists archived knowledge items.

## Success Criteria

This slice is complete when:

1. A selected project can be archived from Creation Studio.
2. Archive records and knowledge items are stored as separate entities.
3. Re-archiving the same project replaces the existing archive and knowledge item.
4. Archive records and knowledge items survive SQLite reload.
5. Knowledge screen shows reusable local knowledge items.
6. Existing topic, creation, and publish package flows still work.
7. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
