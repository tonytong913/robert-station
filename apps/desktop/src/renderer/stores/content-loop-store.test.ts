import type { PersistedContentLoopState } from "@robert-station/local-store"
import { describe, expect, it, vi } from "vitest"
import { formatDatetimeLocalValue, toDatetimeLocalValue, toPublishTimestamp } from "../datetime"
import { useContentLoopStore } from "./content-loop-store"

describe("datetime helpers", () => {
  it("formats local datetime input values and falls back for invalid publish values", () => {
    const localValue = formatDatetimeLocalValue(new Date(2026, 4, 21, 9, 5))

    expect(localValue).toBe("2026-05-21T09:05")
    expect(toDatetimeLocalValue("2026-05-20T08:30:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(toPublishTimestamp("not a date")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe("useContentLoopStore", () => {
  it("loads persisted content loop state and derives topic counts", async () => {
    await useContentLoopStore.getState().load()

    expect(window.robertStation.contentLoop.load).toHaveBeenCalledOnce()
    expect(useContentLoopStore.getState().contentLoop?.topics).toHaveLength(4)
    expect(useContentLoopStore.getState().candidateTopicCount).toBe(4)
  })

  it("promotes topics, routes to creation, and selects the promoted project", async () => {
    await useContentLoopStore.getState().load()
    await useContentLoopStore.getState().promoteTopic("topic_ai_local-workstation")

    const state = useContentLoopStore.getState()
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation")
    expect(state.screen).toBe("creation")
    expect(state.selectedProject?.id).toBe("project_topic-ai-local-workstation")
  })

  it("generates xiaohongshu platform packages and routes to publish", async () => {
    await promoteSeedTopic()
    await useContentLoopStore.getState().generatePlatformPackage("project_topic-ai-local-workstation")

    const state = useContentLoopStore.getState()
    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    )
    expect(state.screen).toBe("publish")
    expect(state.selectedXiaohongshuPackage?.contentProjectId).toBe("project_topic-ai-local-workstation")
  })

  it("records manual publishes with a full input object and routes to review", async () => {
    await promoteSeedTopic()
    await useContentLoopStore.getState().generatePlatformPackage("project_topic-ai-local-workstation")
    const platformPackageId = useContentLoopStore.getState().selectedXiaohongshuPackage?.id

    await useContentLoopStore.getState().recordManualPublish(platformPackageId!, {
      publishedAt: "2026-05-21T09:05",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "published manually"
    })

    expect(window.robertStation.contentLoop.recordManualPublish).toHaveBeenCalledWith({
      platformPackageId,
      publishedAt: new Date("2026-05-21T09:05").toISOString(),
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "published manually"
    })
    expect(useContentLoopStore.getState().screen).toBe("review")
    expect(useContentLoopStore.getState().selectedPublishRecord?.url).toBe("https://www.xiaohongshu.com/explore/demo")
  })

  it("ignores stale successful review generation after selected publish record changes", async () => {
    await promoteAndPublish("topic_ai_local-workstation", "https://www.xiaohongshu.com/explore/demo")
    const firstState = useContentLoopStore.getState()
    const firstRecordId = firstState.selectedPublishRecord?.id
    const staleResponse = {
      ...firstState.contentLoop!,
      reviewReports: [
        {
          id: "review-report_stale-v1",
          workspaceId: "workspace_robert-station",
          contentProjectId: "project_topic-ai-local-workstation",
          publishRecordId: firstRecordId!,
          version: 1,
          summary: "stale review",
          highlights: [],
          underperformingSignals: [],
          likelyCauses: [],
          nextActions: [],
          createdAt: "2026-05-21T00:00:00.000Z",
          updatedAt: "2026-05-21T00:00:00.000Z"
        }
      ],
      selectedProjectId: "project_topic-ai-local-workstation"
    }
    const deferredReview = createDeferred<PersistedContentLoopState>()
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => deferredReview.promise)

    const reviewPromise = useContentLoopStore.getState().generateReviewReport(firstRecordId!)
    await promoteAndPublish("topic_finance-family-dashboard", "https://www.xiaohongshu.com/explore/finance")
    const secondRecordId = useContentLoopStore.getState().selectedPublishRecord?.id
    deferredReview.resolve(staleResponse)
    await reviewPromise

    const state = useContentLoopStore.getState()
    expect(state.selectedPublishRecord?.id).toBe(secondRecordId)
    expect(state.selectedLatestReviewReport).toBeNull()
    expect(state.isGeneratingReviewReport).toBe(false)
  })

  it("sets blocked review knowledge result when the project has not been archived", async () => {
    await promoteAndPublish("topic_ai_local-workstation", "https://www.xiaohongshu.com/explore/demo")
    await useContentLoopStore.getState().generateReviewReport(useContentLoopStore.getState().selectedPublishRecord!.id)
    const reviewReportId = useContentLoopStore.getState().selectedLatestReviewReport?.id

    await useContentLoopStore.getState().extractReviewKnowledge(reviewReportId!)

    expect(useContentLoopStore.getState().reviewKnowledgeResult).toEqual({
      kind: "blocked",
      textKey: "review.archiveRequired"
    })
  })

  it("resets to initial store state", async () => {
    await promoteAndPublish("topic_ai_local-workstation", "https://www.xiaohongshu.com/explore/demo")

    useContentLoopStore.getState().reset()

    const state = useContentLoopStore.getState()
    expect(state.screen).toBe("dashboard")
    expect(state.contentLoop).toBeNull()
    expect(state.selectedProject).toBeNull()
    expect(state.reviewKnowledgeResult).toBeNull()
    expect(state.candidateTopicCount).toBe(0)
  })

  it("exposes the planned public async error field names", () => {
    const state = useContentLoopStore.getState()

    expect(state.topicGenerationError).toBeNull()
    expect(state.draftPackageError).toBeNull()
    expect(state.platformPackageError).toBeNull()
    expect(state.archiveError).toBeNull()
    expect(state.publishRecordError).toBeNull()
    expect(state.metricImportError).toBeNull()
    expect(state.metricSaveError).toBeNull()
    expect(state.reviewReportError).toBeNull()
    expect(state.reviewKnowledgeError).toBeNull()
    expect("topicGenerationErrorKey" in state).toBe(false)
    expect("draftGenerationErrorKey" in state).toBe(false)
    expect("platformGenerationErrorKey" in state).toBe(false)
    expect("archiveErrorKey" in state).toBe(false)
    expect("publishSaveErrorKey" in state).toBe(false)
    expect("metricImportErrorKey" in state).toBe(false)
    expect("metricSaveErrorKey" in state).toBe(false)
    expect("reviewGenerationErrorKey" in state).toBe(false)
    expect("knowledgeExtractionErrorKey" in state).toBe(false)
  })
})

async function promoteSeedTopic(): Promise<void> {
  await useContentLoopStore.getState().load()
  await useContentLoopStore.getState().promoteTopic("topic_ai_local-workstation")
}

async function promoteAndPublish(topicId: string, url: string): Promise<void> {
  await useContentLoopStore.getState().load()
  await useContentLoopStore.getState().promoteTopic(topicId)
  const projectId = useContentLoopStore.getState().selectedProject!.id
  await useContentLoopStore.getState().generatePlatformPackage(projectId)
  const platformPackageId = useContentLoopStore.getState().selectedXiaohongshuPackage!.id
  await useContentLoopStore.getState().recordManualPublish(platformPackageId, {
    publishedAt: "2026-05-21T09:05",
    url
  })
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}
