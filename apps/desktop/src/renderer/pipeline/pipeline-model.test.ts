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
