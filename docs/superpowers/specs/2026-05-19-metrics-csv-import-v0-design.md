# Metrics CSV Import V0 Design

Date: 2026-05-19

## Purpose

Add the first post-publish data import slice. After a Xiaohongshu package has been manually published and recorded as a `PublishRecord`, the user should be able to import a local CSV export and save matched rows as metric snapshots.

This slice intentionally supports CSV files only. It does not parse Excel `.xlsx`, screenshots, OCR, pasted tables, or platform login data.

## Scope

Included:

- Open a local `.csv` file through the Electron main process.
- Parse CSV rows into a preview model.
- Match valid rows to existing `PublishRecord` entities.
- Save matched rows as `MetricSnapshot` entities.
- Persist metric snapshots in SQLite.
- Show import preview and latest saved metrics in the desktop UI.

Deferred:

- Excel `.xlsx` parsing.
- OCR, screenshot, and pasted table parsing.
- Automatic platform data fetching.
- User-defined column mapping UI.
- Multi-account analytics dashboards.
- AI-generated review reports.

## User Flow

1. User creates or selects a project with a Xiaohongshu package.
2. User records a manual publish record with publish time and URL.
3. User clicks `Import metrics CSV`.
4. The desktop app opens a local file picker for `.csv` files.
5. The main process reads and parses the CSV file.
6. The renderer shows a preview with matched rows and invalid rows.
7. User clicks `Save imported metrics`.
8. Matched rows are saved as metric snapshots.
9. The UI shows the latest metrics for the selected publish record.

## CSV Format

V0 supports a fixed header set:

```csv
url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note
```

Rules:

- `url` is optional but recommended.
- `publishedAt` is optional when `url` matches a publish record.
- `platform` defaults to `xiaohongshu` when omitted.
- `views`, `likes`, `favorites`, `comments`, and `shares` default to `0` when omitted.
- Metric fields must be non-negative integers when provided.
- `snapshotAt` defaults to import time when omitted.
- `note` defaults to an empty string.

The parser should trim whitespace around header names and cell values.

## Matching Rules

Each parsed row attempts to match one existing publish record.

Priority:

1. Match by exact non-empty `url` against `PublishRecord.url`.
2. If URL does not match, match by `platform + publishedAt`.

Rows that cannot match a publish record stay in preview as invalid rows and are not saved.

Rows with invalid metric values stay in preview as invalid rows and are not saved.

## Data Model

Add `MetricSnapshot`:

```ts
interface MetricSnapshot {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  publishRecordId: EntityId;
  platform: Platform;
  sourceFileName: string;
  snapshotAt: string;
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}
```

Add preview models:

```ts
interface MetricImportPreview {
  id: EntityId;
  sourceFileName: string;
  rows: MetricImportPreviewRow[];
  createdAt: string;
}

interface MetricImportPreviewRow {
  rowNumber: number;
  status: "matched" | "invalid";
  publishRecordId?: EntityId;
  url: string;
  platform: Platform;
  publishedAt: string;
  snapshotAt: string;
  metrics: MetricValues;
  note: string;
  error?: string;
}

interface MetricValues {
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
}
```

Repository state adds:

```ts
metricSnapshots: MetricSnapshot[];
metricImportPreview: MetricImportPreview | null;
```

## Persistence

SQLite adds `metric_snapshots`:

- `id`
- `remote_id`
- `workspace_id`
- `content_project_id`
- `publish_record_id`
- `platform`
- `source_file_name`
- `snapshot_at`
- `views`
- `likes`
- `favorites`
- `comments`
- `shares`
- `note`
- `sync_status`
- `created_at`
- `updated_at`

Metric snapshots load newest first by `snapshot_at DESC`, then `updated_at DESC`, then `id ASC`.

## Repository API

Add two workflows:

```ts
previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState>;
saveMetricImport(): Promise<PersistedContentLoopState>;
```

Input:

```ts
interface MetricCsvImportInput {
  sourceFileName: string;
  csvText: string;
}
```

Preview behavior:

- parse CSV text;
- create matched and invalid preview rows;
- store preview in repository state;
- do not write metric snapshots yet;
- return refreshed state.

Save behavior:

- if no preview exists, return current state unchanged;
- convert matched preview rows into metric snapshots;
- skip invalid preview rows;
- upsert snapshots by deterministic row identity;
- clear preview after save;
- return refreshed state.

Deterministic snapshot ID:

```text
metric-snapshot_<publish-record-id>_<snapshotAt>
```

## Electron Boundary

Renderer must not access local files directly.

Main process responsibilities:

- show `.csv` file picker;
- read selected file as UTF-8 text;
- pass `{ sourceFileName, csvText }` to the repository preview workflow;
- expose save workflow through IPC.

Preload exposes:

```ts
importMetricCsv(): Promise<PersistedContentLoopState>;
saveMetricImport(): Promise<PersistedContentLoopState>;
```

If the user cancels file selection, return current content loop state unchanged.

Invalid file extension or read failure should reject with:

```text
Could not import metrics CSV.
```

## UI

Creation Studio adds a metrics import section when a selected publish record exists:

- `Import metrics CSV` button;
- preview summary showing matched and invalid row counts;
- compact preview list for invalid rows with row number and error;
- `Save imported metrics` button when at least one matched row exists;
- inline error state.

The selected publish record summary shows latest saved metrics when available:

- views;
- likes;
- favorites;
- comments;
- shares;
- snapshot time.

No AI analysis or optimization recommendation is shown in this slice.

## Error Handling

Parser errors:

- malformed CSV header or empty file creates an invalid preview with a readable error;
- invalid metric values mark only that row invalid.

Matching errors:

- unmatched rows remain invalid in preview and are skipped on save.

IPC errors:

- file read or unsupported extension rejects with `Could not import metrics CSV.`

Renderer errors:

- import failure shows `Could not import metrics CSV. Try again.`
- save failure shows `Could not save imported metrics. Try again.`

Existing topic, draft, publish package, manual publish record, archive, and knowledge content must remain visible when import or save fails.

## Testing

Core tests:

- parse CSV rows with valid metrics.
- default missing numeric metrics to `0`.
- reject negative or non-integer metric values.
- match by URL before `platform + publishedAt`.
- produce invalid preview rows for unmatched rows.

Local-store tests:

- in-memory preview stores matched and invalid rows without saving snapshots.
- save converts matched rows into metric snapshots and clears preview.
- SQLite persists metric snapshots across repository instances.
- no preview save is a no-op.

Desktop tests:

- main IPC imports a CSV file through dialog and repository preview.
- file selection cancel returns current state unchanged.
- preload and loader expose import and save workflows.
- Creation Studio previews matched and invalid rows.
- save shows latest metrics for the selected publish record.
- import and save failures show inline errors while keeping current content visible.

## Success Criteria

This slice is complete when:

1. A local CSV file can be selected from the desktop app.
2. CSV rows are parsed and previewed before saving.
3. Valid rows match existing publish records.
4. Invalid rows are visible and skipped.
5. Matched rows save as `MetricSnapshot` entities.
6. Metric snapshots survive SQLite reload.
7. The selected publish record shows latest saved metrics.
8. Existing content-loop flows still pass.
9. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
