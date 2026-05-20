# Review Knowledge V0 Design

Date: 2026-05-20

## Purpose

Add the first workflow for extracting reusable knowledge from a saved review report. After a project has been archived and reviewed, the user should be able to turn the review conclusion into one durable `KnowledgeItem` shown in the existing Knowledge screen.

This slice stays local and deterministic. It does not change the `KnowledgeItem` model; review-derived knowledge must attach to an existing archive record.

## Scope

Included:

- Add deterministic review-to-knowledge generation.
- Require an existing `ArchiveRecord` for the review report's project.
- Create or replace one review-derived `KnowledgeItem` per review report.
- Persist extracted knowledge in memory and SQLite.
- Expose extraction through Electron IPC and preload.
- Add a compact `Extract knowledge` action inside the latest review report card.

Deferred:

- Changing `KnowledgeItem` schema.
- Extracting knowledge before archive.
- Multiple knowledge items per review report.
- Editable knowledge items.
- Knowledge search or filters.
- Real AI knowledge extraction.

## User Flow

1. User publishes a project and imports metrics.
2. User archives the project.
3. User generates a review report.
4. User clicks `Extract knowledge` from the review report card.
5. App creates or replaces one knowledge item linked to the existing archive record.
6. User opens Knowledge and sees the review-derived reusable lesson.

If the project is not archived yet, the UI shows:

```text
Archive this project before extracting review knowledge.
```

## Architecture

The feature adds one repository workflow:

```ts
extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define deterministic helper that turns `ReviewReport`, `ContentProject`, `ArchiveRecord`, and optional `MetricSnapshot` into a `KnowledgeItem`.
- `@robert-station/local-store`: find the review report and matching archive record, upsert the generated knowledge item, and return refreshed state.
- Electron main process: validate `reviewReportId` and delegate to the repository.
- Preload: expose `window.robertStation.contentLoop.extractReviewKnowledge(reviewReportId)`.
- Renderer: add loading state, missing-archive message, success status, and call the loader from the review card.

Renderer still does not access SQLite, filesystem, server credentials, or AI credentials.

## Generation Rules

Inputs:

- `ReviewReport`
- related `ContentProject`
- existing `ArchiveRecord`
- optional `MetricSnapshot`
- column slug derived from `project.primaryColumnId`
- timestamp

Knowledge ID is deterministic:

```text
knowledge-item-review_<review-report-id>
```

Repeated extraction for the same review report replaces the same item. Existing `createdAt` is preserved; `updatedAt`, lesson, evidence, and tags are refreshed.

Generated item fields:

- `archiveRecordId`: existing archive record ID.
- `contentProjectId`: review report project ID.
- `columnSlug`: derived from the project primary column.
- `title`: `Review lesson: <project title>`.
- `lesson`: concise reusable lesson from report summary plus the first next action.
- `evidence`: references review report version and metric snapshot when present.
- `tags`: column slug, `review`, `performance`, and `metrics` when a metric snapshot exists.

The helper must not invent performance claims. It should use only report fields and optional metric snapshot metadata.

## Persistence

Repository behavior:

- find review report by `reviewReportId`;
- if missing, return current state unchanged;
- find related project;
- if missing, return current state unchanged;
- find archive record for the project;
- if missing, return current state unchanged and let the renderer show the archive-required message;
- find metric snapshot by `reviewReport.metricSnapshotId` when present;
- generate the knowledge item;
- upsert it into `knowledge_items`;
- return full content-loop state with `selectedProjectId` set to the review report project.

SQLite reuses the existing `knowledge_items` table. No schema change is required.

## UI

Creation Studio adds the action inside the latest review report card:

- `Extract knowledge` button;
- disabled/loading state while extraction runs;
- inline message when archive is required;
- compact success message such as `Knowledge extracted`.

The existing Knowledge screen remains unchanged and lists the generated item alongside archive-derived items.

## Error Handling

Repository-level missing review report or project:

- return current state unchanged.

Repository-level missing archive record:

- return current state unchanged.

IPC-level invalid review report ID:

- reject with:

```text
Invalid review report id.
```

Renderer-level missing archive record:

- show:

```text
Archive this project before extracting review knowledge.
```

Renderer-level rejection:

- show:

```text
Could not extract review knowledge. Try again.
```

Existing draft, package, publish record, metrics, review report, archive, and knowledge content must remain visible when extraction fails.

## Testing

Core tests:

- review knowledge generation is deterministic.
- lesson uses report summary and first next action.
- evidence references review version and metric snapshot when present.
- tags include column, review, performance, and metrics when applicable.

Local-store tests:

- in-memory extraction creates a knowledge item when an archive exists.
- repeated extraction replaces the same item and preserves `createdAt`.
- extraction is a no-op when the review report is missing.
- extraction is a no-op when the archive record is missing.
- SQLite persists review-derived knowledge across repository instances.

Desktop tests:

- preload/loader calls `extractReviewKnowledge(reviewReportId)`.
- IPC rejects empty review report IDs.
- Creation Studio extracts knowledge from a review report after archiving.
- missing archive shows the archive-required message.
- extraction failure shows inline error and keeps current content visible.

## Success Criteria

This slice is complete when:

1. A review report can create one deterministic knowledge item after the project is archived.
2. Extraction without an archive does not mutate state and shows a clear UI message.
3. Re-extraction replaces the same item and preserves its creation timestamp.
4. Review-derived knowledge survives SQLite reload.
5. Knowledge screen lists the extracted item.
6. Existing topic, creation, publish, manual publish, metrics, archive, review, and knowledge flows still work.
7. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
