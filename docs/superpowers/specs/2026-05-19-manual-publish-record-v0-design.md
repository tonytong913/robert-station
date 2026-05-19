# Manual Publish Record V0 Design

Date: 2026-05-19

## Purpose

Add the first manual publishing record slice. After a project has a Xiaohongshu publishing package, the user should be able to mark it as manually published and save a publish status, publish time, and final URL.

This slice is intentionally small. It does not automate posting or collect performance data. It creates the `PublishRecord` entity that later CSV/Excel metric import can match against.

## Scope

Included:

- Add `PublishRecord` domain model.
- Create or replace one manual publish record for a platform package.
- Persist publish records in SQLite.
- Expose record creation through Electron IPC and preload.
- Add a compact publish-record form in Creation Studio.
- Show publish record status and URL after saving.

Deferred:

- automatic posting.
- platform login or browser automation.
- URL validation beyond non-empty string.
- multiple publish records per package.
- metric snapshots and CSV/Excel data import.
- publish scheduling.

## User Flow

1. User promotes a topic into a project.
2. User generates a draft.
3. User generates a Xiaohongshu package.
4. User manually publishes it on Xiaohongshu outside the app.
5. User returns to Creation Studio.
6. User enters or accepts a publish time and optional URL.
7. User clicks `Save publish record`.
8. App saves one publish record linked to the selected platform package.
9. App shows the saved status and URL.

## Architecture

The feature adds one repository workflow:

```ts
recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define `PublishRecord` and `ManualPublishInput`, plus deterministic manual publish record creation.
- `@robert-station/local-store`: find the platform package, create or replace the publish record, and return refreshed state.
- Electron main process: validate payload shape before delegating to the repository.
- Preload: expose `window.robertStation.contentLoop.recordManualPublish(input)`.
- Renderer: add form state and save action in Creation Studio.

Renderer does not access filesystem, platform credentials, or direct SQLite APIs.

## Data Model

Add `PublishRecord`:

```ts
interface PublishRecord {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  platformPackageId: EntityId;
  platform: Platform;
  status: "published";
  publishedAt: string;
  url: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}
```

Add `ManualPublishInput`:

```ts
interface ManualPublishInput {
  platformPackageId: EntityId;
  publishedAt: string;
  url?: string;
  note?: string;
}
```

SQLite adds `publish_records` with:

- `id`
- `remote_id`
- `workspace_id`
- `content_project_id`
- `platform_package_id`
- `platform`
- `status`
- `published_at`
- `url`
- `note`
- `sync_status`
- `created_at`
- `updated_at`

The repository state adds:

```ts
publishRecords: PublishRecord[];
```

## Record Rules

V0 supports manual records only.

The generated ID is deterministic by package:

```text
publish-record_<platform-package-id>
```

Repeated saves for the same package replace the existing record. `createdAt` remains stable on replacement, while `updatedAt`, `publishedAt`, `url`, and `note` update.

The repository updates the related project status to `published` when the record is saved.

## Persistence

Repository behavior:

- find the platform package by `platformPackageId`;
- if missing, return current state unchanged;
- create deterministic publish record from the package and input;
- upsert publish record;
- update the related project status to `published`;
- return full content-loop state with `selectedProjectId` set to the package project.

Publish records are loaded newest first by `publishedAt`, then `updatedAt`.

## UI

Creation Studio adds a publish record section inside the Xiaohongshu package area when a selected package exists:

- `publishedAt` input with current local ISO-like value as default;
- URL input;
- optional note input;
- `Save publish record` button;
- loading and inline error state;
- saved record display showing `Published`, publish time, and URL.

No publish button is shown. The user still publishes manually outside the app.

## Error Handling

Repository-level missing package:

- return the current state unchanged.

IPC-level invalid payload:

- reject with:

```text
Invalid manual publish input.
```

Renderer-level failure:

- show:

```text
Could not save publish record. Try again.
```

Existing draft, package, archive, and knowledge content must remain visible when saving fails.

## Testing

Core tests:

- manual publish record generation is deterministic for a platform package.
- optional URL and note default to empty strings.

Local-store tests:

- in-memory repository records a manual publish and marks the project as `published`.
- repeated manual publish saves replace the same record and preserve `createdAt`.
- SQLite repository persists publish records across repository instances.
- missing package does not insert records.

Desktop tests:

- preload/loader calls `recordManualPublish(input)`.
- IPC rejects invalid payloads.
- Creation Studio saves a manual publish record for a Xiaohongshu package.
- save failure shows inline error and keeps current package visible.

## Success Criteria

This slice is complete when:

1. A Xiaohongshu package can be marked as manually published.
2. Publish records are stored as separate entities.
3. Re-saving the same package replaces the existing record.
4. Publish records survive SQLite reload.
5. Creation Studio shows saved publish status and URL.
6. Existing topic, creation, publish package, and archive flows still work.
7. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
