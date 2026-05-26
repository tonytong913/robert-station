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
import { describe, expect, it } from "vitest"
import type { PipelineAction, PipelineContentLoopState, PipelineStage } from "./pipeline-model"
import { buildPipelineColumns, resolvePipelineDetail } from "./pipeline-model"

const timestamp = "2026-05-21T09:05:00.000Z"
const seedTimestamp = "2026-05-19T00:00:00.000Z"

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

function projectWithoutSourceTopic(overrides: Partial<ContentProject> = {}): ContentProject {
  return {
    id: "project_demo",
    workspaceId: "workspace_robert-station",
    primaryColumnId: "column_ai",
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

function seedContentLoop(overrides: Partial<PipelineContentLoopState> = {}): PipelineContentLoopState {
  return emptyContentLoop({
    topics: [
      topic({
        id: "topic_ai_local-workstation",
        columnSlug: "ai",
        title: "如何搭建个人 AI 工作站处理日常内容",
        hook: "把分散的 AI 工具变成可复用的每日工作流。",
        audience: "希望获得实用 AI 提效的创作者。",
        targetPlatforms: ["xiaohongshu", "bilibili"],
        score: { heat: 86, fit: 92, difficulty: 48, personaConsistency: 90 },
        createdAt: seedTimestamp,
        updatedAt: seedTimestamp
      }),
      topic({
        id: "topic_finance-family-dashboard",
        columnSlug: "finance",
        title: "适合家庭月度决策的简易财务看板",
        hook: "轻量复盘习惯比复杂表格更有效。",
        audience: "希望更从容做月度财务决策的家庭。",
        targetPlatforms: ["xiaohongshu"],
        score: { heat: 72, fit: 84, difficulty: 42, personaConsistency: 82 },
        createdAt: seedTimestamp,
        updatedAt: seedTimestamp
      }),
      topic({
        id: "topic_parenting-evening-routine",
        columnSlug: "parenting",
        title: "减少亲子摩擦的晚间流程",
        hook: "设计好前一晚，让第二天早晨更轻松。",
        audience: "想建立实用日常流程的家长。",
        targetPlatforms: ["xiaohongshu", "wechat_channels"],
        score: { heat: 78, fit: 80, difficulty: 35, personaConsistency: 78 },
        createdAt: seedTimestamp,
        updatedAt: seedTimestamp
      }),
      topic({
        id: "topic_fitness-swim-gym-week",
        columnSlug: "fitness",
        title: "一周内如何兼顾游泳和力量训练",
        hook: "在不过度计划的情况下平衡有氧、力量和恢复。",
        audience: "正在建立可持续健身习惯的忙碌成年人。",
        targetPlatforms: ["xiaohongshu", "douyin"],
        score: { heat: 68, fit: 76, difficulty: 38, personaConsistency: 80 },
        createdAt: seedTimestamp,
        updatedAt: seedTimestamp
      })
    ],
    ...overrides
  })
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
  it("places unpromoted candidate topics in the candidate stage", () => {
    const contentLoop = seedContentLoop()

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

  it("returns column and card view models with planned public fields", () => {
    const contentLoop = seedContentLoop()

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

  it("moves projects to the latest lifecycle stage when artifacts exist", () => {
    const contentLoop = seedContentLoop({
      topics: [
        topic({
          id: "topic_ai_local-workstation",
          title: "如何搭建个人 AI 工作站处理日常内容",
          status: "promoted",
          targetPlatforms: ["xiaohongshu", "bilibili"]
        })
      ],
      projects: [
        project({
          id: "project_topic-ai-local-workstation",
          sourceTopicId: "topic_ai_local-workstation",
          title: "如何搭建个人 AI 工作站处理日常内容"
        })
      ],
      drafts: [draft({ contentProjectId: "project_topic-ai-local-workstation" })],
      platformPackages: [
        platformPackage({
          id: "package_topic-ai-local-workstation",
          contentProjectId: "project_topic-ai-local-workstation"
        })
      ],
      publishRecords: [
        publishRecord({
          contentProjectId: "project_topic-ai-local-workstation",
          platformPackageId: "package_topic-ai-local-workstation"
        })
      ]
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

  it("filters pipeline cards by stage, column, platform, and text query", () => {
    const contentLoop = seedContentLoop()

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

  it("returns a detail view model with the next action for a candidate topic", () => {
    const contentLoop = seedContentLoop()

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

  it("returns null detail when no pipeline item is selected", () => {
    const contentLoop = seedContentLoop()

    expect(resolvePipelineDetail(contentLoop, null)).toBeNull()
  })

  it("uses a safe fallback label for malformed project column ids", () => {
    const contentLoop = emptyContentLoop({
      projects: [projectWithoutSourceTopic({ primaryColumnId: "malformed_future-column" })]
    })

    const columns = buildPipelineColumns(contentLoop, {
      columnSlug: "all",
      platform: "all",
      stage: "all",
      query: ""
    })

    expect(columns.flatMap((column) => column.items.map((item) => item.columnLabel))).toEqual([
      "未知栏目"
    ])
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
