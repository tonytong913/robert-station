# Review Report V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic single-project review reports that can be generated from a publish record, latest metrics, and persisted as versioned `ReviewReport` entities.

**Architecture:** Keep report generation in `@robert-station/core`, persist versioned reports through `@robert-station/local-store`, and expose the workflow through Electron IPC/preload. Renderer UI calls preload APIs only and shows the latest report beside the selected publish record and metrics import panel.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- Versioned `ReviewReport` domain model.
- Deterministic mock report generator.
- In-memory and SQLite persistence.
- IPC, preload, loader, and renderer wiring.
- Creation Studio action and latest-report display.

Deferred:

- Real cloud model calls.
- Knowledge extraction from review reports.
- Cross-project dashboards, charts, and editable reports.
- Server sync execution.

## Target File Structure

```text
packages/
  core/
    src/
      review-report.test.ts
      review-report.ts
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

## Task 1: Core Review Report Model And Generator

**Files:**

- Create: `packages/core/src/review-report.test.ts`
- Create: `packages/core/src/review-report.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing core tests**

Create `packages/core/src/review-report.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateMockReviewReport } from "./review-report";
import type { ContentProject, MetricSnapshot, PlatformPackage, PublishRecord } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "How to build a personal AI workstation for daily content work",
  status: "published",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const platformPackage: PlatformPackage = {
  id: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  draftVersionId: "draft_project-topic-ai-local-workstation-2",
  platform: "xiaohongshu",
  title: "Build a personal AI workstation",
  body: "A practical note for creators building repeatable AI workflows.",
  tags: ["#AI", "#workflow"],
  coverText: "AI workstation",
  requiredAssets: ["Cover image"],
  checks: [{ name: "Title length", status: "pass", message: "Title is short enough." }],
  createdAt: "2026-05-19T01:00:00.000Z",
  updatedAt: "2026-05-19T01:00:00.000Z"
};

const publishRecord: PublishRecord = {
  id: "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  platformPackageId: platformPackage.id,
  platform: "xiaohongshu",
  status: "published",
  publishedAt: "2026-05-19T12:00:00.000Z",
  url: "https://www.xiaohongshu.com/explore/demo",
  note: "Published after manual review.",
  createdAt: "2026-05-19T12:01:00.000Z",
  updatedAt: "2026-05-19T12:01:00.000Z"
};

const metricSnapshot: MetricSnapshot = {
  id: "metric-snapshot_publish-record-demo_2026-05-20T08:00:00.000Z",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  publishRecordId: publishRecord.id,
  platform: "xiaohongshu",
  sourceFileName: "metrics.csv",
  snapshotAt: "2026-05-20T08:00:00.000Z",
  views: 1000,
  likes: 95,
  favorites: 50,
  comments: 8,
  shares: 4,
  note: "first import",
  createdAt: "2026-05-20T08:01:00.000Z",
  updatedAt: "2026-05-20T08:01:00.000Z"
};

describe("generateMockReviewReport", () => {
  it("creates a deterministic metrics-backed review report", () => {
    const report = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot,
      version: 1,
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(report).toMatchObject({
      id: `review-report_${publishRecord.id}-v1`,
      workspaceId: "workspace_robert-station",
      contentProjectId: project.id,
      publishRecordId: publishRecord.id,
      metricSnapshotId: metricSnapshot.id,
      version: 1,
      createdAt: "2026-05-20T09:00:00.000Z",
      updatedAt: "2026-05-20T09:00:00.000Z"
    });
    expect(report.summary).toContain("1000 views");
    expect(report.highlights.join(" ")).toContain("Like rate");
    expect(report.underperformingSignals.length).toBeGreaterThan(0);
    expect(report.likelyCauses.join(" ")).toContain("Build a personal AI workstation");
    expect(report.nextActions.length).toBeGreaterThanOrEqual(3);
  });

  it("creates a no-metrics report without performance claims", () => {
    const report = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot: null,
      version: 2,
      now: new Date("2026-05-20T10:00:00.000Z")
    });

    expect(report.id).toBe(`review-report_${publishRecord.id}-v2`);
    expect(report.metricSnapshotId).toBeUndefined();
    expect(report.summary).toContain("No imported metrics are available yet");
    expect(report.highlights).toEqual(["Publish metadata is recorded and ready for metric import."]);
    expect(report.nextActions).toContain("Import the latest platform metrics CSV before making performance conclusions.");
  });

  it("handles zero-view metrics without dividing by zero", () => {
    const report = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot: { ...metricSnapshot, views: 0, likes: 0, favorites: 0, comments: 0, shares: 0 },
      version: 3,
      now: new Date("2026-05-20T11:00:00.000Z")
    });

    expect(report.summary).toContain("0 views");
    expect(report.underperformingSignals).toContain("Reach is not established yet because the latest snapshot has 0 views.");
  });
});
```

- [ ] **Step 2: Run core test to verify red state**

Run:

```bash
npm --workspace @robert-station/core test -- src/review-report.test.ts
```

Expected: FAIL because `./review-report` and `generateMockReviewReport` do not exist yet.

- [ ] **Step 3: Add `ReviewReport` type**

Modify `packages/core/src/types.ts` after `MetricSnapshot`:

```ts
export interface ReviewReport {
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

- [ ] **Step 4: Implement deterministic review generator**

Create `packages/core/src/review-report.ts`:

```ts
import { createEntityId } from "./ids";
import type { ContentProject, MetricSnapshot, PlatformPackage, PublishRecord, ReviewReport } from "./types";

interface GenerateMockReviewReportRequest {
  project: ContentProject;
  publishRecord: PublishRecord;
  platformPackage?: PlatformPackage | null;
  metricSnapshot?: MetricSnapshot | null;
  version: number;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-20T00:00:00.000Z");

export function generateMockReviewReport(request: GenerateMockReviewReportRequest): ReviewReport {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const id = createEntityId("review-report", `${request.publishRecord.id}-v${request.version}`);
  const packageTitle = request.platformPackage?.title ?? request.project.title;
  const base = {
    id,
    workspaceId: request.publishRecord.workspaceId,
    contentProjectId: request.publishRecord.contentProjectId,
    publishRecordId: request.publishRecord.id,
    version: request.version,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!request.metricSnapshot) {
    return {
      ...base,
      summary: `No imported metrics are available yet for ${request.project.title}. Treat this as a readiness review only.`,
      highlights: ["Publish metadata is recorded and ready for metric import."],
      underperformingSignals: ["Performance cannot be evaluated until a metric snapshot is imported."],
      likelyCauses: [`The ${formatPlatformName(request.publishRecord.platform)} package "${packageTitle}" needs metric data before content-fit conclusions are useful.`],
      nextActions: [
        "Import the latest platform metrics CSV before making performance conclusions.",
        "Confirm the publish URL and publish time are correct.",
        "Keep the draft, package, and source notes linked for the later performance review."
      ]
    };
  }

  const metrics = request.metricSnapshot;
  const likeRate = rate(metrics.likes, metrics.views);
  const favoriteRate = rate(metrics.favorites, metrics.views);
  const commentRate = rate(metrics.comments, metrics.views);
  const shareRate = rate(metrics.shares, metrics.views);

  return {
    ...base,
    metricSnapshotId: metrics.id,
    summary: `${request.project.title} reached ${metrics.views} views with ${metrics.likes} likes, ${metrics.favorites} favorites, ${metrics.comments} comments, and ${metrics.shares} shares in the latest snapshot.`,
    highlights: buildHighlights(likeRate, favoriteRate, commentRate, shareRate),
    underperformingSignals: buildUnderperformingSignals(metrics.views, likeRate, favoriteRate, commentRate, shareRate),
    likelyCauses: [
      `The package angle "${packageTitle}" is the main test variable for this report.`,
      `Publish timing was recorded as ${request.publishRecord.publishedAt}. Compare this slot with future reports before changing the topic direction.`,
      `The current metrics suggest the next iteration should adjust the title, cover text, or opening hook before expanding into a new format.`
    ],
    nextActions: [
      "Keep this package as the baseline for the next iteration.",
      "Write one alternate title and cover text before republishing a related topic.",
      "Import another metric snapshot after the next review window to compare trend direction."
    ]
  };
}

function buildHighlights(likeRate: number, favoriteRate: number, commentRate: number, shareRate: number): string[] {
  return [
    `Like rate is ${formatPercent(likeRate)}.`,
    `Favorite rate is ${formatPercent(favoriteRate)}.`,
    `Comment rate is ${formatPercent(commentRate)} and share rate is ${formatPercent(shareRate)}.`
  ];
}

function buildUnderperformingSignals(
  views: number,
  likeRate: number,
  favoriteRate: number,
  commentRate: number,
  shareRate: number
): string[] {
  if (views === 0) {
    return ["Reach is not established yet because the latest snapshot has 0 views."];
  }

  const signals: string[] = [];
  if (likeRate < 0.05) {
    signals.push("Like rate is below the v0 attention threshold of 5%.");
  }
  if (favoriteRate < 0.03) {
    signals.push("Favorite rate is below the v0 save-intent threshold of 3%.");
  }
  if (commentRate < 0.01) {
    signals.push("Comment rate is below the v0 discussion threshold of 1%.");
  }
  if (shareRate < 0.01) {
    signals.push("Share rate is below the v0 spread threshold of 1%.");
  }

  return signals.length > 0 ? signals : ["No weak engagement signal crossed the v0 thresholds."];
}

function rate(value: number, views: number): number {
  if (views <= 0) {
    return 0;
  }

  return value / views;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPlatformName(platform: PublishRecord["platform"]): string {
  const names: Record<PublishRecord["platform"], string> = {
    xiaohongshu: "Xiaohongshu",
    douyin: "Douyin",
    wechat_channels: "Wechat Channels",
    bilibili: "Bilibili"
  };

  return names[platform];
}
```

- [ ] **Step 5: Export review report API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./review-report";
```

Keep the existing exports unchanged.

- [ ] **Step 6: Run core verification**

Run:

```bash
npm --workspace @robert-station/core test -- src/review-report.test.ts
npm --workspace @robert-station/core run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/core/src/review-report.test.ts packages/core/src/review-report.ts packages/core/src/types.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add review report generator"
```

## Task 2: In-Memory Repository And Schema

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/schema.test.ts`
- Modify: `packages/local-store/src/schema.ts`

- [ ] **Step 1: Write failing in-memory repository tests**

Add these tests to `packages/local-store/src/content-loop-repository.test.ts` after the metric import tests:

```ts
  it("generates a review report in memory and marks the project as reviewed", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    const afterReview = await repository.generateReviewReport(publishRecord!.id);

    expect(afterReview.reviewReports).toHaveLength(1);
    expect(afterReview.reviewReports[0]).toMatchObject({
      publishRecordId: publishRecord!.id,
      contentProjectId: publishRecord!.contentProjectId,
      version: 1
    });
    expect(afterReview.projects.find((project) => project.id === publishRecord!.contentProjectId)?.status).toBe("reviewed");
  });

  it("creates increasing in-memory review report versions", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    await repository.generateReviewReport(publishRecord!.id);
    const afterSecondReview = await repository.generateReviewReport(publishRecord!.id);

    expect(afterSecondReview.reviewReports.map((report) => report.version)).toEqual([2, 1]);
    expect(afterSecondReview.reviewReports[0]?.id).toBe(`review-report_${publishRecord!.id}-v2`);
  });

  it("does not insert a review report for a missing publish record", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const afterReview = await repository.generateReviewReport("publish-record_missing");

    expect(afterReview.reviewReports).toHaveLength(0);
    expect(afterReview.projects).toEqual(before.projects);
  });
```

- [ ] **Step 2: Write failing schema test**

Modify the table-list expectation in `packages/local-store/src/schema.test.ts` to include `"review_reports"`:

```ts
expect(tableNames).toEqual(
  expect.arrayContaining([
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
    "metric_snapshots",
    "archive_records",
    "knowledge_items",
    "review_reports",
    "assets"
  ])
);
```

- [ ] **Step 3: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/content-loop-repository.test.ts src/schema.test.ts
```

Expected: FAIL because `reviewReports`, `generateReviewReport`, and the `review_reports` table do not exist yet.

- [ ] **Step 4: Add repository state and in-memory workflow**

Modify `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createManualPublishRecord,
  createMetricImportPreview,
  createMetricSnapshotsFromPreview,
  createSampleContentLoopSeed,
  generateMockArchivePackage,
  generateMockDraftPackage,
  generateMockReviewReport,
  generateMockTopics,
  generateMockXiaohongshuPackage
} from "@robert-station/core";
```

Add `ReviewReport` to the type imports:

```ts
  ReviewReport,
```

Add to `PersistedContentLoopState`:

```ts
  reviewReports: ReviewReport[];
```

Add to `ContentLoopRepository` before `archiveProject`:

```ts
  generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState>;
```

Add `reviewReports: []` in `createSeeded`.

Add this method to `InMemoryContentLoopRepository` after `saveMetricImport()`:

```ts
  async generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState> {
    const publishRecord = this.state.publishRecords.find((candidate) => candidate.id === publishRecordId);

    if (!publishRecord) {
      return cloneState(this.state);
    }

    const project = this.state.projects.find((candidate) => candidate.id === publishRecord.contentProjectId);
    if (!project) {
      return cloneState(this.state);
    }

    const platformPackage =
      this.state.platformPackages.find((candidate) => candidate.id === publishRecord.platformPackageId) ?? null;
    const metricSnapshot =
      this.state.metricSnapshots
        .filter((candidate) => candidate.publishRecordId === publishRecord.id)
        .sort(compareMetricSnapshots)[0] ?? null;
    const version =
      Math.max(
        0,
        ...this.state.reviewReports
          .filter((report) => report.publishRecordId === publishRecord.id)
          .map((report) => report.version)
      ) + 1;
    const reviewReport = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot,
      version,
      now: new Date()
    });

    this.state = {
      ...this.state,
      projects: this.state.projects.map((candidate) =>
        candidate.id === project.id ? { ...candidate, status: "reviewed", updatedAt: reviewReport.updatedAt } : candidate
      ),
      reviewReports: [reviewReport, ...this.state.reviewReports].sort(compareReviewReports),
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }
```

Add comparator near `compareMetricSnapshots`:

```ts
function compareReviewReports(left: ReviewReport, right: ReviewReport): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.version - left.version ||
    left.id.localeCompare(right.id)
  );
}
```

- [ ] **Step 5: Add SQLite schema table**

Modify `packages/local-store/src/schema.ts` by adding this table between `metric_snapshots` and `archive_records`:

```ts
CREATE TABLE IF NOT EXISTS review_reports (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  publish_record_id TEXT NOT NULL REFERENCES publish_records(id),
  metric_snapshot_id TEXT REFERENCES metric_snapshots(id),
  version INTEGER NOT NULL,
  summary TEXT NOT NULL,
  highlights_json TEXT NOT NULL DEFAULT '[]',
  underperforming_signals_json TEXT NOT NULL DEFAULT '[]',
  likely_causes_json TEXT NOT NULL DEFAULT '[]',
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 6: Run local-store verification**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/content-loop-repository.test.ts src/schema.test.ts
npm --workspace @robert-station/local-store run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/content-loop-repository.ts packages/local-store/src/schema.test.ts packages/local-store/src/schema.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: store review reports in memory"
```

## Task 3: SQLite Review Report Persistence

**Files:**

- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`

- [ ] **Step 1: Write failing SQLite tests**

Add these tests to `packages/local-store/src/sqlite-content-loop-repository.test.ts` after metric snapshot tests:

```ts
  it("persists review reports across repository instances", async () => {
    const firstRepository = new SqliteContentLoopRepository(databasePath);
    const afterPublish = await publishXiaohongshuDemo(firstRepository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    await firstRepository.generateReviewReport(publishRecord!.id);
    const secondRepository = new SqliteContentLoopRepository(databasePath);
    const reloaded = await secondRepository.loadContentLoop();

    expect(reloaded.reviewReports).toHaveLength(1);
    expect(reloaded.reviewReports[0]).toMatchObject({
      publishRecordId: publishRecord!.id,
      contentProjectId: publishRecord!.contentProjectId,
      version: 1
    });
    expect(reloaded.projects.find((project) => project.id === publishRecord!.contentProjectId)?.status).toBe("reviewed");
  });

  it("creates increasing SQLite review report versions", async () => {
    const repository = new SqliteContentLoopRepository(databasePath);
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    await repository.generateReviewReport(publishRecord!.id);
    const afterSecondReview = await repository.generateReviewReport(publishRecord!.id);

    expect(afterSecondReview.reviewReports.map((report) => report.version)).toEqual([2, 1]);
    expect(afterSecondReview.reviewReports[0]?.id).toBe(`review-report_${publishRecord!.id}-v2`);
  });

  it("does not insert a SQLite review report for a missing publish record", async () => {
    const repository = new SqliteContentLoopRepository(databasePath);
    const before = await repository.loadContentLoop();
    const afterReview = await repository.generateReviewReport("publish-record_missing");

    expect(afterReview.reviewReports).toHaveLength(0);
    expect(afterReview.projects).toEqual(before.projects);
  });
```

Also update the seeded reload test to expect `reviewReports`:

```ts
expect(firstLoad.reviewReports).toHaveLength(0);
```

Update the schema table-list test in this file to include `"review_reports"`.

- [ ] **Step 2: Run SQLite tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/sqlite-content-loop-repository.test.ts
```

Expected: FAIL because SQLite loading, inserting, and mapping review reports are not implemented.

- [ ] **Step 3: Add SQLite workflow and load state**

Modify `packages/local-store/src/sqlite-content-loop-repository.ts`:

Add `generateMockReviewReport` to the core imports and `ReviewReport` to type imports.

Add method after `saveMetricImport()`:

```ts
  async generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState> {
    const state = this.loadState();
    const publishRecord = state.publishRecords.find((candidate) => candidate.id === publishRecordId);

    if (!publishRecord) {
      return state;
    }

    const project = state.projects.find((candidate) => candidate.id === publishRecord.contentProjectId);
    if (!project) {
      return state;
    }

    const platformPackage = state.platformPackages.find((candidate) => candidate.id === publishRecord.platformPackageId) ?? null;
    const metricSnapshot =
      state.metricSnapshots
        .filter((candidate) => candidate.publishRecordId === publishRecord.id)
        .sort(compareMetricSnapshots)[0] ?? null;
    const version =
      Math.max(
        0,
        ...state.reviewReports
          .filter((report) => report.publishRecordId === publishRecord.id)
          .map((report) => report.version)
      ) + 1;
    const reviewReport = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot,
      version,
      now: new Date()
    });

    this.database.exec("BEGIN;");
    try {
      this.upsertProject({ ...project, status: "reviewed", updatedAt: reviewReport.updatedAt });
      this.insertReviewReport(reviewReport);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.loadState(project.id);
  }
```

In `loadState`, query review reports:

```ts
    const reviewReports = this.database
      .prepare("SELECT * FROM review_reports ORDER BY updated_at DESC, version DESC, id ASC;")
      .all() as ReviewReportRow[];
```

Add `reviewReports: reviewReports.map(mapReviewReportRow),` to the returned state.

- [ ] **Step 4: Add SQLite row type, mapper, and insert helper**

Add row type near the other row interfaces:

```ts
interface ReviewReportRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  publish_record_id: string;
  metric_snapshot_id: string | null;
  version: number;
  summary: string;
  highlights_json: string;
  underperforming_signals_json: string;
  likely_causes_json: string;
  next_actions_json: string;
  created_at: string;
  updated_at: string;
}
```

Add mapper near other `map*Row` helpers:

```ts
function mapReviewReportRow(row: ReviewReportRow): ReviewReport {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    publishRecordId: row.publish_record_id,
    version: row.version,
    summary: row.summary,
    highlights: JSON.parse(row.highlights_json) as string[],
    underperformingSignals: JSON.parse(row.underperforming_signals_json) as string[],
    likelyCauses: JSON.parse(row.likely_causes_json) as string[],
    nextActions: JSON.parse(row.next_actions_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.metric_snapshot_id ? { metricSnapshotId: row.metric_snapshot_id } : {})
  };
}
```

Add helper near other insert/upsert helpers:

```ts
  private insertReviewReport(reviewReport: ReviewReport): void {
    this.database
      .prepare(
        `INSERT INTO review_reports (
          id,
          workspace_id,
          content_project_id,
          publish_record_id,
          metric_snapshot_id,
          version,
          summary,
          highlights_json,
          underperforming_signals_json,
          likely_causes_json,
          next_actions_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run(
        reviewReport.id,
        reviewReport.workspaceId,
        reviewReport.contentProjectId,
        reviewReport.publishRecordId,
        reviewReport.metricSnapshotId ?? null,
        reviewReport.version,
        reviewReport.summary,
        JSON.stringify(reviewReport.highlights),
        JSON.stringify(reviewReport.underperformingSignals),
        JSON.stringify(reviewReport.likelyCauses),
        JSON.stringify(reviewReport.nextActions),
        reviewReport.createdAt,
        reviewReport.updatedAt
      );
  }
```

In the clock helper query around the existing `metric_snapshots`, `archive_records`, and `knowledge_items` unions, add this branch:

```sql
           SELECT updated_at FROM review_reports
```

Place it after the existing `metric_snapshots` branches and before `archive_records` so review report timestamps participate in later generated record clocks.

- [ ] **Step 5: Run SQLite verification**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/sqlite-content-loop-repository.test.ts
npm --workspace @robert-station/local-store run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/local-store/src/sqlite-content-loop-repository.test.ts packages/local-store/src/sqlite-content-loop-repository.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist review reports in sqlite"
```

## Task 4: IPC, Preload, Loader, And Test Mocks

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

Add to `apps/desktop/src/renderer/content-loop-loader.test.ts`:

```ts
  it("generates review reports through preload API", async () => {
    await generatePersistedReviewReport("publish-record_demo");

    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledWith("publish-record_demo");
  });
```

Add `generatePersistedReviewReport` to that file's import list.

Add to `apps/desktop/src/renderer/content-loop-service.test.ts`:

```ts
  it("rejects invalid review report publish record ids before calling the repository", async () => {
    registerContentLoopIpc(repository);

    const handler = getHandler(CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL);

    await expect(handler({} as IpcMainInvokeEvent, "")).rejects.toThrow("Invalid publish record id.");
    expect(repository.generateReviewReport).not.toHaveBeenCalled();
  });

  it("generates a review report through the repository", async () => {
    registerContentLoopIpc(repository);

    const handler = getHandler(CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL);
    await handler({} as IpcMainInvokeEvent, "publish-record_demo");

    expect(repository.generateReviewReport).toHaveBeenCalledWith("publish-record_demo");
  });
```

Import `CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL` in the service test and add `generateReviewReport: vi.fn(async () => emptyState),` to the repository mock.

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- src/renderer/content-loop-loader.test.ts src/renderer/content-loop-service.test.ts
```

Expected: FAIL because review report channel and preload loader functions do not exist.

- [ ] **Step 3: Add IPC channel and main-process validation**

Modify `apps/desktop/src/main/ipc-channels.ts`:

```ts
export const CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL = "content-loop:generate-review-report";
```

Modify `apps/desktop/src/main/content-loop-service.ts` import list to include the new channel.

Add handler before `CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL`:

```ts
  ipcMain.handle(CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL, async (_event, publishRecordId: unknown) => {
    if (typeof publishRecordId !== "string" || publishRecordId.length === 0) {
      throw new Error("Invalid publish record id.");
    }

    return repository.generateReviewReport(publishRecordId);
  });
```

- [ ] **Step 4: Add preload, globals, loader, and test setup**

Modify `apps/desktop/src/preload/preload.ts` to import the new channel and add:

```ts
    generateReviewReport: (publishRecordId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL, publishRecordId) as Promise<PersistedContentLoopState>,
```

Modify `apps/desktop/src/renderer/global.d.ts`:

```ts
        generateReviewReport: (publishRecordId: string) => Promise<PersistedContentLoopState>;
```

Modify `apps/desktop/src/renderer/content-loop-loader.ts`:

```ts
export async function generatePersistedReviewReport(publishRecordId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generateReviewReport(publishRecordId);
}
```

Modify `apps/desktop/src/renderer/test-setup.ts`:

```ts
      generateReviewReport: vi.fn(async (publishRecordId: string) => repository.generateReviewReport(publishRecordId)),
```

- [ ] **Step 5: Run desktop API verification**

Run:

```bash
npm --workspace @robert-station/desktop test -- src/renderer/content-loop-loader.test.ts src/renderer/content-loop-service.test.ts
npm --workspace @robert-station/desktop run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/src/main/ipc-channels.ts apps/desktop/src/main/content-loop-service.ts apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/content-loop-service.test.ts apps/desktop/src/renderer/test-setup.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose review report ipc"
```

## Task 5: Creation Studio Review UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add to `apps/desktop/src/renderer/App.test.tsx` near the metrics import tests:

```ts
  it("generates and displays a review report for the selected publish record", async () => {
    render(<App />);

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));

    expect(await screen.findByText("Review Report v1")).toBeInTheDocument();
    expect(screen.getByText(/reached/i)).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledOnce();
  });

  it("shows an inline error and keeps current content when review generation fails", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    render(<App />);

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));

    expect(await screen.findByText("Could not generate review report. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Xiaohongshu Package")).toBeInTheDocument();
  });
```

The existing `publishXiaohongshuPackage()` helper is enough for these tests. If it does not save metrics first, the no-metrics report path is expected and acceptable.

- [ ] **Step 2: Run UI tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- src/renderer/App.test.tsx
```

Expected: FAIL because the review report UI does not exist yet.

- [ ] **Step 3: Add UI state, derived latest report, and handler**

Modify `apps/desktop/src/renderer/App.tsx` imports:

```ts
  generatePersistedReviewReport,
```

Add state near metric state:

```ts
  const [isGeneratingReviewReport, setIsGeneratingReviewReport] = useState(false);
  const [reviewReportError, setReviewReportError] = useState<string | null>(null);
```

Add derived latest report after `selectedLatestMetricSnapshot`:

```ts
  const selectedReviewReports =
    selectedPublishRecord && contentLoop
      ? contentLoop.reviewReports.filter((report) => report.publishRecordId === selectedPublishRecord.id)
      : [];
  const selectedLatestReviewReport = selectedReviewReports[0] ?? null;
```

Add handler after `handleSaveMetricImport()`:

```ts
  async function handleGenerateReviewReport(publishRecordId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsGeneratingReviewReport(true);
    setReviewReportError(null);

    try {
      const nextState = await generatePersistedReviewReport(publishRecordId);
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setReviewReportError("Could not generate review report. Try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingReviewReport(false);
      }
    }
  }
```

- [ ] **Step 4: Render review panel**

Inside the `selectedPublishRecord ? (...) : null` block, after the metrics import section, add:

```tsx
                          <section className="review-report-panel" aria-label="Review report">
                            <h3>Review report</h3>
                            <button
                              disabled={isGeneratingReviewReport}
                              onClick={() => void handleGenerateReviewReport(selectedPublishRecord.id)}
                              type="button"
                            >
                              {isGeneratingReviewReport ? "Generating..." : "Generate review report"}
                            </button>
                            {reviewReportError ? (
                              <p className="inline-error" role="alert">
                                {reviewReportError}
                              </p>
                            ) : null}
                            {selectedLatestReviewReport ? (
                              <article className="review-report-card">
                                <p className="eyebrow">Review Report v{selectedLatestReviewReport.version}</p>
                                <p>{selectedLatestReviewReport.summary}</p>
                                <h4>Highlights</h4>
                                <ul>
                                  {selectedLatestReviewReport.highlights.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                                <h4>Underperforming signals</h4>
                                <ul>
                                  {selectedLatestReviewReport.underperformingSignals.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                                <h4>Likely causes</h4>
                                <ul>
                                  {selectedLatestReviewReport.likelyCauses.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                                <h4>Next actions</h4>
                                <ul>
                                  {selectedLatestReviewReport.nextActions.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </article>
                            ) : null}
                          </section>
```

- [ ] **Step 5: Add compact styles**

Modify `apps/desktop/src/renderer/styles.css` by grouping the new panel with existing compact panels:

```css
.review-report-panel,
.metrics-import-panel,
.manual-publish-panel {
  border-top: 1px solid #d6dde8;
  display: grid;
  gap: 0.75rem;
  padding-top: 1rem;
}

.review-report-card {
  display: grid;
  gap: 0.65rem;
}

.review-report-card h4 {
  font-size: 0.82rem;
  margin: 0;
}

.review-report-card ul {
  margin: 0;
  padding-left: 1.1rem;
}
```

If `.metrics-import-panel` or `.manual-publish-panel` already has an equivalent rule, merge `.review-report-panel` into that selector instead of duplicating conflicting CSS.

- [ ] **Step 6: Run desktop UI verification**

Run:

```bash
npm --workspace @robert-station/desktop test -- src/renderer/App.test.tsx
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/styles.css
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add review report ui"
```

## Task 6: Full Verification

**Files:**

- Verify: whole repository.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run bundle boundary check**

Run:

```bash
test -f apps/desktop/dist/main/main.js && ! grep -R "@robert-station/core\\|@robert-station/local-store" apps/desktop/dist/main
```

Expected: exit code 0.

- [ ] **Step 5: Run production dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: no production vulnerabilities.

- [ ] **Step 6: Run whitespace and status checks**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` may still show unrelated `?? AGENTS.md`; review report implementation files should be committed.

- [ ] **Step 7: Complete branch workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present branch completion options and follow the user's selected option.

## Self-Review

Spec coverage:

- `ReviewReport` type and deterministic generation: Task 1.
- In-memory repository workflow and versioning: Task 2.
- SQLite table, persistence, reload behavior: Tasks 2 and 3.
- IPC/preload/loader exposure and validation: Task 4.
- Creation Studio action, error state, latest report display: Task 5.
- Full test, typecheck, build, audit, and git checks: Task 6.

Type consistency:

- Repository workflow name is `generateReviewReport(publishRecordId: string)` in every layer.
- State field is `reviewReports` in core consumers, repositories, tests, and UI.
- Entity type is `ReviewReport`; optional metric link is `metricSnapshotId`.

Scope check:

- The plan implements local deterministic single-project reports only.
- Real AI, knowledge extraction from reports, charts, dashboards, and server sync remain deferred.
