import type {
  ArchiveRecord,
  ContentProject,
  DraftVersion,
  KnowledgeItem,
  PlatformPackage,
  PublishRecord,
  ReviewReport,
  Topic
} from "@robert-station/core"
import type { PersistedContentLoopState } from "@robert-station/local-store"
import { InMemoryContentLoopRepository } from "@robert-station/local-store"
import { describe, expect, it } from "vitest"
import type { PipelineAction, PipelineContentLoopState, PipelineStage } from "./pipeline-model"
import { buildPipelineColumns, resolvePipelineDetail } from "./pipeline-model"

const timestamp = "2026-05-21T09:05:00.000Z"

async function loadSeed(): Promise<PersistedContentLoopState> {
  return InMemoryContentLoopRepository.createSeeded("workspace_robert-station").loadContentLoop()
}

function emptyContentLoop(overrides: Partial<PipelineContentLoopState> = {}): PipelineContentLoopState {
  return {
    topics: [],
    projects: [],
    drafts: [],
    platformPackages: [],
    publishRecords: [],
    metricSnapshots: [],
    reviewReports: [],
    archiveRecords: [],
    knowledgeItems: [],
    ...overrides
  }
}

function topic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: "topic_demo",
    workspaceId: "workspace_robert-station",
    columnSlug: "ai",
    title: "Demo topic",
    hook: "Demo hook",
    audience: "Demo audience",
    targetPlatforms: ["xiaohongshu"],
    status: "candidate",
    score: { heat: 80, fit: 90, difficulty: 30, personaConsistency: 85 },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function project(overrides: Partial<ContentProject> = {}): ContentProject {
  return {
    id: "project_demo",
    workspaceId: "workspace_robert-station",
    primaryColumnId: "column_ai",
    sourceTopicId: "topic_demo",
    title: "Demo project",
    status: "drafting",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function draft(overrides: Partial<DraftVersion> = {}): DraftVersion {
  return {
    id: "draft_demo",
    workspaceId: "workspace_robert-station",
    contentProjectId: "project_demo",
    version: 1,
    title: "Demo draft",
    body: "Draft body",
    createdBy: "assistant",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function platformPackage(overrides: Partial<PlatformPackage> = {}): PlatformPackage {
  return {
    id: "package_demo",
    workspaceId: "workspace_robert-station",
    contentProjectId: "project_demo",
    draftVersionId: "draft_demo",
    platform: "xiaohongshu",
    title: "Demo package",
    body: "Package body",
    tags: ["#demo"],
    coverText: "Cover text",
    requiredAssets: [],
    checks: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function publishRecord(overrides: Partial<PublishRecord> = {}): PublishRecord {
  return {
    id: "publish_demo",
    workspaceId: "workspace_robert-station",
    contentProjectId: "project_demo",
    platformPackageId: "package_demo",
    platform: "xiaohongshu",
    status: "published",
    publishedAt: timestamp,
    url: "https://www.xiaohongshu.com/explore/demo",
    note: "Published manually.",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function reviewReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    id: "review_demo",
    workspaceId: "workspace_robert-station",
    contentProjectId: "project_demo",
    publishRecordId: "publish_demo",
    version: 1,
    summary: "Review summary",
    highlights: [],
    underperformingSignals: [],
    likelyCauses: [],
    nextActions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function archiveRecord(overrides: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return {
    id: "archive_demo",
    workspaceId: "workspace_robert-station",
    contentProjectId: "project_demo",
    draftVersionId: "draft_demo",
    platformPackageId: "package_demo",
    title: "Demo archive",
    summary: "Archive summary",
    sourceCount: 1,
    packageCount: 1,
    status: "archived",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function knowledgeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: "knowledge_demo",
    workspaceId: "workspace_robert-station",
    archiveRecordId: "archive_demo",
    contentProjectId: "project_demo",
    columnSlug: "ai",
    title: "Demo knowledge",
    lesson: "Lesson learned",
    evidence: "Evidence",
    tags: ["demo"],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function projectStage(contentLoop: PipelineContentLoopState): PipelineStage | undefined {
  return buildPipelineColumns(contentLoop, {
    columnSlug: "all",
    platform: "all",
    stage: "all",
    query: ""
  }).flatMap((column) => column.items).find((item) => item.item.kind === "project")?.stage
}

const plannedActions = [
  { kind: "generateTopics", labelKey: "pipeline.actions.generateTopics" },
  { kind: "promoteTopic", labelKey: "topics.promote" },
  { kind: "generateDraftPackage", labelKey: "pipeline.actions.generateDraftPackage" },
  { kind: "generatePlatformPackage", labelKey: "pipeline.actions.generatePlatformPackage" },
  { kind: "recordManualPublish", labelKey: "pipeline.actions.recordManualPublish" },
  { kind: "importMetricCsv", labelKey: "pipeline.actions.importMetricCsv" },
  { kind: "saveMetricImport", labelKey: "pipeline.actions.saveMetricImport" },
  { kind: "generateReviewReport", labelKey: "pipeline.actions.generateReviewReport" },
  { kind: "extractReviewKnowledge", labelKey: "pipeline.actions.extractReviewKnowledge" },
  { kind: "archiveProject", labelKey: "pipeline.actions.archiveProject" },
  { kind: "createContentLoopExport", labelKey: "pipeline.actions.createContentLoopExport" }
] satisfies PipelineAction[]

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

  it("exposes the planned pipeline action kinds", () => {
    expect(plannedActions.map((action) => action.kind)).toEqual([
      "generateTopics",
      "promoteTopic",
      "generateDraftPackage",
      "generatePlatformPackage",
      "recordManualPublish",
      "importMetricCsv",
      "saveMetricImport",
      "generateReviewReport",
      "extractReviewKnowledge",
      "archiveProject",
      "createContentLoopExport"
    ])
  })

  it("returns column and card view models with planned public fields", async () => {
    const contentLoop = await loadSeed()

    const columns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "all",
      stage: "candidate",
      query: ""
    })
    const card = columns[0]?.items[0]

    expect(columns[0]).toEqual(
      expect.objectContaining({
        stage: "candidate",
        labelKey: "pipeline.stage.candidate.label",
        descriptionKey: "pipeline.stage.candidate.description",
        emptyKey: "pipeline.stage.candidate.empty"
      })
    )
    expect(card).toEqual(
      expect.objectContaining({
        columnLabel: "AI",
        statusLabelKey: "pipeline.status.candidate",
        primaryMetricLabelKey: "pipeline.metric.heat",
        primaryMetricValue: "86",
        warningLabelKey: null,
        updatedAt: "2026-05-19T00:00:00.000Z"
      })
    )
  })

  it("places kept topics in candidate and excludes promoted topics", () => {
    const contentLoop = emptyContentLoop({
      topics: [
        topic({ id: "topic_candidate", title: "Candidate topic", status: "candidate" }),
        topic({ id: "topic_kept", title: "Kept topic", status: "kept" }),
        topic({ id: "topic_promoted", title: "Promoted topic", status: "promoted" })
      ],
      projects: [project({ id: "project_promoted", sourceTopicId: "topic_promoted" })]
    })

    const columns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "all",
      stage: "candidate",
      query: ""
    })

    expect(columns.flatMap((column) => column.items.map((item) => item.title))).toEqual([
      "Candidate topic",
      "Kept topic"
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

  it.each([
    {
      name: "knowledgeItems",
      expectedStage: "learning",
      overrides: { knowledgeItems: [knowledgeItem()] }
    },
    {
      name: "archiveRecords",
      expectedStage: "learning",
      overrides: { archiveRecords: [archiveRecord()] }
    },
    {
      name: "reviewReports",
      expectedStage: "learning",
      overrides: { reviewReports: [reviewReport()] }
    },
    {
      name: "archived status",
      expectedStage: "learning",
      project: project({ status: "archived" }),
      overrides: {}
    },
    {
      name: "platformPackage without publishRecord",
      expectedStage: "readyToPublish",
      overrides: { platformPackages: [platformPackage()] }
    },
    {
      name: "topic status",
      expectedStage: "planned",
      project: project({ status: "topic" }),
      overrides: {}
    },
    {
      name: "fallback",
      expectedStage: "drafting",
      overrides: {}
    }
  ] satisfies Array<{
    name: string
    expectedStage: PipelineStage
    project?: ContentProject
    overrides: Partial<PipelineContentLoopState>
  }>)("resolves $name projects to $expectedStage", ({ expectedStage, overrides, project: projectOverride }) => {
    const contentLoop = emptyContentLoop({
      topics: [topic()],
      projects: [projectOverride ?? project()],
      ...overrides
    })

    expect(projectStage(contentLoop)).toBe(expectedStage)
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

  it("filters project cards by platform package and publish record platforms", () => {
    const contentLoop = emptyContentLoop({
      topics: [topic()],
      projects: [project({ title: "Packaged project" })],
      platformPackages: [platformPackage({ platform: "douyin" })],
      publishRecords: [publishRecord({ platform: "douyin" })]
    })

    const matchingColumns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "douyin",
      stage: "all",
      query: ""
    })
    const nonMatchingColumns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "xiaohongshu",
      stage: "all",
      query: ""
    })

    expect(matchingColumns.flatMap((column) => column.items.map((item) => item.title))).toEqual([
      "Packaged project"
    ])
    expect(nonMatchingColumns.flatMap((column) => column.items.map((item) => item.title))).toEqual([])
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
        item: { kind: "topic", stage: "candidate", topicId: "topic_ai_local-workstation" },
        title: "如何搭建个人 AI 工作站处理日常内容",
        stage: "candidate",
        statusLabelKey: "pipeline.status.candidate",
        primaryAction: { kind: "promoteTopic", labelKey: "topics.promote" }
      })
    )
    expect(detail?.secondaryActions).toEqual([
      { kind: "generateTopics", labelKey: "pipeline.actions.generateTopics" }
    ])
    expect(detail?.sections.map((section) => section.titleKey)).toContain("pipeline.detail.topic")
    expect(detail?.sections.map((section) => section.titleKey)).toContain("pipeline.detail.scores")
    expect(detail?.sections.find((section) => section.titleKey === "pipeline.detail.scores")?.items).toEqual([
      { labelKey: "pipeline.detail.score.heat", value: "86" },
      { labelKey: "pipeline.detail.score.fit", value: "92" },
      { labelKey: "pipeline.detail.score.difficulty", value: "48" },
      { labelKey: "pipeline.detail.score.personaConsistency", value: "90" }
    ])
  })

  it("returns null detail when no pipeline item is selected", async () => {
    const contentLoop = await loadSeed()

    expect(resolvePipelineDetail(contentLoop, null)).toBeNull()
  })

  it("returns project detail sections for draft, package, publish, review, and archive artifacts", () => {
    const contentLoop = emptyContentLoop({
      topics: [topic()],
      projects: [project()],
      drafts: [draft()],
      platformPackages: [platformPackage()],
      publishRecords: [publishRecord()],
      reviewReports: [reviewReport()],
      archiveRecords: [archiveRecord()]
    })

    const detail = resolvePipelineDetail(contentLoop, {
      kind: "project",
      stage: "learning",
      projectId: "project_demo"
    })

    expect(detail?.sections.map((section) => section.titleKey)).toEqual([
      "pipeline.detail.project",
      "pipeline.detail.draft",
      "pipeline.detail.package",
      "pipeline.detail.publish",
      "pipeline.detail.review",
      "pipeline.detail.archive"
    ])
  })
})
