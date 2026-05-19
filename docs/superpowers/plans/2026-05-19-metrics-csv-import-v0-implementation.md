# Metrics CSV Import V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local CSV metric import so a selected CSV file can be parsed, previewed, matched to `PublishRecord`, and saved as `MetricSnapshot` data.

**Architecture:** Keep CSV parsing and row matching in `@robert-station/core`, persist previews and snapshots through `@robert-station/local-store`, and keep local file access in Electron main process. Renderer UI calls preload APIs only, shows preview rows, and displays the latest saved metrics for the selected publish record.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:fs/promises`, Node `node:path`, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- CSV-only local file import through Electron dialog.
- Fixed CSV headers: `url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note`.
- Core parser and matcher for metric import preview rows.
- `MetricSnapshot` persistence in memory and SQLite.
- Renderer preview and save UI in Creation Studio.

Deferred:

- Excel `.xlsx` support.
- OCR, screenshots, pasted table parsing, and custom column mapping.
- Automatic platform login or data fetching.
- AI review reports and analytics dashboards.

## Target File Structure

```text
packages/
  core/
    src/
      metrics-import.test.ts
      metrics-import.ts
      index.ts
      types.ts
  local-store/
    src/
      content-loop-repository.test.ts
      content-loop-repository.ts
      schema.test.ts
      schema.ts
      sqlite-content-loop-repository.test.ts
      sqlite-content-loop-repository.ts
apps/
  desktop/
    src/
      main/
        content-loop-service.ts
        ipc-channels.ts
      preload/
        preload.ts
      renderer/
        App.test.tsx
        App.tsx
        content-loop-loader.test.ts
        content-loop-loader.ts
        content-loop-service.test.ts
        global.d.ts
        test-setup.ts
        styles.css
```

## Task 1: Core Metrics CSV Parser And Matcher

**Files:**

- Create: `packages/core/src/metrics-import.test.ts`
- Create: `packages/core/src/metrics-import.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing core tests**

Create `packages/core/src/metrics-import.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMetricImportPreview, createMetricSnapshotsFromPreview } from "./metrics-import";
import type { MetricCsvImportInput, PublishRecord } from "./types";

const publishRecord: PublishRecord = {
  id: "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: "project_topic-ai-local-workstation",
  platformPackageId: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  platform: "xiaohongshu",
  status: "published",
  publishedAt: "2026-05-19T12:00:00.000Z",
  url: "https://www.xiaohongshu.com/explore/demo",
  note: "",
  createdAt: "2026-05-19T12:01:00.000Z",
  updatedAt: "2026-05-19T12:01:00.000Z"
};

const input: MetricCsvImportInput = {
  sourceFileName: "xiaohongshu-metrics.csv",
  csvText:
    "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
    "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,1000,88,34,12,9,2026-05-20T08:00:00.000Z,first import"
};

describe("createMetricImportPreview", () => {
  it("parses valid metric CSV rows and matches publish records by URL", () => {
    const preview = createMetricImportPreview({
      input,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.sourceFileName).toBe("xiaohongshu-metrics.csv");
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      status: "matched",
      publishRecordId: publishRecord.id,
      url: publishRecord.url,
      platform: "xiaohongshu",
      publishedAt: "",
      snapshotAt: "2026-05-20T08:00:00.000Z",
      metrics: {
        views: 1000,
        likes: 88,
        favorites: 34,
        comments: 12,
        shares: 9
      },
      note: "first import"
    });
  });

  it("defaults omitted numeric metrics to zero and matches by platform plus publishedAt", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "minimal.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          ",2026-05-19T12:00:00.000Z,xiaohongshu,,,,,,,"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]).toMatchObject({
      status: "matched",
      publishRecordId: publishRecord.id,
      snapshotAt: "2026-05-20T09:00:00.000Z",
      metrics: {
        views: 0,
        likes: 0,
        favorites: 0,
        comments: 0,
        shares: 0
      }
    });
  });

  it("marks rows with invalid metrics as invalid", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "invalid.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,-1,8,3,1,0,,bad row"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]?.status).toBe("invalid");
    expect(preview.rows[0]?.error).toBe("views must be a non-negative integer.");
  });

  it("marks unmatched rows as invalid", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "unmatched.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "https://www.xiaohongshu.com/explore/missing,,xiaohongshu,1,1,1,1,1,,missing"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]?.status).toBe("invalid");
    expect(preview.rows[0]?.error).toBe("No matching publish record.");
  });

  it("creates deterministic metric snapshots from matched preview rows", () => {
    const preview = createMetricImportPreview({
      input,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });
    const snapshots = createMetricSnapshotsFromPreview({
      preview,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:30:00.000Z")
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      id: "metric-snapshot_publish-record-platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu-2026-05-20t08-00-00-000z",
      workspaceId: publishRecord.workspaceId,
      contentProjectId: publishRecord.contentProjectId,
      publishRecordId: publishRecord.id,
      platform: "xiaohongshu",
      sourceFileName: "xiaohongshu-metrics.csv",
      snapshotAt: "2026-05-20T08:00:00.000Z",
      views: 1000,
      likes: 88,
      favorites: 34,
      comments: 12,
      shares: 9,
      note: "first import",
      createdAt: "2026-05-20T09:30:00.000Z",
      updatedAt: "2026-05-20T09:30:00.000Z"
    });
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./metrics-import` and metric types do not exist.

- [ ] **Step 3: Add metric types**

Modify `packages/core/src/types.ts` after `ManualPublishInput`:

```ts
export interface MetricValues {
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
}

export interface MetricSnapshot extends MetricValues {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  publishRecordId: EntityId;
  platform: Platform;
  sourceFileName: string;
  snapshotAt: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricCsvImportInput {
  sourceFileName: string;
  csvText: string;
}

export interface MetricImportPreview {
  id: EntityId;
  sourceFileName: string;
  rows: MetricImportPreviewRow[];
  createdAt: string;
}

export interface MetricImportPreviewRow {
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
```

- [ ] **Step 4: Implement parser, matcher, and snapshot creation**

Create `packages/core/src/metrics-import.ts`:

```ts
import { createEntityId } from "./ids";
import type {
  MetricCsvImportInput,
  MetricImportPreview,
  MetricImportPreviewRow,
  MetricSnapshot,
  MetricValues,
  Platform,
  PublishRecord
} from "./types";

interface CreateMetricImportPreviewRequest {
  input: MetricCsvImportInput;
  publishRecords: PublishRecord[];
  now?: Date;
}

interface CreateMetricSnapshotsFromPreviewRequest {
  preview: MetricImportPreview;
  publishRecords: PublishRecord[];
  now?: Date;
}

const HEADER_NAMES = [
  "url",
  "publishedAt",
  "platform",
  "views",
  "likes",
  "favorites",
  "comments",
  "shares",
  "snapshotAt",
  "note"
] as const;
const METRIC_FIELDS = ["views", "likes", "favorites", "comments", "shares"] as const;
const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

type HeaderName = (typeof HEADER_NAMES)[number];
type MetricField = (typeof METRIC_FIELDS)[number];
type CsvRow = Record<HeaderName, string>;

export function createMetricImportPreview(request: CreateMetricImportPreviewRequest): MetricImportPreview {
  const now = request.now ?? DEFAULT_NOW;
  const createdAt = now.toISOString();
  const parseResult = parseMetricCsv(request.input.csvText);

  if (!parseResult.ok) {
    return {
      id: createEntityId("metric-import-preview", `${request.input.sourceFileName}-${createdAt}`),
      sourceFileName: request.input.sourceFileName,
      createdAt,
      rows: [
        {
          rowNumber: 1,
          status: "invalid",
          url: "",
          platform: "xiaohongshu",
          publishedAt: "",
          snapshotAt: createdAt,
          metrics: createEmptyMetrics(),
          note: "",
          error: parseResult.error
        }
      ]
    };
  }

  return {
    id: createEntityId("metric-import-preview", `${request.input.sourceFileName}-${createdAt}`),
    sourceFileName: request.input.sourceFileName,
    createdAt,
    rows: parseResult.rows.map((row, index) =>
      createPreviewRow({
        row,
        rowNumber: index + 2,
        publishRecords: request.publishRecords,
        defaultSnapshotAt: createdAt
      })
    )
  };
}

export function createMetricSnapshotsFromPreview(request: CreateMetricSnapshotsFromPreviewRequest): MetricSnapshot[] {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();

  return request.preview.rows
    .filter((row): row is MetricImportPreviewRow & { publishRecordId: string; status: "matched" } => row.status === "matched")
    .map((row) => {
      const publishRecord = request.publishRecords.find((candidate) => candidate.id === row.publishRecordId);

      if (!publishRecord) {
        return null;
      }

      return {
        id: createEntityId("metric-snapshot", `${publishRecord.id}-${row.snapshotAt}`),
        workspaceId: publishRecord.workspaceId,
        contentProjectId: publishRecord.contentProjectId,
        publishRecordId: publishRecord.id,
        platform: publishRecord.platform,
        sourceFileName: request.preview.sourceFileName,
        snapshotAt: row.snapshotAt,
        views: row.metrics.views,
        likes: row.metrics.likes,
        favorites: row.metrics.favorites,
        comments: row.metrics.comments,
        shares: row.metrics.shares,
        note: row.note,
        createdAt: timestamp,
        updatedAt: timestamp
      } satisfies MetricSnapshot;
    })
    .filter((snapshot): snapshot is MetricSnapshot => snapshot !== null);
}

function createPreviewRow(request: {
  row: CsvRow;
  rowNumber: number;
  publishRecords: PublishRecord[];
  defaultSnapshotAt: string;
}): MetricImportPreviewRow {
  const platform = toPlatform(request.row.platform);
  const metricsResult = parseMetrics(request.row);
  const snapshotAt = request.row.snapshotAt || request.defaultSnapshotAt;
  const baseRow = {
    rowNumber: request.rowNumber,
    url: request.row.url,
    platform,
    publishedAt: request.row.publishedAt,
    snapshotAt,
    metrics: metricsResult.metrics,
    note: request.row.note
  };

  if (metricsResult.error) {
    return { ...baseRow, status: "invalid", error: metricsResult.error };
  }

  const publishRecord = matchPublishRecord({
    row: request.row,
    platform,
    publishRecords: request.publishRecords
  });

  if (!publishRecord) {
    return { ...baseRow, status: "invalid", error: "No matching publish record." };
  }

  return { ...baseRow, status: "matched", publishRecordId: publishRecord.id };
}

function parseMetricCsv(csvText: string): { ok: true; rows: CsvRow[] } | { ok: false; error: string } {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { ok: false, error: "CSV file is empty." };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const missingHeader = HEADER_NAMES.find((headerName) => !headers.includes(headerName));

  if (missingHeader) {
    return { ok: false, error: `Missing CSV header: ${missingHeader}.` };
  }

  return {
    ok: true,
    rows: lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);
      return HEADER_NAMES.reduce<CsvRow>((row, headerName) => {
        const index = headers.indexOf(headerName);
        row[headerName] = (cells[index] ?? "").trim();
        return row;
      }, createEmptyRow());
    })
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
}

function matchPublishRecord(request: {
  row: CsvRow;
  platform: Platform;
  publishRecords: PublishRecord[];
}): PublishRecord | null {
  if (request.row.url.length > 0) {
    const urlMatch = request.publishRecords.find((publishRecord) => publishRecord.url === request.row.url);

    if (urlMatch) {
      return urlMatch;
    }
  }

  if (request.row.publishedAt.length === 0) {
    return null;
  }

  return (
    request.publishRecords.find(
      (publishRecord) => publishRecord.platform === request.platform && publishRecord.publishedAt === request.row.publishedAt
    ) ?? null
  );
}

function parseMetrics(row: CsvRow): { metrics: MetricValues; error: string | null } {
  const metrics = createEmptyMetrics();

  for (const field of METRIC_FIELDS) {
    const parsed = parseMetricValue(row[field], field);

    if (!parsed.ok) {
      return { metrics, error: parsed.error };
    }

    metrics[field] = parsed.value;
  }

  return { metrics, error: null };
}

function parseMetricValue(value: string, field: MetricField): { ok: true; value: number } | { ok: false; error: string } {
  if (value.length === 0) {
    return { ok: true, value: 0 };
  }

  if (!/^\d+$/.test(value)) {
    return { ok: false, error: `${field} must be a non-negative integer.` };
  }

  return { ok: true, value: Number(value) };
}

function toPlatform(value: string): Platform {
  return value === "douyin" || value === "wechat_channels" || value === "bilibili" ? value : "xiaohongshu";
}

function createEmptyMetrics(): MetricValues {
  return { views: 0, likes: 0, favorites: 0, comments: 0, shares: 0 };
}

function createEmptyRow(): CsvRow {
  return {
    url: "",
    publishedAt: "",
    platform: "",
    views: "",
    likes: "",
    favorites: "",
    comments: "",
    shares: "",
    snapshotAt: "",
    note: ""
  };
}
```

- [ ] **Step 5: Export metrics import API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./archive-assistant";
export * from "./columns";
export * from "./content-loop";
export * from "./creation-assistant";
export * from "./ids";
export * from "./manual-publish";
export * from "./metrics-import";
export * from "./publish-assistant";
export * from "./topic-assistant";
export * from "./types";
```

- [ ] **Step 6: Run core verification**

Run:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/core run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/core/src/metrics-import.test.ts packages/core/src/metrics-import.ts packages/core/src/types.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add metrics csv parser"
```

## Task 2: Local-Store And SQLite Metric Snapshot Persistence

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/schema.test.ts`
- Modify: `packages/local-store/src/schema.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`

- [ ] **Step 1: Write failing local-store tests**

In `packages/local-store/src/content-loop-repository.test.ts`, add seeded assertions:

```ts
expect(state.metricSnapshots).toHaveLength(0);
expect(state.metricImportPreview).toBeNull();
```

Add tests:

```ts
it("previews metric CSV rows in memory without saving snapshots", async () => {
  const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
  const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
  const projectId = afterPromote.selectedProjectId;

  if (!projectId) {
    throw new Error("Expected promoted project to be selected.");
  }

  await repository.generateDraftPackage(projectId);
  const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
  const packageId = afterPackage.platformPackages[0]?.id;

  if (!packageId) {
    throw new Error("Expected a generated platform package.");
  }

  const afterPublish = await repository.recordManualPublish({
    platformPackageId: packageId,
    publishedAt: "2026-05-19T12:00:00.000Z",
    url: "https://www.xiaohongshu.com/explore/demo"
  });
  const afterPreview = await repository.previewMetricCsvImport({
    sourceFileName: "metrics.csv",
    csvText:
      "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
      "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good\n" +
      "https://www.xiaohongshu.com/explore/missing,,xiaohongshu,1,1,1,1,1,2026-05-20T09:00:00.000Z,bad"
  });

  expect(afterPublish.metricSnapshots).toHaveLength(0);
  expect(afterPreview.metricSnapshots).toHaveLength(0);
  expect(afterPreview.metricImportPreview?.rows).toHaveLength(2);
  expect(afterPreview.metricImportPreview?.rows.filter((row) => row.status === "matched")).toHaveLength(1);
  expect(afterPreview.metricImportPreview?.rows.filter((row) => row.status === "invalid")).toHaveLength(1);
});

it("saves matched metric preview rows in memory and clears the preview", async () => {
  const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
  const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
  const projectId = afterPromote.selectedProjectId;

  if (!projectId) {
    throw new Error("Expected promoted project to be selected.");
  }

  await repository.generateDraftPackage(projectId);
  const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
  const packageId = afterPackage.platformPackages[0]?.id;

  if (!packageId) {
    throw new Error("Expected a generated platform package.");
  }

  await repository.recordManualPublish({
    platformPackageId: packageId,
    publishedAt: "2026-05-19T12:00:00.000Z",
    url: "https://www.xiaohongshu.com/explore/demo"
  });
  await repository.previewMetricCsvImport({
    sourceFileName: "metrics.csv",
    csvText:
      "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
      "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good"
  });
  const afterSave = await repository.saveMetricImport();

  expect(afterSave.metricSnapshots).toHaveLength(1);
  expect(afterSave.metricSnapshots[0]).toMatchObject({
    views: 100,
    likes: 10,
    favorites: 8,
    comments: 3,
    shares: 2,
    note: "good"
  });
  expect(afterSave.metricImportPreview).toBeNull();
});
```

In `packages/local-store/src/sqlite-content-loop-repository.test.ts`, add seeded assertions and:

```ts
it("persists metric snapshots across repository instances", async () => {
  const firstRepository = SqliteContentLoopRepository.open({ databasePath });
  const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
  const projectId = afterPromote.selectedProjectId;

  if (!projectId) {
    throw new Error("Expected promoted project to be selected.");
  }

  await firstRepository.generateDraftPackage(projectId);
  const afterPackage = await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
  const packageId = afterPackage.platformPackages[0]?.id;

  if (!packageId) {
    throw new Error("Expected a generated platform package.");
  }

  await firstRepository.recordManualPublish({
    platformPackageId: packageId,
    publishedAt: "2026-05-19T12:00:00.000Z",
    url: "https://www.xiaohongshu.com/explore/demo"
  });
  await firstRepository.previewMetricCsvImport({
    sourceFileName: "metrics.csv",
    csvText:
      "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
      "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good"
  });
  const afterSave = await firstRepository.saveMetricImport();
  firstRepository.close();

  const secondRepository = SqliteContentLoopRepository.open({ databasePath });
  const afterReload = await secondRepository.loadContentLoop();
  secondRepository.close();

  expect(afterSave.metricSnapshots).toHaveLength(1);
  expect(afterReload).toEqual(afterSave);
});

it("does not change SQLite state when saving without a metric preview", async () => {
  const repository = SqliteContentLoopRepository.open({ databasePath });
  const before = await repository.loadContentLoop();
  const afterSave = await repository.saveMetricImport();
  repository.close();

  expect(afterSave).toEqual(before);
});
```

Add `metric_snapshots` to schema table expectations.

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because metric snapshot state, repository methods, and table do not exist.

- [ ] **Step 3: Extend repository state and in-memory workflows**

Modify imports in `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createManualPublishRecord,
  createMetricImportPreview,
  createMetricSnapshotsFromPreview,
  createSampleContentLoopSeed,
  generateMockArchivePackage,
  generateMockDraftPackage,
  generateMockTopics,
  generateMockXiaohongshuPackage
} from "@robert-station/core";
import type {
  ArchiveRecord,
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  KnowledgeItem,
  ManualPublishInput,
  MetricCsvImportInput,
  MetricImportPreview,
  MetricSnapshot,
  Platform,
  PlatformPackage,
  PublishRecord,
  SourceReference,
  Topic
} from "@robert-station/core";
```

Add to `PersistedContentLoopState`:

```ts
metricSnapshots: MetricSnapshot[];
metricImportPreview: MetricImportPreview | null;
```

Add to `ContentLoopRepository`:

```ts
previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState>;
saveMetricImport(): Promise<PersistedContentLoopState>;
```

Seed:

```ts
metricSnapshots: [],
metricImportPreview: null,
```

Add methods to `InMemoryContentLoopRepository`:

```ts
async previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState> {
  this.state = {
    ...this.state,
    metricImportPreview: createMetricImportPreview({
      input,
      publishRecords: this.state.publishRecords,
      now: new Date()
    })
  };

  return cloneState(this.state);
}

async saveMetricImport(): Promise<PersistedContentLoopState> {
  if (!this.state.metricImportPreview) {
    return cloneState(this.state);
  }

  const snapshots = createMetricSnapshotsFromPreview({
    preview: this.state.metricImportPreview,
    publishRecords: this.state.publishRecords,
    now: new Date()
  });
  const snapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));

  this.state = {
    ...this.state,
    metricSnapshots: [...snapshots, ...this.state.metricSnapshots.filter((snapshot) => !snapshotIds.has(snapshot.id))].sort(
      compareMetricSnapshots
    ),
    metricImportPreview: null
  };

  return cloneState(this.state);
}
```

Add comparator:

```ts
function compareMetricSnapshots(left: MetricSnapshot, right: MetricSnapshot): number {
  return (
    right.snapshotAt.localeCompare(left.snapshotAt) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}
```

- [ ] **Step 4: Add SQLite table, rows, mappers, and state loading**

Add `metric_snapshots` to `packages/local-store/src/schema.ts` after `publish_records`:

```sql
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  publish_record_id TEXT NOT NULL REFERENCES publish_records(id),
  platform TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  snapshot_at TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  favorites INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

In `sqlite-content-loop-repository.ts`:

- import `createMetricImportPreview` and `createMetricSnapshotsFromPreview`;
- add type imports for `MetricCsvImportInput`, `MetricImportPreview`, and `MetricSnapshot`;
- add `MetricSnapshotRow`;
- load snapshots:

```ts
const metricSnapshots = this.database
  .prepare("SELECT * FROM metric_snapshots ORDER BY snapshot_at DESC, updated_at DESC, id ASC;")
  .all() as unknown as MetricSnapshotRow[];
```

- return:

```ts
metricSnapshots: metricSnapshots.map(mapMetricSnapshotRow),
metricImportPreview: this.metricImportPreview ? cloneMetricImportPreview(this.metricImportPreview) : null,
```

Add private field:

```ts
private metricImportPreview: MetricImportPreview | null = null;
```

Add mapper:

```ts
function mapMetricSnapshotRow(row: MetricSnapshotRow): MetricSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    publishRecordId: row.publish_record_id,
    platform: row.platform as Platform,
    sourceFileName: row.source_file_name,
    snapshotAt: row.snapshot_at,
    views: row.views,
    likes: row.likes,
    favorites: row.favorites,
    comments: row.comments,
    shares: row.shares,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

Add clone helper:

```ts
function cloneMetricImportPreview(preview: MetricImportPreview): MetricImportPreview {
  return {
    ...preview,
    rows: preview.rows.map((row) => ({ ...row, metrics: { ...row.metrics } }))
  };
}
```

- [ ] **Step 5: Implement SQLite preview and save workflows**

Add methods:

```ts
async previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState> {
  const publishRecords = this.database
    .prepare("SELECT * FROM publish_records ORDER BY published_at DESC, updated_at DESC, id ASC;")
    .all() as unknown as PublishRecordRow[];

  this.metricImportPreview = createMetricImportPreview({
    input,
    publishRecords: publishRecords.map(mapPublishRecordRow),
    now: this.createPromotionDate()
  });

  return this.loadState();
}

async saveMetricImport(): Promise<PersistedContentLoopState> {
  if (!this.metricImportPreview) {
    return this.loadState();
  }

  const publishRecords = this.database
    .prepare("SELECT * FROM publish_records ORDER BY published_at DESC, updated_at DESC, id ASC;")
    .all() as unknown as PublishRecordRow[];
  const snapshots = createMetricSnapshotsFromPreview({
    preview: this.metricImportPreview,
    publishRecords: publishRecords.map(mapPublishRecordRow),
    now: this.createPromotionDate()
  });

  this.runTransaction(() => {
    for (const snapshot of snapshots) {
      this.upsertMetricSnapshot(snapshot);
    }
  });
  this.metricImportPreview = null;

  return this.loadState();
}
```

Add upsert:

```ts
private upsertMetricSnapshot(snapshot: MetricSnapshot): void {
  this.database
    .prepare(
      `INSERT INTO metric_snapshots (
        id, workspace_id, content_project_id, publish_record_id, platform, source_file_name,
        snapshot_at, views, likes, favorites, comments, shares, note, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        content_project_id = excluded.content_project_id,
        publish_record_id = excluded.publish_record_id,
        platform = excluded.platform,
        source_file_name = excluded.source_file_name,
        snapshot_at = excluded.snapshot_at,
        views = excluded.views,
        likes = excluded.likes,
        favorites = excluded.favorites,
        comments = excluded.comments,
        shares = excluded.shares,
        note = excluded.note,
        updated_at = excluded.updated_at;`
    )
    .run(
      snapshot.id,
      snapshot.workspaceId,
      snapshot.contentProjectId,
      snapshot.publishRecordId,
      snapshot.platform,
      snapshot.sourceFileName,
      snapshot.snapshotAt,
      snapshot.views,
      snapshot.likes,
      snapshot.favorites,
      snapshot.comments,
      snapshot.shares,
      snapshot.note,
      snapshot.createdAt,
      snapshot.updatedAt
    );
}
```

Include `SELECT updated_at FROM metric_snapshots` in `createPromotionDate()`.

- [ ] **Step 6: Run local-store verification**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/schema.ts packages/local-store/src/schema.test.ts packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist metric snapshots"
```

## Task 3: Electron CSV File Import IPC And Preload API

**Files:**

- Modify: `apps/desktop/src/main/ipc-channels.ts`
- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Modify: `apps/desktop/src/renderer/content-loop-service.test.ts`
- Modify: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Write failing desktop API tests**

In `content-loop-loader.test.ts`, import `importPersistedMetricCsv` and `savePersistedMetricImport`, then add:

```ts
it("imports metric CSV through preload API", async () => {
  await importPersistedMetricCsv();

  expect(window.robertStation.contentLoop.importMetricCsv).toHaveBeenCalled();
});

it("saves metric import through preload API", async () => {
  await savePersistedMetricImport();

  expect(window.robertStation.contentLoop.saveMetricImport).toHaveBeenCalled();
});
```

In `content-loop-service.test.ts`, mock `dialog` and `readFile`:

```ts
vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: vi.fn()
  },
  ipcMain: {
    handle: vi.fn()
  }
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn()
}));
```

Add tests:

```ts
it("imports a selected metrics CSV file before calling the repository", async () => {
  const repository = createRepository();
  registerContentLoopIpc(repository);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({
    canceled: false,
    filePaths: ["/tmp/metrics.csv"]
  });
  vi.mocked(readFile).mockResolvedValue("url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n");

  const handler = getImportMetricCsvHandler();
  await handler({} as IpcMainInvokeEvent);

  expect(repository.previewMetricCsvImport).toHaveBeenCalledWith({
    sourceFileName: "metrics.csv",
    csvText: "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n"
  });
});

it("returns current state when metrics CSV file selection is canceled", async () => {
  const repository = createRepository();
  registerContentLoopIpc(repository);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });

  const handler = getImportMetricCsvHandler();
  const state = await handler({} as IpcMainInvokeEvent);

  expect(state).toEqual(emptyState);
  expect(repository.previewMetricCsvImport).not.toHaveBeenCalled();
});
```

Update `emptyState` with `metricSnapshots: []` and `metricImportPreview: null`, and repository mock with `previewMetricCsvImport` and `saveMetricImport`.

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because import/save IPC and preload APIs do not exist.

- [ ] **Step 3: Add IPC channels and main process file import**

Modify `ipc-channels.ts`:

```ts
export const CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL = "content-loop:import-metric-csv";
export const CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL = "content-loop:save-metric-import";
```

Modify `content-loop-service.ts` imports:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
```

Add handlers:

```ts
ipcMain.handle(CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL, async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: "CSV files", extensions: ["csv"] }],
    properties: ["openFile"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return repository.loadContentLoop();
  }

  const filePath = result.filePaths[0];

  if (!filePath.toLowerCase().endsWith(".csv")) {
    throw new Error("Could not import metrics CSV.");
  }

  try {
    const csvText = await readFile(filePath, "utf8");
    return repository.previewMetricCsvImport({
      sourceFileName: path.basename(filePath),
      csvText
    });
  } catch {
    throw new Error("Could not import metrics CSV.");
  }
});

ipcMain.handle(CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL, async () => repository.saveMetricImport());
```

- [ ] **Step 4: Add preload, globals, loader, and test setup**

Expose in `preload.ts`:

```ts
importMetricCsv: () =>
  ipcRenderer.invoke(CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL) as Promise<PersistedContentLoopState>,
saveMetricImport: () =>
  ipcRenderer.invoke(CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL) as Promise<PersistedContentLoopState>,
```

Add global type:

```ts
importMetricCsv: () => Promise<PersistedContentLoopState>;
saveMetricImport: () => Promise<PersistedContentLoopState>;
```

Add loader:

```ts
export async function importPersistedMetricCsv(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.importMetricCsv();
}

export async function savePersistedMetricImport(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.saveMetricImport();
}
```

Add test setup mock:

```ts
importMetricCsv: vi.fn(async () =>
  repository.previewMetricCsvImport({
    sourceFileName: "metrics.csv",
    csvText:
      "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
      "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good"
  })
),
saveMetricImport: vi.fn(async () => repository.saveMetricImport()),
```

- [ ] **Step 5: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
npm run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/src/main/ipc-channels.ts apps/desktop/src/main/content-loop-service.ts apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/content-loop-service.test.ts apps/desktop/src/renderer/test-setup.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose metrics csv import ipc"
```

## Task 4: Creation Studio Metrics Import UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add tests to `apps/desktop/src/renderer/App.test.tsx`:

```ts
it("imports a metrics CSV preview and saves matched metric snapshots", async () => {
  render(<App />);

  await screen.findByRole("heading", { name: "Robert Station" });
  fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
  const topicCard = screen.getByRole("article", {
    name: "How to build a personal AI workstation for daily content work"
  });
  fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

  await screen.findByRole("heading", { name: "Creation Studio" });
  fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
  await screen.findByRole("heading", { name: "Xiaohongshu Package" });
  fireEvent.change(screen.getByLabelText("Publish URL"), {
    target: { value: "https://www.xiaohongshu.com/explore/demo" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

  await screen.findByText("Published");
  fireEvent.click(screen.getByRole("button", { name: "Import metrics CSV" }));

  expect(await screen.findByText("1 matched row")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save imported metrics" }));

  expect(await screen.findByText("Views")).toBeInTheDocument();
  expect(screen.getByText("100")).toBeInTheDocument();
  expect(window.robertStation.contentLoop.importMetricCsv).toHaveBeenCalled();
  expect(window.robertStation.contentLoop.saveMetricImport).toHaveBeenCalled();
});

it("shows import errors while keeping the publish package visible", async () => {
  window.robertStation.contentLoop.importMetricCsv = vi.fn(async () => {
    throw new Error("import failed");
  });

  render(<App />);

  await screen.findByRole("heading", { name: "Robert Station" });
  fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
  const topicCard = screen.getByRole("article", {
    name: "How to build a personal AI workstation for daily content work"
  });
  fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

  await screen.findByRole("heading", { name: "Creation Studio" });
  fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
  await screen.findByRole("heading", { name: "Xiaohongshu Package" });
  fireEvent.change(screen.getByLabelText("Publish URL"), {
    target: { value: "https://www.xiaohongshu.com/explore/demo" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

  await screen.findByText("Published");
  fireEvent.click(screen.getByRole("button", { name: "Import metrics CSV" }));

  expect(await screen.findByText("Could not import metrics CSV. Try again.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Xiaohongshu Package" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- App.test.tsx
```

Expected: FAIL because metrics import UI does not exist.

- [ ] **Step 3: Add UI state and handlers**

Modify imports in `App.tsx` to include:

```ts
import {
  archivePersistedProject,
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedTopics,
  importPersistedMetricCsv,
  loadPersistedContentLoop,
  promotePersistedTopic,
  recordPersistedManualPublish,
  savePersistedMetricImport
} from "./content-loop-loader";
```

Add state:

```ts
const [isImportingMetrics, setIsImportingMetrics] = useState(false);
const [isSavingMetricImport, setIsSavingMetricImport] = useState(false);
const [metricImportError, setMetricImportError] = useState<string | null>(null);
const [metricSaveError, setMetricSaveError] = useState<string | null>(null);
```

Compute latest metrics:

```ts
const selectedMetricSnapshots =
  selectedPublishRecord && contentLoop
    ? contentLoop.metricSnapshots.filter((snapshot) => snapshot.publishRecordId === selectedPublishRecord.id)
    : [];
const selectedLatestMetricSnapshot = selectedMetricSnapshots[0] ?? null;
const matchedMetricImportRows =
  contentLoop.metricImportPreview?.rows.filter((row) => row.status === "matched").length ?? 0;
const invalidMetricImportRows =
  contentLoop.metricImportPreview?.rows.filter((row) => row.status === "invalid").length ?? 0;
```

Add handlers:

```ts
async function handleImportMetricCsv(): Promise<void> {
  if (!isMountedRef.current) {
    return;
  }

  setIsImportingMetrics(true);
  setMetricImportError(null);

  try {
    const nextState = await importPersistedMetricCsv();
    if (isMountedRef.current) {
      setContentLoop(nextState);
    }
  } catch {
    if (isMountedRef.current) {
      setMetricImportError("Could not import metrics CSV. Try again.");
    }
  } finally {
    if (isMountedRef.current) {
      setIsImportingMetrics(false);
    }
  }
}

async function handleSaveMetricImport(): Promise<void> {
  if (!isMountedRef.current) {
    return;
  }

  setIsSavingMetricImport(true);
  setMetricSaveError(null);

  try {
    const nextState = await savePersistedMetricImport();
    if (isMountedRef.current) {
      setContentLoop(nextState);
    }
  } catch {
    if (isMountedRef.current) {
      setMetricSaveError("Could not save imported metrics. Try again.");
    }
  } finally {
    if (isMountedRef.current) {
      setIsSavingMetricImport(false);
    }
  }
}
```

- [ ] **Step 4: Render metrics import panel**

Inside the manual publish panel after `publish-record-summary`, add:

```tsx
{selectedPublishRecord ? (
  <section className="metrics-import-panel" aria-label="Metrics import">
    <h3>Metrics import</h3>
    <button disabled={isImportingMetrics} onClick={() => void handleImportMetricCsv()} type="button">
      {isImportingMetrics ? "Importing..." : "Import metrics CSV"}
    </button>
    {metricImportError ? (
      <p className="inline-error" role="alert">
        {metricImportError}
      </p>
    ) : null}
    {contentLoop.metricImportPreview ? (
      <div className="metric-import-preview">
        <p>
          {matchedMetricImportRows} matched {matchedMetricImportRows === 1 ? "row" : "rows"}
        </p>
        <p>
          {invalidMetricImportRows} invalid {invalidMetricImportRows === 1 ? "row" : "rows"}
        </p>
        {contentLoop.metricImportPreview.rows
          .filter((row) => row.status === "invalid")
          .map((row) => (
            <p key={row.rowNumber}>
              Row {row.rowNumber}: {row.error}
            </p>
          ))}
        {matchedMetricImportRows > 0 ? (
          <button disabled={isSavingMetricImport} onClick={() => void handleSaveMetricImport()} type="button">
            {isSavingMetricImport ? "Saving..." : "Save imported metrics"}
          </button>
        ) : null}
        {metricSaveError ? (
          <p className="inline-error" role="alert">
            {metricSaveError}
          </p>
        ) : null}
      </div>
    ) : null}
    {selectedLatestMetricSnapshot ? (
      <dl className="metric-snapshot-summary">
        <div>
          <dt>Views</dt>
          <dd>{selectedLatestMetricSnapshot.views}</dd>
        </div>
        <div>
          <dt>Likes</dt>
          <dd>{selectedLatestMetricSnapshot.likes}</dd>
        </div>
        <div>
          <dt>Favorites</dt>
          <dd>{selectedLatestMetricSnapshot.favorites}</dd>
        </div>
        <div>
          <dt>Comments</dt>
          <dd>{selectedLatestMetricSnapshot.comments}</dd>
        </div>
        <div>
          <dt>Shares</dt>
          <dd>{selectedLatestMetricSnapshot.shares}</dd>
        </div>
        <div>
          <dt>Snapshot</dt>
          <dd>{selectedLatestMetricSnapshot.snapshotAt}</dd>
        </div>
      </dl>
    ) : null}
  </section>
) : null}
```

- [ ] **Step 5: Add compact styles**

Add to `styles.css`:

```css
.metrics-import-panel {
  border-top: 1px solid #dbe3ea;
  display: grid;
  gap: 10px;
  padding-top: 14px;
}

.metric-import-preview {
  background: #f8fafc;
  border-radius: 6px;
  display: grid;
  gap: 6px;
  padding: 10px;
}

.metric-snapshot-summary {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  margin: 0;
}

.metric-snapshot-summary div {
  background: #f8fafc;
  border-radius: 6px;
  padding: 10px;
}

.metric-snapshot-summary dt {
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 700;
}

.metric-snapshot-summary dd {
  color: #172026;
  font-size: 1rem;
  font-weight: 800;
  margin: 4px 0 0;
}
```

- [ ] **Step 6: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/styles.css
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add metrics csv import ui"
```

## Task 5: Full Verification

**Files:**

- No planned source changes unless verification exposes a concrete issue.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: all workspaces pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: all workspaces pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: app builds successfully.

- [ ] **Step 4: Run bundle boundary check**

Run:

```bash
rg -n "@robert-station/local-store|packages/local-store/src|@robert-station/core|packages/core/src" apps/desktop/out/main/main.js
```

Expected: no matches and exit code 1.

- [ ] **Step 5: Run production dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: 0 vulnerabilities.

- [ ] **Step 6: Run whitespace and status checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. `git status --short` should be clean after intended commits.

- [ ] **Step 7: Complete branch workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present branch completion options and follow the user's selected option.
