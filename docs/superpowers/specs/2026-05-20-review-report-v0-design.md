# Review Report V0 Design

Date: 2026-05-20

## Purpose

Add the first single-project review workflow after metrics import. Once a project has a manual publish record and optional metric snapshots, the user should be able to generate a deterministic local review report that summarizes performance, likely causes, and next actions.

This slice stays local and mock-based. It creates the `ReviewReport` entity and workflow seam for later AI review generation and knowledge extraction.

## Scope

Included:

- Add `ReviewReport` domain model.
- Generate a deterministic review report for one `PublishRecord`.
- Use the linked project, package, latest metric snapshot, and publish record as inputs.
- Persist review reports in SQLite.
- Keep reports versioned instead of overwriting previous reports.
- Expose review generation through Electron IPC and preload.
- Add a compact review action and latest-report display in Creation Studio.

Deferred:

- Real cloud model calls.
- Cross-project, column, platform, persona, or account analytics.
- Knowledge item extraction from review reports.
- Editable review reports.
- Charts, dashboards, and advanced scoring.
- Server sync execution.

## User Flow

1. User promotes a topic into a project.
2. User generates a Xiaohongshu package.
3. User records manual publishing.
4. User optionally imports metrics CSV and saves metric snapshots.
5. User clicks `Generate review report`.
6. App saves a new review report version for that publish record.
7. Creation Studio shows the latest report summary, signals, likely causes, and next actions.

## Architecture

The feature adds one repository workflow:

```ts
generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define `ReviewReport` and deterministic review generation.
- `@robert-station/local-store`: find the publish record, project, platform package, latest metric snapshot, compute the next report version, persist the report, and return refreshed state.
- Electron main process: validate the publish record ID before delegating to the repository.
- Preload: expose `window.robertStation.contentLoop.generateReviewReport(publishRecordId)`.
- Renderer: add loading state, error state, action button, and latest report display near the selected publish record and metrics import area.

Renderer does not access the database, filesystem, platform credentials, or future AI provider credentials.

## Data Model

Add `ReviewReport`:

```ts
interface ReviewReport {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  publishRecordId: EntityId;
  metricSnapshotId?: EntityId;
  version: number;
  summary: string;
  highlights: string[];
  underperformingSignals: string[];
  likelyCauses: string[];
  nextActions: string[];
  createdAt: string;
  updatedAt: string;
}
```

SQLite adds `review_reports`:

- `id`
- `remote_id`
- `workspace_id`
- `content_project_id`
- `publish_record_id`
- `metric_snapshot_id`
- `version`
- `summary`
- `highlights_json`
- `underperforming_signals_json`
- `likely_causes_json`
- `next_actions_json`
- `sync_status`
- `created_at`
- `updated_at`

The repository state adds:

```ts
reviewReports: ReviewReport[];
```

## Generation Rules

V0 review generation is deterministic and conservative.

Inputs:

- `PublishRecord`
- linked `ContentProject`
- linked `PlatformPackage` when available
- latest `MetricSnapshot` for the publish record when available
- timestamp
- next version number

IDs are versioned:

```text
review-report_<publish-record-id>-v<version>
```

Each generation creates a new version. Reports are not replaced. This matches the product direction that review reports are versioned, while still keeping the v0 workflow simple.

When metrics exist, the generator uses simple ratios:

- like rate: `likes / views`
- favorite rate: `favorites / views`
- comment rate: `comments / views`
- share rate: `shares / views`

The report should identify visible strengths, weak engagement signals, likely causes tied to title/package/timing fit, and practical next actions. If `views` is `0`, rates are treated as `0` and the report calls out insufficient reach.

When no metric snapshot exists, the generator still creates an initial report with:

- a summary that says imported metrics are not available yet;
- no performance claims;
- next actions focused on importing metrics and checking publish metadata.

## Persistence

Repository behavior:

- find the publish record by `publishRecordId`;
- if missing, return current state unchanged;
- find the project and package linked to the record;
- find the latest metric snapshot by `snapshotAt`, then `updatedAt`;
- compute `version` as max existing report version for the publish record plus one;
- insert one new review report;
- update the related project status to `reviewed`;
- return full content-loop state with `selectedProjectId` set to the record's project.

Review reports load newest first by `updatedAt`, then `version DESC`, then `id ASC`.

## UI

Creation Studio adds a review section when a selected publish record exists:

- `Generate review report` button;
- disabled/loading state while generation runs;
- inline error message when generation fails;
- latest review report for the selected publish record.

The report display is compact and text-first:

- version and timestamp;
- summary;
- highlights;
- underperforming signals;
- likely causes;
- next actions.

No charting is included in v0.

## Error Handling

Repository-level missing publish record:

- return the current state unchanged.

IPC-level invalid publish record ID:

- reject with:

```text
Invalid publish record id.
```

Renderer-level failure:

- show:

```text
Could not generate review report. Try again.
```

Existing draft, package, publish record, metrics, archive, and knowledge content must remain visible when review generation fails.

## Testing

Core tests:

- report generation is deterministic for a publish record, metrics snapshot, and version.
- metrics-backed reports include highlights, weak signals, likely causes, and next actions.
- no-metrics reports avoid performance claims and ask for metric import.
- zero-view metrics do not divide by zero.

Local-store tests:

- in-memory repository creates a review report and marks the project as `reviewed`.
- repeated generation creates increasing report versions.
- SQLite repository persists review reports across repository instances.
- missing publish record does not insert reports.

Desktop tests:

- preload/loader calls `generateReviewReport(publishRecordId)`.
- IPC rejects empty publish record IDs.
- Creation Studio generates and displays the latest review report.
- generation failure shows an inline error and keeps current content visible.

## Success Criteria

This slice is complete when:

1. A selected publish record can generate a deterministic review report.
2. Review reports are stored as separate versioned entities.
3. Reports survive SQLite reload.
4. The related project becomes `reviewed` after report generation.
5. Creation Studio shows the latest report for the selected publish record.
6. Existing topic, creation, publish, manual publish, metrics import, archive, and knowledge flows still work.
7. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
