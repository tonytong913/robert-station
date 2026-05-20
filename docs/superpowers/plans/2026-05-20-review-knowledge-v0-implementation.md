# Review Knowledge V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic extraction of one reusable `KnowledgeItem` from a saved review report when the related project already has an archive record.

**Architecture:** Keep review-to-knowledge generation in `@robert-station/core`, reuse the existing `KnowledgeItem` model and `knowledge_items` table in `@robert-station/local-store`, and expose extraction through Electron IPC/preload. Renderer UI adds an `Extract knowledge` action inside the latest review report card and uses the existing Knowledge screen for display.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- Deterministic review-derived `KnowledgeItem` generation.
- Existing archive record required before extraction.
- One knowledge item per review report, upserted by deterministic ID.
- In-memory and SQLite persistence using the existing `knowledge_items` table.
- IPC, preload, loader, and renderer wiring.
- Creation Studio extraction action and Knowledge screen visibility.

Deferred:

- `KnowledgeItem` schema changes.
- Multiple knowledge items per review report.
- Editable knowledge items.
- Knowledge search/filter UI.
- Real AI extraction.

## Target File Structure

```text
packages/
  core/
    src/
      review-knowledge.test.ts
      review-knowledge.ts
      index.ts
  local-store/
    src/
      content-loop-repository.test.ts
      content-loop-repository.ts
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

## Task 1: Core Review Knowledge Generator

**Files:**

- Create: `packages/core/src/review-knowledge.test.ts`
- Create: `packages/core/src/review-knowledge.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing core tests**

Create `packages/core/src/review-knowledge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEntityId } from "./ids";
import { generateMockReviewKnowledgeItem } from "./review-knowledge";
import type { ArchiveRecord, ContentProject, MetricSnapshot, ReviewReport } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "How to build a personal AI workstation for daily content work",
  status: "reviewed",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-20T09:00:00.000Z"
};

const archiveRecord: ArchiveRecord = {
  id: "archive-record_project-topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  draftVersionId: "draft_project-topic-ai-local-workstation-2",
  platformPackageId: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  title: project.title,
  summary: "Archived AI workstation package.",
  sourceCount: 1,
  packageCount: 1,
  status: "archived",
  createdAt: "2026-05-20T08:00:00.000Z",
  updatedAt: "2026-05-20T08:00:00.000Z"
};

const reviewReport: ReviewReport = {
  id: "review-report_publish-record-demo-v1",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  publishRecordId: "publish-record_demo",
  metricSnapshotId: "metric-snapshot_demo",
  version: 1,
  summary: "The workstation post reached 1000 views and showed strong save intent.",
  highlights: ["Favorite rate is 5.0%."],
  underperformingSignals: ["Comment rate is below the v0 discussion threshold of 1%."],
  likelyCauses: ["The title made the workflow benefit concrete."],
  nextActions: [
    "Write one alternate title and cover text before republishing a related topic.",
    "Import another metric snapshot after the next review window."
  ],
  createdAt: "2026-05-20T09:00:00.000Z",
  updatedAt: "2026-05-20T09:00:00.000Z"
};

const metricSnapshot: MetricSnapshot = {
  id: "metric-snapshot_demo",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  publishRecordId: "publish-record_demo",
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

describe("generateMockReviewKnowledgeItem", () => {
  it("creates deterministic review-derived knowledge from a review report and archive", () => {
    const item = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport,
      metricSnapshot,
      now: new Date("2026-05-20T10:00:00.000Z")
    });

    expect(item).toMatchObject({
      id: createEntityId("knowledge-item-review", reviewReport.id),
      workspaceId: "workspace_robert-station",
      archiveRecordId: archiveRecord.id,
      contentProjectId: project.id,
      columnSlug: "ai",
      title: `Review lesson: ${project.title}`,
      createdAt: "2026-05-20T10:00:00.000Z",
      updatedAt: "2026-05-20T10:00:00.000Z"
    });
    expect(item.lesson).toContain(reviewReport.summary);
    expect(item.lesson).toContain(reviewReport.nextActions[0]);
    expect(item.evidence).toContain("Review Report v1");
    expect(item.evidence).toContain(metricSnapshot.id);
    expect(item.tags).toEqual(["ai", "review", "performance", "metrics"]);
  });

  it("omits the metrics tag and metric evidence when the report has no metric snapshot", () => {
    const item = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport: { ...reviewReport, metricSnapshotId: undefined },
      metricSnapshot: null,
      now: new Date("2026-05-20T11:00:00.000Z")
    });

    expect(item.tags).toEqual(["ai", "review", "performance"]);
    expect(item.evidence).toContain("Review Report v1");
    expect(item.evidence).not.toContain("metric-snapshot");
  });
});
```

- [ ] **Step 2: Run core test to verify red state**

Run:

```bash
npm --workspace @robert-station/core test -- src/review-knowledge.test.ts
```

Expected: FAIL because `./review-knowledge` does not exist.

- [ ] **Step 3: Implement review knowledge generator**

Create `packages/core/src/review-knowledge.ts`:

```ts
import { createEntityId } from "./ids";
import type { ArchiveRecord, ContentColumnSlug, ContentProject, KnowledgeItem, MetricSnapshot, ReviewReport } from "./types";

interface GenerateMockReviewKnowledgeItemRequest {
  project: ContentProject;
  archiveRecord: ArchiveRecord;
  reviewReport: ReviewReport;
  metricSnapshot?: MetricSnapshot | null;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-20T00:00:00.000Z");

export function generateMockReviewKnowledgeItem(request: GenerateMockReviewKnowledgeItemRequest): KnowledgeItem {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const columnSlug = resolveColumnSlug(request.project);
  const tags = request.metricSnapshot
    ? [columnSlug, "review", "performance", "metrics"]
    : [columnSlug, "review", "performance"];

  return {
    id: createEntityId("knowledge-item-review", request.reviewReport.id),
    workspaceId: request.reviewReport.workspaceId,
    archiveRecordId: request.archiveRecord.id,
    contentProjectId: request.reviewReport.contentProjectId,
    columnSlug,
    title: `Review lesson: ${request.project.title}`,
    lesson: buildLesson(request.reviewReport),
    evidence: buildEvidence(request.reviewReport, request.metricSnapshot),
    tags,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildLesson(reviewReport: ReviewReport): string {
  const nextAction = reviewReport.nextActions[0] ?? "Keep the review report linked to future content decisions.";
  return `Reusable lesson: ${reviewReport.summary} Next action: ${nextAction}`;
}

function buildEvidence(reviewReport: ReviewReport, metricSnapshot?: MetricSnapshot | null): string {
  const parts = [`Review Report v${reviewReport.version}`];

  if (metricSnapshot) {
    parts.push(`Metric snapshot ${metricSnapshot.id} at ${metricSnapshot.snapshotAt}`);
  }

  return parts.join(". ");
}

function resolveColumnSlug(project: ContentProject): ContentColumnSlug {
  return project.primaryColumnId.replace(/^column_/, "") as ContentColumnSlug;
}
```

- [ ] **Step 4: Export review knowledge API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./review-knowledge";
```

Keep existing exports unchanged.

- [ ] **Step 5: Run core verification**

Run:

```bash
npm --workspace @robert-station/core test -- src/review-knowledge.test.ts
npm --workspace @robert-station/core run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/core/src/review-knowledge.test.ts packages/core/src/review-knowledge.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add review knowledge generator"
```

## Task 2: Local Store Review Knowledge Workflow

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`

- [ ] **Step 1: Write failing in-memory tests**

Add these tests to `packages/local-store/src/content-loop-repository.test.ts` after review report tests:

```ts
  it("extracts review knowledge in memory when an archive exists", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];
    const afterReview = await repository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];
    const afterArchive = await repository.archiveProject(publishRecord!.contentProjectId);

    expect(afterArchive.archiveRecords).toHaveLength(1);

    const afterExtract = await repository.extractReviewKnowledge(reviewReport!.id);

    expect(afterExtract.knowledgeItems.some((item) => item.id.startsWith("knowledge-item-review"))).toBe(true);
    expect(afterExtract.knowledgeItems[0]).toMatchObject({
      archiveRecordId: afterArchive.archiveRecords[0]?.id,
      contentProjectId: publishRecord!.contentProjectId,
      columnSlug: "ai"
    });
    expect(afterExtract.knowledgeItems[0]?.tags).toContain("review");
  });

  it("replaces the same in-memory review knowledge item and preserves createdAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];
    await repository.archiveProject(publishRecord!.contentProjectId);
    const afterReview = await repository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];
    const afterFirstExtract = await repository.extractReviewKnowledge(reviewReport!.id);
    const afterSecondExtract = await repository.extractReviewKnowledge(reviewReport!.id);
    const firstItem = afterFirstExtract.knowledgeItems[0];
    const secondItem = afterSecondExtract.knowledgeItems[0];

    expect(afterSecondExtract.knowledgeItems.filter((item) => item.id === firstItem?.id)).toHaveLength(1);
    expect(secondItem?.id).toBe(firstItem?.id);
    expect(secondItem?.createdAt).toBe(firstItem?.createdAt);
  });

  it("does not extract review knowledge without an archive", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];
    const afterReview = await repository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];
    const afterExtract = await repository.extractReviewKnowledge(reviewReport!.id);

    expect(afterExtract.knowledgeItems).toHaveLength(0);
  });

  it("does not extract review knowledge for a missing review report", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterExtract = await repository.extractReviewKnowledge("review-report_missing");

    expect(afterExtract.knowledgeItems).toHaveLength(0);
  });
```

- [ ] **Step 2: Write failing SQLite tests**

Add these tests to `packages/local-store/src/sqlite-content-loop-repository.test.ts` after review report tests:

```ts
  it("persists review-derived knowledge across repository instances", async () => {
    const firstRepository = new SqliteContentLoopRepository(databasePath);
    const afterPublish = await publishXiaohongshuDemo(firstRepository);
    const publishRecord = afterPublish.publishRecords[0];
    await firstRepository.archiveProject(publishRecord!.contentProjectId);
    const afterReview = await firstRepository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];

    await firstRepository.extractReviewKnowledge(reviewReport!.id);

    const secondRepository = new SqliteContentLoopRepository(databasePath);
    const reloaded = await secondRepository.loadContentLoop();

    expect(reloaded.knowledgeItems.some((item) => item.id.startsWith("knowledge-item-review"))).toBe(true);
    expect(reloaded.knowledgeItems[0]?.tags).toContain("review");
  });

  it("does not insert SQLite review knowledge without an archive", async () => {
    const repository = new SqliteContentLoopRepository(databasePath);
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];
    const afterReview = await repository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];
    const afterExtract = await repository.extractReviewKnowledge(reviewReport!.id);

    expect(afterExtract.knowledgeItems).toHaveLength(0);
  });
```

- [ ] **Step 3: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/content-loop-repository.test.ts src/sqlite-content-loop-repository.test.ts
```

Expected: FAIL because `extractReviewKnowledge` is not defined.

- [ ] **Step 4: Add in-memory workflow**

Modify `packages/local-store/src/content-loop-repository.ts`.

Add `generateMockReviewKnowledgeItem` to the core imports:

```ts
  generateMockReviewKnowledgeItem,
```

Add method to `ContentLoopRepository` after `generateReviewReport`:

```ts
  extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState>;
```

Add method to `InMemoryContentLoopRepository` after `generateReviewReport`:

```ts
  async extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState> {
    const reviewReport = this.state.reviewReports.find((candidate) => candidate.id === reviewReportId);

    if (!reviewReport) {
      return cloneState(this.state);
    }

    const project = this.state.projects.find((candidate) => candidate.id === reviewReport.contentProjectId);
    const archiveRecord = this.state.archiveRecords.find(
      (candidate) => candidate.contentProjectId === reviewReport.contentProjectId
    );

    if (!project || !archiveRecord) {
      return cloneState(this.state);
    }

    const metricSnapshot = reviewReport.metricSnapshotId
      ? this.state.metricSnapshots.find((candidate) => candidate.id === reviewReport.metricSnapshotId) ?? null
      : null;
    const knowledgeItem = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport,
      metricSnapshot,
      now: new Date()
    });
    const existing = this.state.knowledgeItems.find((candidate) => candidate.id === knowledgeItem.id);
    const persistedKnowledgeItem = {
      ...knowledgeItem,
      createdAt: existing?.createdAt ?? knowledgeItem.createdAt
    };

    this.state = {
      ...this.state,
      knowledgeItems: [
        persistedKnowledgeItem,
        ...this.state.knowledgeItems.filter((candidate) => candidate.id !== persistedKnowledgeItem.id)
      ],
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }
```

- [ ] **Step 5: Add SQLite workflow**

Modify `packages/local-store/src/sqlite-content-loop-repository.ts`.

Add `generateMockReviewKnowledgeItem` to core imports.

Add method after `generateReviewReport`:

```ts
  async extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState> {
    const state = this.loadState();
    const reviewReport = state.reviewReports.find((candidate) => candidate.id === reviewReportId);

    if (!reviewReport) {
      return state;
    }

    const project = state.projects.find((candidate) => candidate.id === reviewReport.contentProjectId);
    const archiveRecord = state.archiveRecords.find(
      (candidate) => candidate.contentProjectId === reviewReport.contentProjectId
    );

    if (!project || !archiveRecord) {
      return state;
    }

    const metricSnapshot = reviewReport.metricSnapshotId
      ? state.metricSnapshots.find((candidate) => candidate.id === reviewReport.metricSnapshotId) ?? null
      : null;
    const knowledgeItem = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport,
      metricSnapshot,
      now: this.createPromotionDate()
    });
    const existing = state.knowledgeItems.find((candidate) => candidate.id === knowledgeItem.id);

    this.upsertKnowledgeItem({
      ...knowledgeItem,
      createdAt: existing?.createdAt ?? knowledgeItem.createdAt
    });

    return this.loadState(project.id);
  }
```

No schema changes are needed because `upsertKnowledgeItem` already writes the existing `knowledge_items` table.

- [ ] **Step 6: Run local-store verification**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/content-loop-repository.test.ts src/sqlite-content-loop-repository.test.ts
npm --workspace @robert-station/local-store run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts packages/local-store/src/sqlite-content-loop-repository.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist review knowledge extraction"
```

## Task 3: IPC, Preload, Loader, And Test Mocks

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
  it("extracts review knowledge through preload API", async () => {
    await extractPersistedReviewKnowledge("review-report_demo");

    expect(window.robertStation.contentLoop.extractReviewKnowledge).toHaveBeenCalledWith("review-report_demo");
  });
```

Add `extractPersistedReviewKnowledge` to the import list.

Add to `apps/desktop/src/renderer/content-loop-service.test.ts`:

```ts
  it("rejects invalid review knowledge ids before calling the repository", async () => {
    registerContentLoopIpc(repository);

    const handler = getHandler(CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL);

    await expect(handler({} as IpcMainInvokeEvent, "")).rejects.toThrow("Invalid review report id.");
    expect(repository.extractReviewKnowledge).not.toHaveBeenCalled();
  });

  it("extracts review knowledge through the repository", async () => {
    registerContentLoopIpc(repository);

    const handler = getHandler(CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL);
    await handler({} as IpcMainInvokeEvent, "review-report_demo");

    expect(repository.extractReviewKnowledge).toHaveBeenCalledWith("review-report_demo");
  });
```

Import `CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL` and add `extractReviewKnowledge: vi.fn(async () => emptyState),` to the repository mock.

- [ ] **Step 2: Run desktop API tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- src/renderer/content-loop-loader.test.ts src/renderer/content-loop-service.test.ts
```

Expected: FAIL because the channel and loader do not exist.

- [ ] **Step 3: Add IPC channel and main handler**

Modify `apps/desktop/src/main/ipc-channels.ts`:

```ts
export const CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL = "content-loop:extract-review-knowledge";
```

Modify `apps/desktop/src/main/content-loop-service.ts` to import the new channel and add:

```ts
  ipcMain.handle(CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL, async (_event, reviewReportId: unknown) => {
    if (typeof reviewReportId !== "string" || reviewReportId.length === 0) {
      throw new Error("Invalid review report id.");
    }

    return repository.extractReviewKnowledge(reviewReportId);
  });
```

Place the handler near the review report handler.

- [ ] **Step 4: Add preload, global type, loader, and test setup**

Modify `apps/desktop/src/preload/preload.ts` to import the new channel and expose:

```ts
    extractReviewKnowledge: (reviewReportId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL, reviewReportId) as Promise<PersistedContentLoopState>,
```

Modify `apps/desktop/src/renderer/global.d.ts`:

```ts
        extractReviewKnowledge: (reviewReportId: string) => Promise<PersistedContentLoopState>;
```

Modify `apps/desktop/src/renderer/content-loop-loader.ts`:

```ts
export async function extractPersistedReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.extractReviewKnowledge(reviewReportId);
}
```

Modify `apps/desktop/src/renderer/test-setup.ts`:

```ts
      extractReviewKnowledge: vi.fn(async (reviewReportId: string) => repository.extractReviewKnowledge(reviewReportId)),
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
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose review knowledge ipc"
```

## Task 4: Creation Studio Review Knowledge UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add to `apps/desktop/src/renderer/App.test.tsx` near review report tests:

```ts
  it("extracts review knowledge after a project is archived and lists it in Knowledge", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));
    await screen.findByText("Archived");
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));
    await screen.findByText("Review Report v1");

    fireEvent.click(screen.getByRole("button", { name: "Extract knowledge" }));

    expect(await screen.findByText("Knowledge extracted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Knowledge" }));
    expect(await screen.findByText(/Review lesson:/)).toBeInTheDocument();
    expect(screen.getByText(/review performance/)).toBeInTheDocument();
  });

  it("shows archive-required message when extracting review knowledge before archive", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));
    await screen.findByText("Review Report v1");

    fireEvent.click(screen.getByRole("button", { name: "Extract knowledge" }));

    expect(await screen.findByText("Archive this project before extracting review knowledge.")).toBeInTheDocument();
  });

  it("shows an inline error and keeps the review report when review knowledge extraction fails", async () => {
    window.robertStation.contentLoop.extractReviewKnowledge = vi.fn(async () => {
      throw new Error("Extract failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));
    await screen.findByText("Archived");
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));
    await screen.findByText("Review Report v1");
    fireEvent.click(screen.getByRole("button", { name: "Extract knowledge" }));

    expect(await screen.findByText("Could not extract review knowledge. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Review Report v1")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run UI tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- src/renderer/App.test.tsx
```

Expected: FAIL because the extraction UI does not exist.

- [ ] **Step 3: Add App state and handler**

Modify `apps/desktop/src/renderer/App.tsx` import list:

```ts
  extractPersistedReviewKnowledge,
```

Add state near review report state:

```ts
  const [isExtractingReviewKnowledge, setIsExtractingReviewKnowledge] = useState(false);
  const [reviewKnowledgeMessage, setReviewKnowledgeMessage] = useState<string | null>(null);
  const [reviewKnowledgeError, setReviewKnowledgeError] = useState<string | null>(null);
```

Add handler after `handleGenerateReviewReport`:

```ts
  async function handleExtractReviewKnowledge(reviewReportId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsExtractingReviewKnowledge(true);
    setReviewKnowledgeMessage(null);
    setReviewKnowledgeError(null);

    try {
      const nextState = await extractPersistedReviewKnowledge(reviewReportId);
      if (isMountedRef.current) {
        const hasReviewKnowledge = nextState.knowledgeItems.some(
          (item) =>
            item.contentProjectId === selectedProject?.id &&
            item.tags.includes("review") &&
            item.tags.includes("performance")
        );
        setContentLoop(nextState);
        setReviewKnowledgeMessage(hasReviewKnowledge ? "Knowledge extracted" : "Archive this project before extracting review knowledge.");
      }
    } catch {
      if (isMountedRef.current) {
        setReviewKnowledgeError("Could not extract review knowledge. Try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsExtractingReviewKnowledge(false);
      }
    }
  }
```

This v0 message logic relies on extraction adding one item when the archive exists. If re-extraction needs a success message later, the implementation can compare item IDs, but this plan only needs first extraction for the UI success path.

- [ ] **Step 4: Render extraction action**

Inside the `selectedLatestReviewReport` card, after the Next actions list, add:

```tsx
                                <button
                                  disabled={isExtractingReviewKnowledge}
                                  onClick={() => void handleExtractReviewKnowledge(selectedLatestReviewReport.id)}
                                  type="button"
                                >
                                  {isExtractingReviewKnowledge ? "Extracting..." : "Extract knowledge"}
                                </button>
                                {reviewKnowledgeMessage ? <p>{reviewKnowledgeMessage}</p> : null}
                                {reviewKnowledgeError ? (
                                  <p className="inline-error" role="alert">
                                    {reviewKnowledgeError}
                                  </p>
                                ) : null}
```

- [ ] **Step 5: Add compact styles**

Modify `apps/desktop/src/renderer/styles.css`:

```css
.review-report-card button {
  justify-self: start;
}
```

If a matching button rule already exists for nested panels, merge with that rule instead of duplicating conflicting styles.

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
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add review knowledge ui"
```

## Task 5: Full Verification

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

- [ ] **Step 3: Run full build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run bundle boundary check**

Run:

```bash
test -f apps/desktop/out/main/main.js && ! grep -R "@robert-station/core\\|@robert-station/local-store" apps/desktop/out/main
```

Expected: exit code 0. This project writes Electron build output to `apps/desktop/out`, not `apps/desktop/dist`.

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
git status --short --branch
```

Expected: `git diff --check` exits 0 and the branch has only committed review-knowledge changes.

- [ ] **Step 7: Complete branch workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present branch completion options and follow the user's selected option.

## Self-Review

Spec coverage:

- Core deterministic generation: Task 1.
- Existing archive requirement: Tasks 2 and 4.
- In-memory and SQLite persistence with existing table: Task 2.
- IPC/preload/loader exposure: Task 3.
- Creation Studio extraction action and Knowledge screen visibility: Task 4.
- Full verification: Task 5.

Type consistency:

- Repository workflow name is `extractReviewKnowledge(reviewReportId: string)` in every layer.
- UI helper name is `extractPersistedReviewKnowledge`.
- Existing `KnowledgeItem` type and `knowledge_items` table are reused without schema changes.

Scope check:

- The plan does not change `KnowledgeItem` schema.
- It does not add search, filters, multiple extracted items per review, editing, or real AI extraction.
