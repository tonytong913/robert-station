# Pipeline Board Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop renderer around a pipeline board that shows each content item's lifecycle stage and next action.

**Architecture:** Keep Electron IPC, core domain entities, and persistence APIs unchanged. Add a pure pipeline model for stage derivation, add pipeline selection/filter state to the existing Zustand store, then introduce the pipeline board and detail panel as the main renderer surface. Old task screens may remain during migration, but the sidebar should route to the new top-level screens.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, Testing Library, CSS custom properties, lucide-react.

---

## File Structure

### New Files

- `apps/desktop/src/renderer/pipeline/pipeline-model.ts`
  - Pure pipeline types and functions. No React imports and no store imports.
- `apps/desktop/src/renderer/pipeline/pipeline-model.test.ts`
  - Unit tests for stage derivation, ordering, filters, and detail view model resolution.
- `apps/desktop/src/renderer/components/pipeline/PipelineScreen.tsx`
  - Main pipeline page. Reads content-loop state, builds columns, and composes filters, board, and detail panel.
- `apps/desktop/src/renderer/components/pipeline/PipelineFilters.tsx`
  - Column/platform/stage/search controls and global actions.
- `apps/desktop/src/renderer/components/pipeline/PipelineBoard.tsx`
  - Accessible horizontal board wrapper.
- `apps/desktop/src/renderer/components/pipeline/PipelineColumn.tsx`
  - One stage column with header, count, cards, and empty state.
- `apps/desktop/src/renderer/components/pipeline/PipelineCard.tsx`
  - Keyboard-selectable card for a topic or project item.
- `apps/desktop/src/renderer/components/pipeline/PipelineDetailPanel.tsx`
  - Selected item status, context sections, and next action area.
- `apps/desktop/src/renderer/components/pipeline/PipelineStageActions.tsx`
  - Stage-specific action buttons and forms.
- `apps/desktop/src/renderer/components/library/SourceLibraryScreen.tsx`
  - Thin wrapper around source-library workflows currently living in `KnowledgeScreen`.
- `apps/desktop/src/renderer/components/library/KnowledgeLibraryScreen.tsx`
  - Durable knowledge list extracted from the current `KnowledgeScreen`.
- `apps/desktop/src/renderer/components/library/ExportScreen.tsx`
  - Export action and last export metadata.

### Modified Files

- `apps/desktop/src/renderer/stores/content-loop-store.ts`
  - Rename top-level screen union, add pipeline filters and selected pipeline item, and keep lifecycle actions on the pipeline after completion.
- `apps/desktop/src/renderer/stores/content-loop-store.test.ts`
  - Update routing expectations and add pipeline selection tests.
- `apps/desktop/src/renderer/i18n/locales/zh.ts`
  - Add new nav, pipeline, source, knowledge, export, empty-state, and action labels.
- `apps/desktop/src/renderer/i18n/locales/en.ts`
  - Add matching English keys.
- `apps/desktop/src/renderer/i18n/index.test.tsx`
  - Add parity smoke checks for new keys.
- `apps/desktop/src/renderer/components/layout/AppShell.tsx`
  - Route to `PipelineScreen`, `SourceLibraryScreen`, `KnowledgeLibraryScreen`, and `ExportScreen`.
- `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
  - Replace six taskflow nav entries with four top-level entries.
- `apps/desktop/src/renderer/components/layout/WorkspaceHeader.tsx`
  - Update hint copy and keep project switcher compatible with pipeline selection.
- `apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx`
  - Mine reusable source/knowledge/export markup, then remove from routing.
- `apps/desktop/src/renderer/App.test.tsx`
  - Update end-to-end renderer tests for pipeline navigation and detail actions.
- `apps/desktop/src/renderer/styles.css`
  - Add board, column, card, detail panel, filters, and narrow viewport styles.

---

## Task 1: Add The Pure Pipeline Model

**Files:**
- Create: `apps/desktop/src/renderer/pipeline/pipeline-model.test.ts`
- Create: `apps/desktop/src/renderer/pipeline/pipeline-model.ts`

- [ ] **Step 1: Write the failing pipeline model tests**

Create `apps/desktop/src/renderer/pipeline/pipeline-model.test.ts`:

```ts
import type { PersistedContentLoopState } from "@robert-station/local-store"
import { InMemoryContentLoopRepository } from "@robert-station/local-store"
import { describe, expect, it } from "vitest"
import { buildPipelineColumns, resolvePipelineDetail } from "./pipeline-model"

async function loadSeed(): Promise<PersistedContentLoopState> {
  return InMemoryContentLoopRepository.createSeeded("workspace_robert-station").loadContentLoop()
}

describe("pipeline model", () => {
  it("places unpromoted candidate topics in the candidate stage", async () => {
    const contentLoop = await loadSeed()

    const columns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "all",
      stage: "all",
      query: ""
    })

    expect(columns.find((column) => column.stage === "candidate")?.items.map((item) => item.title)).toEqual([
      "如何搭建个人 AI 工作站处理日常内容",
      "适合家庭月度决策的简易财务看板",
      "减少亲子摩擦的晚间流程",
      "一周内如何兼顾游泳和力量训练"
    ])
  })

  it("moves projects to the latest lifecycle stage when artifacts exist", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station")
    let contentLoop = await repository.promoteTopic("topic_ai_local-workstation")
    contentLoop = await repository.generatePlatformPackage("project_topic-ai-local-workstation", "xiaohongshu")
    contentLoop = await repository.recordManualPublish({
      platformPackageId: contentLoop.platformPackages[0]!.id,
      publishedAt: "2026-05-21T09:05:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo"
    })

    const columns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "all",
      stage: "all",
      query: ""
    })

    expect(columns.find((column) => column.stage === "published")?.items).toEqual([
      expect.objectContaining({
        title: "如何搭建个人 AI 工作站处理日常内容",
        item: { kind: "project", stage: "published", projectId: "project_topic-ai-local-workstation" }
      })
    ])
    expect(columns.find((column) => column.stage === "drafting")?.items).toEqual([])
  })

  it("filters pipeline cards by stage, column, platform, and text query", async () => {
    const contentLoop = await loadSeed()

    const columns = buildPipelineColumns(contentLoop, {
      columnSlug: "finance",
      platform: "xiaohongshu",
      stage: "candidate",
      query: "财务"
    })

    expect(columns.flatMap((column) => column.items.map((item) => item.title))).toEqual([
      "适合家庭月度决策的简易财务看板"
    ])
  })

  it("returns a detail view model with the next action for a candidate topic", async () => {
    const contentLoop = await loadSeed()

    const detail = resolvePipelineDetail(contentLoop, {
      kind: "topic",
      stage: "candidate",
      topicId: "topic_ai_local-workstation"
    })

    expect(detail).toEqual(
      expect.objectContaining({
        title: "如何搭建个人 AI 工作站处理日常内容",
        stage: "candidate",
        primaryAction: { kind: "promoteTopic", labelKey: "topics.promote" }
      })
    )
    expect(detail?.sections.map((section) => section.titleKey)).toContain("pipeline.detail.topic")
  })
})
```

- [ ] **Step 2: Run the model test to verify it fails**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/pipeline/pipeline-model.test.ts
```

Expected: FAIL because `pipeline-model.ts` does not exist.

- [ ] **Step 3: Implement the pipeline model**

Create `apps/desktop/src/renderer/pipeline/pipeline-model.ts`:

```ts
import { DEFAULT_COLUMNS, type ContentColumnSlug, type Platform } from "@robert-station/core"
import type { PersistedContentLoopState } from "@robert-station/local-store"
import type { TranslationKey } from "../i18n"

export type PipelineStage = "candidate" | "planned" | "drafting" | "readyToPublish" | "published" | "learning"

export type PipelineStageFilter = PipelineStage | "all"
export type PipelineColumnFilter = ContentColumnSlug | "all"
export type PipelinePlatformFilter = Platform | "all"

export type PipelineFilters = {
  columnSlug: PipelineColumnFilter
  platform: PipelinePlatformFilter
  stage: PipelineStageFilter
  query: string
}

export type PipelineItem =
  | { kind: "topic"; stage: "candidate"; topicId: string }
  | { kind: "project"; stage: Exclude<PipelineStage, "candidate">; projectId: string }

export type PipelineAction =
  | { kind: "generateTopics"; labelKey: TranslationKey }
  | { kind: "promoteTopic"; labelKey: TranslationKey }
  | { kind: "generateDraftPackage"; labelKey: TranslationKey }
  | { kind: "generatePlatformPackage"; labelKey: TranslationKey }
  | { kind: "recordManualPublish"; labelKey: TranslationKey }
  | { kind: "importMetricCsv"; labelKey: TranslationKey }
  | { kind: "saveMetricImport"; labelKey: TranslationKey }
  | { kind: "generateReviewReport"; labelKey: TranslationKey }
  | { kind: "extractReviewKnowledge"; labelKey: TranslationKey }
  | { kind: "archiveProject"; labelKey: TranslationKey }
  | { kind: "createContentLoopExport"; labelKey: TranslationKey }

export type PipelineCardViewModel = {
  item: PipelineItem
  title: string
  columnLabel: string
  statusLabelKey: TranslationKey
  primaryMetricLabelKey: TranslationKey
  primaryMetricValue: string
  warningLabelKey: TranslationKey | null
  updatedAt: string
}

export type PipelineColumnViewModel = {
  stage: PipelineStage
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  emptyKey: TranslationKey
  items: PipelineCardViewModel[]
}

export type PipelineDetailSection = {
  titleKey: TranslationKey
  body: string[]
}

export type PipelineDetailViewModel = {
  item: PipelineItem
  title: string
  stage: PipelineStage
  statusLabelKey: TranslationKey
  primaryAction: PipelineAction | null
  secondaryActions: PipelineAction[]
  sections: PipelineDetailSection[]
}

export const pipelineStages: PipelineStage[] = [
  "candidate",
  "planned",
  "drafting",
  "readyToPublish",
  "published",
  "learning"
]

const stageKeys: Record<PipelineStage, { labelKey: TranslationKey; descriptionKey: TranslationKey; emptyKey: TranslationKey }> = {
  candidate: {
    labelKey: "pipeline.stage.candidate",
    descriptionKey: "pipeline.stage.candidateDescription",
    emptyKey: "pipeline.empty.candidate"
  },
  planned: {
    labelKey: "pipeline.stage.planned",
    descriptionKey: "pipeline.stage.plannedDescription",
    emptyKey: "pipeline.empty.planned"
  },
  drafting: {
    labelKey: "pipeline.stage.drafting",
    descriptionKey: "pipeline.stage.draftingDescription",
    emptyKey: "pipeline.empty.drafting"
  },
  readyToPublish: {
    labelKey: "pipeline.stage.readyToPublish",
    descriptionKey: "pipeline.stage.readyToPublishDescription",
    emptyKey: "pipeline.empty.readyToPublish"
  },
  published: {
    labelKey: "pipeline.stage.published",
    descriptionKey: "pipeline.stage.publishedDescription",
    emptyKey: "pipeline.empty.published"
  },
  learning: {
    labelKey: "pipeline.stage.learning",
    descriptionKey: "pipeline.stage.learningDescription",
    emptyKey: "pipeline.empty.learning"
  }
}

export function buildPipelineColumns(
  contentLoop: PersistedContentLoopState | null,
  filters: PipelineFilters
): PipelineColumnViewModel[] {
  const items = contentLoop ? buildCards(contentLoop).filter((item) => matchesFilters(item, filters)) : []

  return pipelineStages.map((stage) => ({
    stage,
    ...stageKeys[stage],
    items: filters.stage !== "all" && filters.stage !== stage ? [] : items.filter((item) => item.item.stage === stage)
  }))
}

export function resolvePipelineDetail(
  contentLoop: PersistedContentLoopState | null,
  item: PipelineItem | null
): PipelineDetailViewModel | null {
  if (!contentLoop || !item) {
    return null
  }

  if (item.kind === "topic") {
    const topic = contentLoop.topics.find((candidate) => candidate.id === item.topicId)
    if (!topic) {
      return null
    }

    return {
      item,
      title: topic.title,
      stage: "candidate",
      statusLabelKey: "pipeline.status.candidate",
      primaryAction: { kind: "promoteTopic", labelKey: "topics.promote" },
      secondaryActions: [{ kind: "generateTopics", labelKey: "topics.generate" }],
      sections: [
        { titleKey: "pipeline.detail.topic", body: [topic.hook, topic.audience] },
        { titleKey: "pipeline.detail.scores", body: [`${topic.score.heat}`, `${topic.score.fit}`, `${topic.score.difficulty}`] }
      ]
    }
  }

  const project = contentLoop.projects.find((candidate) => candidate.id === item.projectId)
  if (!project) {
    return null
  }

  const draft = latestByCreatedAt(contentLoop.drafts.filter((candidate) => candidate.contentProjectId === project.id))
  const platformPackage = latestByCreatedAt(
    contentLoop.platformPackages.filter((candidate) => candidate.contentProjectId === project.id)
  )
  const publishRecord = latestByCreatedAt(
    contentLoop.publishRecords.filter((candidate) => candidate.contentProjectId === project.id)
  )
  const reviewReport = latestByCreatedAt(
    contentLoop.reviewReports.filter((candidate) => candidate.contentProjectId === project.id)
  )
  const archiveRecord = latestByCreatedAt(
    contentLoop.archiveRecords.filter((candidate) => candidate.contentProjectId === project.id)
  )

  return {
    item,
    title: project.title,
    stage: item.stage,
    statusLabelKey: statusKeyForStage(item.stage),
    primaryAction: primaryActionForProjectStage(item.stage, Boolean(reviewReport), Boolean(archiveRecord)),
    secondaryActions: secondaryActionsForProjectStage(item.stage),
    sections: [
      { titleKey: "pipeline.detail.project", body: [project.status] },
      ...(draft ? [{ titleKey: "pipeline.detail.draft" as TranslationKey, body: [draft.title, draft.body] }] : []),
      ...(platformPackage ? [{ titleKey: "pipeline.detail.package" as TranslationKey, body: [platformPackage.title, platformPackage.body] }] : []),
      ...(publishRecord ? [{ titleKey: "pipeline.detail.publish" as TranslationKey, body: [publishRecord.url || "", publishRecord.publishedAt] }] : []),
      ...(reviewReport ? [{ titleKey: "pipeline.detail.review" as TranslationKey, body: [reviewReport.summary] }] : []),
      ...(archiveRecord ? [{ titleKey: "pipeline.detail.archive" as TranslationKey, body: [archiveRecord.summary] }] : [])
    ]
  }
}

function buildCards(contentLoop: PersistedContentLoopState): PipelineCardViewModel[] {
  const promotedTopicIds = new Set(contentLoop.projects.map((project) => project.sourceTopicId).filter(Boolean))
  const topicCards = contentLoop.topics
    .filter((topic) => (topic.status === "candidate" || topic.status === "kept") && !promotedTopicIds.has(topic.id))
    .map((topic) => ({
      item: { kind: "topic" as const, stage: "candidate" as const, topicId: topic.id },
      title: topic.title,
      columnLabel: columnLabel(topic.columnSlug),
      statusLabelKey: "pipeline.status.candidate" as TranslationKey,
      primaryMetricLabelKey: "common.heat" as TranslationKey,
      primaryMetricValue: String(topic.score.heat),
      warningLabelKey: null,
      updatedAt: topic.updatedAt
    }))

  const projectCards = contentLoop.projects.map((project) => {
    const stage = resolveProjectStage(contentLoop, project.id, project.status)

    return {
      item: { kind: "project" as const, stage, projectId: project.id },
      title: project.title,
      columnLabel: columnLabelFromProjectId(project.primaryColumnId),
      statusLabelKey: statusKeyForStage(stage),
      primaryMetricLabelKey: metricKeyForStage(stage),
      primaryMetricValue: metricValueForProject(contentLoop, project.id, stage),
      warningLabelKey: warningKeyForProject(contentLoop, project.id, stage),
      updatedAt: project.updatedAt
    }
  })

  return [...topicCards, ...projectCards].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function resolveProjectStage(
  contentLoop: PersistedContentLoopState,
  projectId: string,
  status: string
): Exclude<PipelineStage, "candidate"> {
  if (
    contentLoop.knowledgeItems.some((item) => item.contentProjectId === projectId) ||
    contentLoop.archiveRecords.some((record) => record.contentProjectId === projectId) ||
    contentLoop.reviewReports.some((report) => report.contentProjectId === projectId)
  ) {
    return "learning"
  }

  if (contentLoop.publishRecords.some((record) => record.contentProjectId === projectId)) {
    return "published"
  }

  if (contentLoop.platformPackages.some((platformPackage) => platformPackage.contentProjectId === projectId)) {
    return "readyToPublish"
  }

  if (status === "topic") {
    return "planned"
  }

  return "drafting"
}

function matchesFilters(card: PipelineCardViewModel, filters: PipelineFilters): boolean {
  if (filters.stage !== "all" && card.item.stage !== filters.stage) {
    return false
  }

  if (filters.query.trim() && !card.title.toLowerCase().includes(filters.query.trim().toLowerCase())) {
    return false
  }

  if (filters.columnSlug !== "all" && card.columnLabel !== columnLabel(filters.columnSlug)) {
    return false
  }

  return filters.platform === "all" || card.item.kind === "topic"
}

function statusKeyForStage(stage: PipelineStage): TranslationKey {
  return `pipeline.status.${stage}` as TranslationKey
}

function metricKeyForStage(stage: PipelineStage): TranslationKey {
  if (stage === "published") {
    return "metrics.views"
  }

  return "pipeline.card.nextStep"
}

function metricValueForProject(contentLoop: PersistedContentLoopState, projectId: string, stage: PipelineStage): string {
  if (stage === "published") {
    const snapshot = latestByCreatedAt(contentLoop.metricSnapshots.filter((candidate) => candidate.contentProjectId === projectId))
    return snapshot ? String(snapshot.views) : "0"
  }

  return "1"
}

function warningKeyForProject(
  contentLoop: PersistedContentLoopState,
  projectId: string,
  stage: PipelineStage
): TranslationKey | null {
  if (stage === "readyToPublish") {
    return "pipeline.warning.needsPublish"
  }

  if (stage === "published" && !contentLoop.metricSnapshots.some((snapshot) => snapshot.contentProjectId === projectId)) {
    return "pipeline.warning.needsMetrics"
  }

  return null
}

function primaryActionForProjectStage(
  stage: Exclude<PipelineStage, "candidate">,
  hasReviewReport: boolean,
  hasArchiveRecord: boolean
): PipelineAction | null {
  if (stage === "planned" || stage === "drafting") {
    return stage === "planned"
      ? { kind: "generateDraftPackage", labelKey: "creation.generateDraft" }
      : { kind: "generatePlatformPackage", labelKey: "creation.generatePlatform" }
  }

  if (stage === "readyToPublish") {
    return { kind: "recordManualPublish", labelKey: "publish.save" }
  }

  if (stage === "published") {
    return { kind: "generateReviewReport", labelKey: "review.generate" }
  }

  if (hasReviewReport && hasArchiveRecord) {
    return { kind: "extractReviewKnowledge", labelKey: "review.extractKnowledge" }
  }

  return null
}

function secondaryActionsForProjectStage(stage: Exclude<PipelineStage, "candidate">): PipelineAction[] {
  if (stage === "published") {
    return [{ kind: "importMetricCsv", labelKey: "metrics.importCsv" }]
  }

  if (stage === "learning") {
    return [{ kind: "createContentLoopExport", labelKey: "knowledge.exportMarkdown" }]
  }

  return [{ kind: "archiveProject", labelKey: "creation.archive" }]
}

function latestByCreatedAt<T extends { createdAt: string }>(items: T[]): T | null {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
}

function columnLabel(slug: ContentColumnSlug): string {
  return DEFAULT_COLUMNS.find((column) => column.slug === slug)?.name ?? slug
}

function columnLabelFromProjectId(primaryColumnId: string): string {
  const slug = primaryColumnId.replace("column_", "") as ContentColumnSlug
  return columnLabel(slug)
}
```

- [ ] **Step 4: Run the model test to verify it passes**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/pipeline/pipeline-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the model**

Run:

```bash
git add apps/desktop/src/renderer/pipeline/pipeline-model.ts apps/desktop/src/renderer/pipeline/pipeline-model.test.ts
git commit -m "feat: add pipeline board model"
```

---

## Task 2: Add Pipeline Store State

**Files:**
- Modify: `apps/desktop/src/renderer/stores/content-loop-store.ts`
- Modify: `apps/desktop/src/renderer/stores/content-loop-store.test.ts`

- [ ] **Step 1: Write failing store expectations**

In `apps/desktop/src/renderer/stores/content-loop-store.test.ts`, update the promotion and platform-package tests:

```ts
it("promotes topics, stays on pipeline, and selects the promoted project card", async () => {
  await useContentLoopStore.getState().load()
  await useContentLoopStore.getState().promoteTopic("topic_ai_local-workstation")

  const state = useContentLoopStore.getState()
  expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation")
  expect(state.screen).toBe("pipeline")
  expect(state.selectedProject?.id).toBe("project_topic-ai-local-workstation")
  expect(state.selectedPipelineItem).toEqual({
    kind: "project",
    stage: "drafting",
    projectId: "project_topic-ai-local-workstation"
  })
})

it("generates xiaohongshu platform packages, stays on pipeline, and selects the ready-to-publish card", async () => {
  await promoteSeedTopic()
  await useContentLoopStore.getState().generatePlatformPackage("project_topic-ai-local-workstation")

  const state = useContentLoopStore.getState()
  expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
    "project_topic-ai-local-workstation",
    "xiaohongshu"
  )
  expect(state.screen).toBe("pipeline")
  expect(state.selectedXiaohongshuPackage?.contentProjectId).toBe("project_topic-ai-local-workstation")
  expect(state.selectedPipelineItem).toEqual({
    kind: "project",
    stage: "readyToPublish",
    projectId: "project_topic-ai-local-workstation"
  })
})
```

Add a reset assertion:

```ts
expect(state.pipelineStageFilter).toBe("all")
expect(state.pipelineColumnFilter).toBe("all")
expect(state.pipelinePlatformFilter).toBe("all")
expect(state.pipelineSearchQuery).toBe("")
expect(state.selectedPipelineItem).toBeNull()
```

- [ ] **Step 2: Run the store tests to verify they fail**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/stores/content-loop-store.test.ts
```

Expected: FAIL because the store still routes to old screens and lacks pipeline fields.

- [ ] **Step 3: Add pipeline state and routing**

In `apps/desktop/src/renderer/stores/content-loop-store.ts`:

```ts
import type {
  PipelineColumnFilter,
  PipelineItem,
  PipelinePlatformFilter,
  PipelineStageFilter
} from "../pipeline/pipeline-model"
```

Change:

```ts
export type TaskScreen = "dashboard" | "topics" | "creation" | "publish" | "review" | "knowledge"
```

to:

```ts
export type AppScreen = "pipeline" | "sources" | "knowledge" | "exports"
```

Replace every `screen: TaskScreen` with `screen: AppScreen`, and every `setScreen: (screen: TaskScreen)` with `setScreen: (screen: AppScreen)`.

Add these state fields to `ContentLoopStoreState`:

```ts
pipelineStageFilter: PipelineStageFilter
pipelineColumnFilter: PipelineColumnFilter
pipelinePlatformFilter: PipelinePlatformFilter
pipelineSearchQuery: string
selectedPipelineItem: PipelineItem | null
selectPipelineItem: (item: PipelineItem) => void
setPipelineStageFilter: (stage: PipelineStageFilter) => void
setPipelineColumnFilter: (columnSlug: PipelineColumnFilter) => void
setPipelinePlatformFilter: (platform: PipelinePlatformFilter) => void
setPipelineSearchQuery: (query: string) => void
```

Update `createInitialState()`:

```ts
screen: "pipeline" as AppScreen,
pipelineStageFilter: "all" as PipelineStageFilter,
pipelineColumnFilter: "all" as PipelineColumnFilter,
pipelinePlatformFilter: "all" as PipelinePlatformFilter,
pipelineSearchQuery: "",
selectedPipelineItem: null,
```

Add store methods:

```ts
selectPipelineItem: (item) => set({ selectedPipelineItem: item }),
setPipelineStageFilter: (pipelineStageFilter) => set({ pipelineStageFilter }),
setPipelineColumnFilter: (pipelineColumnFilter) => set({ pipelineColumnFilter }),
setPipelinePlatformFilter: (pipelinePlatformFilter) => set({ pipelinePlatformFilter }),
setPipelineSearchQuery: (pipelineSearchQuery) => set({ pipelineSearchQuery }),
```

Change lifecycle actions:

```ts
set((state) => withDerived({
  ...state,
  contentLoop,
  screen: "pipeline",
  selectedPipelineItem: {
    kind: "project",
    stage: "drafting",
    projectId: contentLoop.selectedProjectId ?? createEntityId("project", topicId)
  },
  isPromotingTopic: false
}))
```

```ts
set((state) => withDerived({
  ...state,
  contentLoop,
  screen: "pipeline",
  selectedPipelineItem: { kind: "project", stage: "readyToPublish", projectId },
  isGeneratingPlatformPackage: false
}))
```

```ts
set((state) => withDerived({
  ...state,
  contentLoop,
  screen: "pipeline",
  selectedPipelineItem: contentLoop.selectedProjectId
    ? { kind: "project", stage: "published", projectId: contentLoop.selectedProjectId }
    : state.selectedPipelineItem,
  manualPublishDraft: draft,
  isSavingPublishRecord: false,
  isGeneratingReviewReport: false,
  isExtractingReviewKnowledge: false,
  reviewReportError: null,
  reviewKnowledgeError: null,
  reviewKnowledgeResult: null
}))
```

- [ ] **Step 4: Run the store tests to verify they pass**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/stores/content-loop-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit store changes**

Run:

```bash
git add apps/desktop/src/renderer/stores/content-loop-store.ts apps/desktop/src/renderer/stores/content-loop-store.test.ts
git commit -m "feat: add pipeline store state"
```

---

## Task 3: Add Translation Keys

**Files:**
- Modify: `apps/desktop/src/renderer/i18n/locales/zh.ts`
- Modify: `apps/desktop/src/renderer/i18n/locales/en.ts`
- Modify: `apps/desktop/src/renderer/i18n/index.test.tsx`

- [ ] **Step 1: Write failing i18n assertions**

In `apps/desktop/src/renderer/i18n/index.test.tsx`, add:

```ts
it("translates pipeline navigation and empty states", () => {
  expect(translate("zh", "nav.pipeline")).toBe("流水线")
  expect(translate("zh", "nav.sources")).toBe("素材库")
  expect(translate("zh", "nav.exports")).toBe("导出")
  expect(translate("zh", "pipeline.stage.readyToPublish")).toBe("待发布")
  expect(translate("zh", "pipeline.empty.candidate")).toBe("还没有候选选题。先选择栏目并生成一组选题。")
})
```

- [ ] **Step 2: Run the i18n tests to verify they fail**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/i18n/index.test.tsx
```

Expected: FAIL because the new keys do not exist.

- [ ] **Step 3: Add Chinese keys**

Append these keys inside `zh`:

```ts
"nav.pipeline": "流水线",
"nav.sources": "素材库",
"nav.exports": "导出",
"pipeline.title": "流水线",
"pipeline.boardLabel": "内容生产流水线",
"pipeline.noSelection": "选择一张卡片查看下一步动作。",
"pipeline.filters.column": "栏目",
"pipeline.filters.platform": "平台",
"pipeline.filters.stage": "阶段",
"pipeline.filters.search": "搜索标题",
"pipeline.filters.all": "全部",
"pipeline.addSource": "添加素材",
"pipeline.stage.candidate": "候选选题",
"pipeline.stage.planned": "已立项",
"pipeline.stage.drafting": "草稿中",
"pipeline.stage.readyToPublish": "待发布",
"pipeline.stage.published": "已发布",
"pipeline.stage.learning": "复盘沉淀",
"pipeline.stage.candidateDescription": "尚未转为项目的选题。",
"pipeline.stage.plannedDescription": "已经立项，等待进入创作。",
"pipeline.stage.draftingDescription": "正在形成草稿和平台包。",
"pipeline.stage.readyToPublishDescription": "已有平台包，等待记录发布。",
"pipeline.stage.publishedDescription": "已发布，等待指标和复盘。",
"pipeline.stage.learningDescription": "已复盘、归档或沉淀为知识。",
"pipeline.empty.candidate": "还没有候选选题。先选择栏目并生成一组选题。",
"pipeline.empty.planned": "候选选题转为项目后，会出现在这里。",
"pipeline.empty.drafting": "项目进入创作后，在这里生成草稿和平台包。",
"pipeline.empty.readyToPublish": "生成平台包后，内容会进入待发布。",
"pipeline.empty.published": "保存发布记录后，可以导入指标并进入复盘。",
"pipeline.empty.learning": "生成复盘报告后，可以沉淀为知识。",
"pipeline.status.candidate": "候选",
"pipeline.status.planned": "已立项",
"pipeline.status.drafting": "草稿中",
"pipeline.status.readyToPublish": "待发布",
"pipeline.status.published": "已发布",
"pipeline.status.learning": "复盘沉淀",
"pipeline.card.nextStep": "下一步",
"pipeline.warning.needsPublish": "缺发布记录",
"pipeline.warning.needsMetrics": "缺指标",
"pipeline.detail.topic": "选题",
"pipeline.detail.scores": "评分",
"pipeline.detail.project": "项目",
"pipeline.detail.draft": "草稿",
"pipeline.detail.package": "平台包",
"pipeline.detail.publish": "发布记录",
"pipeline.detail.review": "复盘报告",
"pipeline.detail.archive": "归档",
"sources.title": "素材库",
"exports.title": "导出"
```

- [ ] **Step 4: Add matching English keys**

Append matching keys inside `en`:

```ts
"nav.pipeline": "Pipeline",
"nav.sources": "Sources",
"nav.exports": "Exports",
"pipeline.title": "Pipeline",
"pipeline.boardLabel": "Content production pipeline",
"pipeline.noSelection": "Select a card to see the next action.",
"pipeline.filters.column": "Column",
"pipeline.filters.platform": "Platform",
"pipeline.filters.stage": "Stage",
"pipeline.filters.search": "Search titles",
"pipeline.filters.all": "All",
"pipeline.addSource": "Add source",
"pipeline.stage.candidate": "Candidate topics",
"pipeline.stage.planned": "Planned",
"pipeline.stage.drafting": "Drafting",
"pipeline.stage.readyToPublish": "Ready to publish",
"pipeline.stage.published": "Published",
"pipeline.stage.learning": "Learning",
"pipeline.stage.candidateDescription": "Topics not yet promoted into projects.",
"pipeline.stage.plannedDescription": "Projects that are planned and waiting for creation.",
"pipeline.stage.draftingDescription": "Projects forming drafts and platform packages.",
"pipeline.stage.readyToPublishDescription": "Projects with platform packages waiting for publish records.",
"pipeline.stage.publishedDescription": "Published projects waiting for metrics and review.",
"pipeline.stage.learningDescription": "Projects reviewed, archived, or turned into knowledge.",
"pipeline.empty.candidate": "No candidate topics yet. Choose a column and generate topics first.",
"pipeline.empty.planned": "Promoted topics appear here as projects.",
"pipeline.empty.drafting": "Projects in creation appear here while drafts and packages are generated.",
"pipeline.empty.readyToPublish": "Generated platform packages move content here.",
"pipeline.empty.published": "Saved publish records appear here before review.",
"pipeline.empty.learning": "Review reports can be turned into durable knowledge here.",
"pipeline.status.candidate": "Candidate",
"pipeline.status.planned": "Planned",
"pipeline.status.drafting": "Drafting",
"pipeline.status.readyToPublish": "Ready",
"pipeline.status.published": "Published",
"pipeline.status.learning": "Learning",
"pipeline.card.nextStep": "Next step",
"pipeline.warning.needsPublish": "Missing publish record",
"pipeline.warning.needsMetrics": "Missing metrics",
"pipeline.detail.topic": "Topic",
"pipeline.detail.scores": "Scores",
"pipeline.detail.project": "Project",
"pipeline.detail.draft": "Draft",
"pipeline.detail.package": "Platform package",
"pipeline.detail.publish": "Publish record",
"pipeline.detail.review": "Review report",
"pipeline.detail.archive": "Archive",
"sources.title": "Sources",
"exports.title": "Exports"
```

- [ ] **Step 5: Run the i18n tests to verify they pass**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/i18n/index.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit translations**

Run:

```bash
git add apps/desktop/src/renderer/i18n/locales/zh.ts apps/desktop/src/renderer/i18n/locales/en.ts apps/desktop/src/renderer/i18n/index.test.tsx
git commit -m "feat: add pipeline translations"
```

---

## Task 4: Build The Pipeline Board UI

**Files:**
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineCard.tsx`
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineColumn.tsx`
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineBoard.tsx`
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineFilters.tsx`
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineDetailPanel.tsx`
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineStageActions.tsx`
- Create: `apps/desktop/src/renderer/components/pipeline/PipelineScreen.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Add a failing app test for pipeline rendering**

In `apps/desktop/src/renderer/App.test.tsx`, replace the first shell test's navigation expectations:

```ts
expect(await screen.findByRole("heading", { name: "流水线" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "流水线" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "素材库" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument()
expect(screen.queryByRole("button", { name: "选题" })).not.toBeInTheDocument()
expect(screen.getByLabelText("内容生产流水线")).toBeInTheDocument()
expect(screen.getByRole("button", { name: /如何搭建个人 AI 工作站处理日常内容/ })).toBeInTheDocument()
```

- [ ] **Step 2: Run the app test to verify it fails**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: FAIL because the pipeline components and nav are not wired yet.

- [ ] **Step 3: Create `PipelineCard.tsx`**

Create `apps/desktop/src/renderer/components/pipeline/PipelineCard.tsx`:

```tsx
import type { KeyboardEvent, ReactElement } from "react"
import type { PipelineCardViewModel, PipelineItem } from "../../pipeline/pipeline-model"
import { useTranslation } from "../../i18n"
import { StatusBadge } from "../shared/StatusBadge"

type PipelineCardProps = {
  card: PipelineCardViewModel
  isSelected: boolean
  onSelect: (item: PipelineItem) => void
}

export function PipelineCard({ card, isSelected, onSelect }: PipelineCardProps): ReactElement {
  const t = useTranslation()

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(card.item)
    }
  }

  return (
    <button
      aria-current={isSelected ? "true" : undefined}
      className={["pipeline-card", isSelected ? "pipeline-card--active" : ""].filter(Boolean).join(" ")}
      onClick={() => onSelect(card.item)}
      onKeyDown={handleKeyDown}
      type="button"
    >
      <span className="pipeline-card__meta">
        <StatusBadge>{card.columnLabel}</StatusBadge>
        <StatusBadge tone={card.warningLabelKey ? "warning" : "neutral"}>{t(card.statusLabelKey)}</StatusBadge>
      </span>
      <span className="pipeline-card__title">{card.title}</span>
      <span className="pipeline-card__metric">
        <span>{t(card.primaryMetricLabelKey)}</span>
        <strong>{card.primaryMetricValue}</strong>
      </span>
      {card.warningLabelKey ? <span className="pipeline-card__warning">{t(card.warningLabelKey)}</span> : null}
    </button>
  )
}
```

- [ ] **Step 4: Create `PipelineColumn.tsx`**

Create `apps/desktop/src/renderer/components/pipeline/PipelineColumn.tsx`:

```tsx
import type { ReactElement } from "react"
import type { PipelineColumnViewModel, PipelineItem } from "../../pipeline/pipeline-model"
import { useTranslation } from "../../i18n"
import { PipelineCard } from "./PipelineCard"

type PipelineColumnProps = {
  column: PipelineColumnViewModel
  selectedItem: PipelineItem | null
  onSelectItem: (item: PipelineItem) => void
}

export function PipelineColumn({ column, selectedItem, onSelectItem }: PipelineColumnProps): ReactElement {
  const t = useTranslation()

  return (
    <section className="pipeline-column" aria-labelledby={`pipeline-column-${column.stage}`}>
      <header className="pipeline-column__header">
        <div>
          <h2 id={`pipeline-column-${column.stage}`}>{t(column.labelKey)}</h2>
          <p>{t(column.descriptionKey)}</p>
        </div>
        <span className="pipeline-column__count">{column.items.length}</span>
      </header>
      <div className="pipeline-column__cards">
        {column.items.length > 0 ? (
          column.items.map((card) => (
            <PipelineCard
              card={card}
              isSelected={isSamePipelineItem(card.item, selectedItem)}
              key={`${card.item.kind}-${card.item.kind === "topic" ? card.item.topicId : card.item.projectId}`}
              onSelect={onSelectItem}
            />
          ))
        ) : (
          <p className="pipeline-column__empty">{t(column.emptyKey)}</p>
        )}
      </div>
    </section>
  )
}

function isSamePipelineItem(left: PipelineItem, right: PipelineItem | null): boolean {
  if (!right || left.kind !== right.kind) {
    return false
  }

  return left.kind === "topic" ? left.topicId === right.topicId : left.projectId === right.projectId
}
```

- [ ] **Step 5: Create `PipelineBoard.tsx`**

Create `apps/desktop/src/renderer/components/pipeline/PipelineBoard.tsx`:

```tsx
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import type { PipelineColumnViewModel, PipelineItem } from "../../pipeline/pipeline-model"
import { PipelineColumn } from "./PipelineColumn"

type PipelineBoardProps = {
  columns: PipelineColumnViewModel[]
  selectedItem: PipelineItem | null
  onSelectItem: (item: PipelineItem) => void
}

export function PipelineBoard({ columns, selectedItem, onSelectItem }: PipelineBoardProps): ReactElement {
  const t = useTranslation()

  return (
    <div aria-label={t("pipeline.boardLabel")} className="pipeline-board" role="region">
      {columns.map((column) => (
        <PipelineColumn
          column={column}
          key={column.stage}
          onSelectItem={onSelectItem}
          selectedItem={selectedItem}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create filters and detail components**

Create `apps/desktop/src/renderer/components/pipeline/PipelineFilters.tsx`:

```tsx
import { DEFAULT_COLUMNS } from "@robert-station/core"
import type { ChangeEvent, ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { pipelineStages, type PipelineColumnFilter, type PipelinePlatformFilter, type PipelineStageFilter } from "../../pipeline/pipeline-model"
import { Button } from "../shared/Button"

type PipelineFiltersProps = {
  columnFilter: PipelineColumnFilter
  platformFilter: PipelinePlatformFilter
  stageFilter: PipelineStageFilter
  searchQuery: string
  isGeneratingTopics: boolean
  onColumnChange: (value: PipelineColumnFilter) => void
  onPlatformChange: (value: PipelinePlatformFilter) => void
  onStageChange: (value: PipelineStageFilter) => void
  onSearchChange: (value: string) => void
  onGenerateTopics: () => void
}

export function PipelineFilters({
  columnFilter,
  platformFilter,
  stageFilter,
  searchQuery,
  isGeneratingTopics,
  onColumnChange,
  onPlatformChange,
  onStageChange,
  onSearchChange,
  onGenerateTopics
}: PipelineFiltersProps): ReactElement {
  const t = useTranslation()

  function handleColumnChange(event: ChangeEvent<HTMLSelectElement>): void {
    onColumnChange(event.target.value as PipelineColumnFilter)
  }

  return (
    <div className="pipeline-filters">
      <label>
        {t("pipeline.filters.column")}
        <select value={columnFilter} onChange={handleColumnChange}>
          <option value="all">{t("pipeline.filters.all")}</option>
          {DEFAULT_COLUMNS.map((column) => (
            <option key={column.slug} value={column.slug}>{column.name}</option>
          ))}
        </select>
      </label>
      <label>
        {t("pipeline.filters.platform")}
        <select value={platformFilter} onChange={(event) => onPlatformChange(event.target.value as PipelinePlatformFilter)}>
          <option value="all">{t("pipeline.filters.all")}</option>
          <option value="xiaohongshu">小红书</option>
          <option value="douyin">抖音</option>
          <option value="wechat_channels">视频号</option>
          <option value="bilibili">B站</option>
        </select>
      </label>
      <label>
        {t("pipeline.filters.stage")}
        <select value={stageFilter} onChange={(event) => onStageChange(event.target.value as PipelineStageFilter)}>
          <option value="all">{t("pipeline.filters.all")}</option>
          {pipelineStages.map((stage) => (
            <option key={stage} value={stage}>{t(`pipeline.stage.${stage}` as never)}</option>
          ))}
        </select>
      </label>
      <label>
        {t("pipeline.filters.search")}
        <input value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} />
      </label>
      <Button disabled={isGeneratingTopics} onClick={onGenerateTopics}>
        {isGeneratingTopics ? t("topics.generating") : t("topics.generate")}
      </Button>
    </div>
  )
}
```

Create `apps/desktop/src/renderer/components/pipeline/PipelineDetailPanel.tsx`:

```tsx
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import type { PipelineDetailViewModel } from "../../pipeline/pipeline-model"
import { EmptyState } from "../shared/EmptyState"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"
import { PipelineStageActions } from "./PipelineStageActions"

type PipelineDetailPanelProps = {
  detail: PipelineDetailViewModel | null
}

export function PipelineDetailPanel({ detail }: PipelineDetailPanelProps): ReactElement {
  const t = useTranslation()

  if (!detail) {
    return <EmptyState className="pipeline-detail" title={t("pipeline.noSelection")} />
  }

  return (
    <aside className="pipeline-detail" aria-label={detail.title}>
      <Panel>
        <StatusBadge>{t(detail.statusLabelKey)}</StatusBadge>
        <h2>{detail.title}</h2>
        <PipelineStageActions detail={detail} />
      </Panel>
      {detail.sections.map((section) => (
        <Panel key={section.titleKey} title={t(section.titleKey)}>
          {section.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Panel>
      ))}
    </aside>
  )
}
```

- [ ] **Step 7: Create `PipelineStageActions.tsx` and `PipelineScreen.tsx`**

Create `apps/desktop/src/renderer/components/pipeline/PipelineStageActions.tsx`:

```tsx
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import type { PipelineDetailViewModel } from "../../pipeline/pipeline-model"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"

type PipelineStageActionsProps = {
  detail: PipelineDetailViewModel
}

export function PipelineStageActions({ detail }: PipelineStageActionsProps): ReactElement {
  const t = useTranslation()
  const promoteTopic = useContentLoopStore((state) => state.promoteTopic)
  const generateDraftPackage = useContentLoopStore((state) => state.generateDraftPackage)
  const generatePlatformPackage = useContentLoopStore((state) => state.generatePlatformPackage)
  const generateReviewReport = useContentLoopStore((state) => state.generateReviewReport)
  const archiveProject = useContentLoopStore((state) => state.archiveProject)
  const isPromotingTopic = useContentLoopStore((state) => state.isPromotingTopic)
  const isGeneratingDraftPackage = useContentLoopStore((state) => state.isGeneratingDraftPackage)
  const isGeneratingPlatformPackage = useContentLoopStore((state) => state.isGeneratingPlatformPackage)
  const isGeneratingReviewReport = useContentLoopStore((state) => state.isGeneratingReviewReport)
  const isArchivingProject = useContentLoopStore((state) => state.isArchivingProject)

  const projectId = detail.item.kind === "project" ? detail.item.projectId : null

  return (
    <div className="pipeline-actions">
      {detail.primaryAction?.kind === "promoteTopic" && detail.item.kind === "topic" ? (
        <Button disabled={isPromotingTopic} onClick={() => void promoteTopic(detail.item.topicId)}>
          {isPromotingTopic ? t("topics.generating") : t(detail.primaryAction.labelKey)}
        </Button>
      ) : null}
      {detail.primaryAction?.kind === "generateDraftPackage" && projectId ? (
        <Button disabled={isGeneratingDraftPackage} onClick={() => void generateDraftPackage(projectId)}>
          {isGeneratingDraftPackage ? t("creation.generating") : t(detail.primaryAction.labelKey)}
        </Button>
      ) : null}
      {detail.primaryAction?.kind === "generatePlatformPackage" && projectId ? (
        <Button disabled={isGeneratingPlatformPackage} onClick={() => void generatePlatformPackage(projectId)}>
          {isGeneratingPlatformPackage ? t("creation.generating") : t(detail.primaryAction.labelKey)}
        </Button>
      ) : null}
      {detail.primaryAction?.kind === "generateReviewReport" && projectId ? (
        <Button disabled={isGeneratingReviewReport} onClick={() => void generateReviewReportForProject(projectId)}>
          {isGeneratingReviewReport ? t("review.generating") : t(detail.primaryAction.labelKey)}
        </Button>
      ) : null}
      {projectId && detail.secondaryActions.some((action) => action.kind === "archiveProject") ? (
        <Button disabled={isArchivingProject} onClick={() => void archiveProject(projectId)} variant="secondary">
          {isArchivingProject ? t("creation.archiving") : t("creation.archive")}
        </Button>
      ) : null}
    </div>
  )
}

async function generateReviewReportForProject(projectId: string): Promise<void> {
  const state = useContentLoopStore.getState()
  const publishRecord = state.contentLoop?.publishRecords.find((record) => record.contentProjectId === projectId)
  if (publishRecord) {
    await state.generateReviewReport(publishRecord.id)
  }
}
```

Create `apps/desktop/src/renderer/components/pipeline/PipelineScreen.tsx`:

```tsx
import type { ReactElement } from "react"
import { useMemo } from "react"
import { useTranslation } from "../../i18n"
import { buildPipelineColumns, resolvePipelineDetail } from "../../pipeline/pipeline-model"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { PipelineBoard } from "./PipelineBoard"
import { PipelineDetailPanel } from "./PipelineDetailPanel"
import { PipelineFilters } from "./PipelineFilters"

export function PipelineScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const selectedPipelineItem = useContentLoopStore((state) => state.selectedPipelineItem)
  const pipelineStageFilter = useContentLoopStore((state) => state.pipelineStageFilter)
  const pipelineColumnFilter = useContentLoopStore((state) => state.pipelineColumnFilter)
  const pipelinePlatformFilter = useContentLoopStore((state) => state.pipelinePlatformFilter)
  const pipelineSearchQuery = useContentLoopStore((state) => state.pipelineSearchQuery)
  const isGeneratingTopics = useContentLoopStore((state) => state.isGeneratingTopics)
  const selectPipelineItem = useContentLoopStore((state) => state.selectPipelineItem)
  const setPipelineStageFilter = useContentLoopStore((state) => state.setPipelineStageFilter)
  const setPipelineColumnFilter = useContentLoopStore((state) => state.setPipelineColumnFilter)
  const setPipelinePlatformFilter = useContentLoopStore((state) => state.setPipelinePlatformFilter)
  const setPipelineSearchQuery = useContentLoopStore((state) => state.setPipelineSearchQuery)
  const generateTopics = useContentLoopStore((state) => state.generateTopics)
  const t = useTranslation()

  const filters = {
    columnSlug: pipelineColumnFilter,
    platform: pipelinePlatformFilter,
    stage: pipelineStageFilter,
    query: pipelineSearchQuery
  }
  const columns = useMemo(() => buildPipelineColumns(contentLoop, filters), [
    contentLoop,
    pipelineColumnFilter,
    pipelinePlatformFilter,
    pipelineStageFilter,
    pipelineSearchQuery
  ])
  const detail = useMemo(() => resolvePipelineDetail(contentLoop, selectedPipelineItem), [contentLoop, selectedPipelineItem])

  return (
    <section className="pipeline-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        <h1>{t("pipeline.title")}</h1>
      </div>
      <PipelineFilters
        columnFilter={pipelineColumnFilter}
        isGeneratingTopics={isGeneratingTopics}
        onColumnChange={setPipelineColumnFilter}
        onGenerateTopics={() => void generateTopics()}
        onPlatformChange={setPipelinePlatformFilter}
        onSearchChange={setPipelineSearchQuery}
        onStageChange={setPipelineStageFilter}
        platformFilter={pipelinePlatformFilter}
        searchQuery={pipelineSearchQuery}
        stageFilter={pipelineStageFilter}
      />
      <div className="pipeline-workbench">
        <PipelineBoard columns={columns} onSelectItem={selectPipelineItem} selectedItem={selectedPipelineItem} />
        <PipelineDetailPanel detail={detail} />
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Run app test to verify pipeline components compile**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: still FAIL until navigation is switched in Task 5, but TypeScript component import errors should be resolved.

- [ ] **Step 9: Commit pipeline UI components**

Run:

```bash
git add apps/desktop/src/renderer/components/pipeline
git commit -m "feat: add pipeline board components"
```

Expected: only the new pipeline components are committed. Keep the failing `App.test.tsx` navigation expectations unstaged until Task 5 switches routing and makes them pass.

---

## Task 5: Switch Top-Level Navigation

**Files:**
- Modify: `apps/desktop/src/renderer/components/layout/AppShell.tsx`
- Modify: `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
- Modify: `apps/desktop/src/renderer/components/layout/WorkspaceHeader.tsx`
- Create: `apps/desktop/src/renderer/components/library/SourceLibraryScreen.tsx`
- Create: `apps/desktop/src/renderer/components/library/KnowledgeLibraryScreen.tsx`
- Create: `apps/desktop/src/renderer/components/library/ExportScreen.tsx`

- [ ] **Step 1: Create auxiliary screens**

Create `apps/desktop/src/renderer/components/library/SourceLibraryScreen.tsx`:

```tsx
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { KnowledgeScreen } from "../screens/KnowledgeScreen"

export function SourceLibraryScreen(): ReactElement {
  const t = useTranslation()

  return (
    <section className="source-library-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        <h1>{t("sources.title")}</h1>
      </div>
      <KnowledgeScreen />
    </section>
  )
}
```

Create `apps/desktop/src/renderer/components/library/KnowledgeLibraryScreen.tsx`:

```tsx
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { EmptyState } from "../shared/EmptyState"
import { Panel } from "../shared/Panel"

export function KnowledgeLibraryScreen(): ReactElement {
  const knowledgeItems = useContentLoopStore((state) => state.contentLoop?.knowledgeItems ?? [])
  const t = useTranslation()

  return (
    <section className="knowledge-library-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        <h1>{t("knowledge.title")}</h1>
      </div>
      {knowledgeItems.length > 0 ? (
        <div className="knowledge-list">
          {knowledgeItems.map((item) => (
            <Panel className="knowledge-card" key={item.id}>
              <h2>{item.title}</h2>
              <p>{item.lesson}</p>
              <p>{item.evidence}</p>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState title={t("knowledge.empty")} />
      )}
    </section>
  )
}
```

Create `apps/desktop/src/renderer/components/library/ExportScreen.tsx`:

```tsx
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { Panel } from "../shared/Panel"

export function ExportScreen(): ReactElement {
  const lastExportFile = useContentLoopStore((state) => state.lastExportFile)
  const isCreatingExport = useContentLoopStore((state) => state.isCreatingExport)
  const createContentLoopExport = useContentLoopStore((state) => state.createContentLoopExport)
  const t = useTranslation()

  return (
    <section className="export-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        <h1>{t("exports.title")}</h1>
      </div>
      <Panel>
        <Button disabled={isCreatingExport} onClick={() => void createContentLoopExport("markdown")}>
          {isCreatingExport ? t("knowledge.exporting") : t("knowledge.exportMarkdown")}
        </Button>
        {lastExportFile ? <p>{t("knowledge.lastExport", { fileName: lastExportFile.fileName })}</p> : null}
      </Panel>
    </section>
  )
}
```

- [ ] **Step 2: Update `Sidebar.tsx`**

Replace nav items with:

```ts
import { Boxes, Database, Library, Download } from "lucide-react"
import type { AppScreen } from "../../stores/content-loop-store"

type NavItem = {
  screen: AppScreen
  labelKey: TranslationKey
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>
}

const navItems: NavItem[] = [
  { screen: "pipeline", labelKey: "nav.pipeline", Icon: Boxes },
  { screen: "sources", labelKey: "nav.sources", Icon: Database },
  { screen: "knowledge", labelKey: "nav.knowledge", Icon: Library },
  { screen: "exports", labelKey: "nav.exports", Icon: Download }
]
```

- [ ] **Step 3: Update `AppShell.tsx`**

Replace screen routing with:

```tsx
import { ExportScreen } from "../library/ExportScreen"
import { KnowledgeLibraryScreen } from "../library/KnowledgeLibraryScreen"
import { SourceLibraryScreen } from "../library/SourceLibraryScreen"
import { PipelineScreen } from "../pipeline/PipelineScreen"

export function AppShell(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen)

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <WorkspaceHeader />
        <div className="workspace-content screen-stack">
          {screen === "pipeline" ? <PipelineScreen /> : null}
          {screen === "sources" ? <SourceLibraryScreen /> : null}
          {screen === "knowledge" ? <KnowledgeLibraryScreen /> : null}
          {screen === "exports" ? <ExportScreen /> : null}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Update `WorkspaceHeader.tsx` hint copy**

Change no-project hint translation usage only after Task 3 has new copy. Keep the selected project dropdown unchanged.

- [ ] **Step 5: Run app tests**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: the first shell test passes. Tests that still click old `选题 / 创作 / 发布 / 复盘` labels fail and are updated in Task 6.

- [ ] **Step 6: Commit navigation switch**

Run:

```bash
git add apps/desktop/src/renderer/components/layout/AppShell.tsx apps/desktop/src/renderer/components/layout/Sidebar.tsx apps/desktop/src/renderer/components/layout/WorkspaceHeader.tsx apps/desktop/src/renderer/components/library apps/desktop/src/renderer/App.test.tsx
git commit -m "feat: switch renderer to pipeline navigation"
```

---

## Task 6: Port Key User Flows To Pipeline Tests

**Files:**
- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/components/pipeline/PipelineStageActions.tsx`

- [ ] **Step 1: Replace old promote flow test**

In `App.test.tsx`, replace the old "promotes a topic through persistence API and shows its draft" test with:

```tsx
it("promotes a topic from the pipeline and keeps the promoted project selected", async () => {
  render(<App />)

  await screen.findByRole("heading", { name: "流水线" })
  fireEvent.click(screen.getByRole("button", { name: /如何搭建个人 AI 工作站处理日常内容/ }))
  fireEvent.click(screen.getByRole("button", { name: "转为项目" }))

  await waitFor(() => {
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation")
  })
  expect(screen.getByRole("heading", { name: "流水线" })).toBeInTheDocument()
  expect(screen.getByText("草稿 v1")).toBeInTheDocument()
  expect(screen.getByText("简要钩子： 把分散的 AI 工具变成可复用的每日工作流。")).toBeInTheDocument()
})
```

- [ ] **Step 2: Add pipeline platform package test**

Add:

```tsx
it("generates a Xiaohongshu package from the pipeline detail panel", async () => {
  render(<App />)

  await promoteFirstPipelineTopicToProject()
  fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }))

  expect(await screen.findByText("小红书包")).toBeInTheDocument()
  expect(screen.getByText("标题")).toBeInTheDocument()
  expect(screen.getByText("正文")).toBeInTheDocument()
  expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
    "project_topic-ai-local-workstation",
    "xiaohongshu"
  )
})
```

Add helper:

```tsx
async function promoteFirstPipelineTopicToProject(): Promise<void> {
  await screen.findByRole("heading", { name: "流水线" })
  fireEvent.click(screen.getByRole("button", { name: /如何搭建个人 AI 工作站处理日常内容/ }))
  fireEvent.click(screen.getByRole("button", { name: "转为项目" }))
  await screen.findByText("草稿 v1")
}
```

- [ ] **Step 3: Implement missing detail sections for tests**

If the promote test cannot find `草稿 v1`, update `resolvePipelineDetail()` in `pipeline-model.ts` to include the latest draft section title line:

```ts
...(draft
  ? [
      {
        titleKey: "pipeline.detail.draft" as TranslationKey,
        body: [`草稿 v${draft.version}`, draft.title, draft.body]
      }
    ]
  : []),
```

- [ ] **Step 4: Run focused app tests**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: PASS for the shell, promote, and package pipeline tests. Remaining old task-screen tests should be updated or removed once their behavior is represented through pipeline tests.

- [ ] **Step 5: Commit flow tests**

Run:

```bash
git add apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/components/pipeline/PipelineStageActions.tsx apps/desktop/src/renderer/pipeline/pipeline-model.ts
git commit -m "test: cover pipeline lifecycle flows"
```

---

## Task 7: Add Pipeline Styling

**Files:**
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Add board and card styles**

Append to `apps/desktop/src/renderer/styles.css`:

```css
.pipeline-screen {
  min-width: 0;
}

.pipeline-filters {
  align-items: end;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(140px, 1fr)) auto;
  margin-bottom: 16px;
}

.pipeline-filters label {
  color: var(--color-text-secondary);
  display: grid;
  font-size: 0.82rem;
  font-weight: 750;
  gap: 6px;
}

.pipeline-filters input,
.pipeline-filters select {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  color: var(--color-text-primary);
  min-height: 38px;
  min-width: 0;
  padding: 8px 10px;
}

.pipeline-workbench {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  min-width: 0;
}

.pipeline-board {
  display: grid;
  gap: 12px;
  grid-auto-columns: minmax(260px, 280px);
  grid-auto-flow: column;
  overflow-x: auto;
  padding-bottom: 8px;
}

.pipeline-column {
  background: var(--color-surface-low);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  grid-template-rows: auto minmax(0, 1fr);
  max-height: calc(100dvh - 260px);
  min-height: 360px;
  padding: 10px;
}

.pipeline-column__header {
  align-items: start;
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.pipeline-column__header h2 {
  font-size: 0.98rem;
  line-height: 1.25;
  margin: 0;
}

.pipeline-column__header p,
.pipeline-column__empty {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  margin: 4px 0 0;
}

.pipeline-column__count {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
  min-width: 28px;
  padding: 4px 8px;
  text-align: center;
}

.pipeline-column__cards,
.pipeline-detail {
  display: grid;
  gap: 10px;
}

.pipeline-card {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  box-shadow: var(--shadow-raised);
  color: var(--color-text-primary);
  display: grid;
  gap: 10px;
  padding: 12px;
  text-align: left;
  width: 100%;
}

.pipeline-card:hover,
.pipeline-card:focus-visible,
.pipeline-card--active {
  border-color: rgba(143, 72, 47, 0.58);
  outline: 3px solid rgba(255, 219, 208, 0.72);
}

.pipeline-card__meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pipeline-card__title {
  display: -webkit-box;
  font-weight: 850;
  line-height: 1.35;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.pipeline-card__metric {
  align-items: center;
  color: var(--color-text-secondary);
  display: flex;
  font-size: 0.82rem;
  justify-content: space-between;
}

.pipeline-card__metric strong {
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.pipeline-card__warning {
  color: var(--color-brand);
  font-size: 0.82rem;
  font-weight: 800;
}

.pipeline-detail {
  position: sticky;
  top: 16px;
}

.pipeline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 980px) {
  .pipeline-filters,
  .pipeline-workbench {
    grid-template-columns: 1fr;
  }

  .pipeline-detail {
    position: static;
  }
}
```

- [ ] **Step 2: Run typecheck for CSS-adjacent compile safety**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit styling**

Run:

```bash
git add apps/desktop/src/renderer/styles.css
git commit -m "style: add pipeline board layout"
```

---

## Task 8: Final Verification And Cleanup

**Files:**
- Modify as needed from prior tasks.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS. If failures reference old nav labels (`选题`, `创作`, `发布`, `复盘`), update those tests to interact with pipeline cards and detail actions instead.

- [ ] **Step 2: Run strict typechecking**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only files changed by this implementation are present. Existing unrelated uncommitted files from before this work may still appear and must not be reverted.

- [ ] **Step 4: Commit final cleanup if any changes remain**

Run:

```bash
git add apps/desktop/src/renderer
git commit -m "refactor: make pipeline board the main workflow"
```

Expected: commit succeeds if there are remaining renderer changes. If no changes remain, skip this commit.

---

## Execution Notes

- Do not edit `apps/desktop/electron.vite.config.ts`, `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/main-paths.ts`, `apps/desktop/vitest.config.ts`, or `packages/local-store/src/sqlite-content-loop-repository.*` unless a test failure proves they are directly required. These files already had unrelated uncommitted changes before this plan.
- Read `apps/desktop/src/renderer/test-setup.ts` before editing it because it also had pre-existing uncommitted changes.
- Keep all new TypeScript files using two-space indentation, double quotes, explicit imports, and no semicolons.
- Avoid adding drag-and-drop, batch operations, or new domain states in this implementation slice.
