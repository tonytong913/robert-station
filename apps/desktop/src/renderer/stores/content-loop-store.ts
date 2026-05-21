import type {
  ArchiveRecord,
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  ManualPublishInput,
  MetricImportPreviewRow,
  MetricSnapshot,
  PlatformPackage,
  PublishRecord,
  ReviewReport
} from "@robert-station/core"
import type { PersistedContentLoopState } from "@robert-station/local-store"
import { create } from "zustand"
import {
  archivePersistedProject,
  extractPersistedReviewKnowledge,
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedReviewReport,
  generatePersistedTopics,
  importPersistedMetricCsv,
  loadPersistedContentLoop,
  promotePersistedTopic,
  recordPersistedManualPublish,
  savePersistedMetricImport
} from "../content-loop-loader"
import { formatDatetimeLocalValue, toDatetimeLocalValue, toPublishTimestamp } from "../datetime"

export type TaskScreen = "dashboard" | "topics" | "creation" | "publish" | "review" | "knowledge"

export type ReviewKnowledgeResult = {
  kind: "success" | "blocked"
  textKey: "review.knowledgeExtracted" | "review.archiveRequired"
}

type ManualPublishDraft = Omit<ManualPublishInput, "platformPackageId">
type ManualPublishDraftInput = Partial<ManualPublishDraft>

type AsyncState = {
  isLoading: boolean
  isGeneratingTopics: boolean
  isGeneratingDraftPackage: boolean
  isGeneratingPlatformPackage: boolean
  isArchivingProject: boolean
  isSavingPublishRecord: boolean
  isImportingMetrics: boolean
  isSavingMetricImport: boolean
  isGeneratingReviewReport: boolean
  isExtractingReviewKnowledge: boolean
  loadErrorKey: string | null
  topicGenerationErrorKey: string | null
  draftGenerationErrorKey: string | null
  platformGenerationErrorKey: string | null
  archiveErrorKey: string | null
  publishSaveErrorKey: string | null
  metricImportErrorKey: string | null
  metricSaveErrorKey: string | null
  reviewGenerationErrorKey: string | null
  knowledgeExtractionErrorKey: string | null
}

type DerivedState = {
  candidateTopicCount: number
  activeProjectCount: number
  selectedProject: ContentProject | null
  selectedDraft: DraftVersion | null
  selectedXiaohongshuPackage: PlatformPackage | null
  selectedPublishRecord: PublishRecord | null
  selectedLatestMetricSnapshot: MetricSnapshot | null
  selectedLatestReviewReport: ReviewReport | null
  selectedArchiveRecord: ArchiveRecord | null
  matchedMetricImportPreviewRows: MetricImportPreviewRow[]
  invalidMetricImportPreviewRows: MetricImportPreviewRow[]
}

type ContentLoopStoreState = AsyncState &
  DerivedState & {
    screen: TaskScreen
    contentLoop: PersistedContentLoopState | null
    topicGenerationColumn: ContentColumnSlug
    selectedPublishRecordId: string | null
    selectedReviewReportId: string | null
    manualPublishDraft: ManualPublishDraft
    reviewKnowledgeResult: ReviewKnowledgeResult | null
    setScreen: (screen: TaskScreen) => void
    setTopicGenerationColumn: (columnSlug: ContentColumnSlug) => void
    setManualPublishDraft: (partialDraft: ManualPublishDraftInput) => void
    selectProject: (projectId: string) => void
    selectPublishRecord: (publishRecordId: string) => void
    load: () => Promise<void>
    promoteTopic: (topicId: string) => Promise<void>
    generateTopics: () => Promise<void>
    generateDraftPackage: (projectId: string) => Promise<void>
    generatePlatformPackage: (projectId: string) => Promise<void>
    archiveProject: (projectId: string) => Promise<void>
    recordManualPublish: (platformPackageId: string, input?: ManualPublishDraftInput) => Promise<void>
    importMetricCsv: () => Promise<void>
    saveMetricImport: () => Promise<void>
    generateReviewReport: (publishRecordId: string) => Promise<void>
    extractReviewKnowledge: (reviewReportId: string) => Promise<void>
    reset: () => void
  }

const initialAsyncState: AsyncState = {
  isLoading: false,
  isGeneratingTopics: false,
  isGeneratingDraftPackage: false,
  isGeneratingPlatformPackage: false,
  isArchivingProject: false,
  isSavingPublishRecord: false,
  isImportingMetrics: false,
  isSavingMetricImport: false,
  isGeneratingReviewReport: false,
  isExtractingReviewKnowledge: false,
  loadErrorKey: null,
  topicGenerationErrorKey: null,
  draftGenerationErrorKey: null,
  platformGenerationErrorKey: null,
  archiveErrorKey: null,
  publishSaveErrorKey: null,
  metricImportErrorKey: null,
  metricSaveErrorKey: null,
  reviewGenerationErrorKey: null,
  knowledgeExtractionErrorKey: null
}

const initialDerivedState: DerivedState = {
  candidateTopicCount: 0,
  activeProjectCount: 0,
  selectedProject: null,
  selectedDraft: null,
  selectedXiaohongshuPackage: null,
  selectedPublishRecord: null,
  selectedLatestMetricSnapshot: null,
  selectedLatestReviewReport: null,
  selectedArchiveRecord: null,
  matchedMetricImportPreviewRows: [],
  invalidMetricImportPreviewRows: []
}

function createInitialState() {
  return {
    screen: "dashboard" as TaskScreen,
    contentLoop: null,
    topicGenerationColumn: "ai" as ContentColumnSlug,
    selectedPublishRecordId: null,
    selectedReviewReportId: null,
    manualPublishDraft: createDefaultManualPublishDraft(),
    reviewKnowledgeResult: null,
    ...initialAsyncState,
    ...initialDerivedState
  }
}

export const useContentLoopStore = create<ContentLoopStoreState>((set, get) => ({
  ...createInitialState(),
  setScreen: (screen) => set({ screen }),
  setTopicGenerationColumn: (columnSlug) => set({ topicGenerationColumn: columnSlug }),
  setManualPublishDraft: (partialDraft) =>
    set((state) => ({
      manualPublishDraft: {
        ...state.manualPublishDraft,
        ...partialDraft
      }
    })),
  selectProject: (projectId) =>
    set((state) =>
      withDerived({
        ...state,
        contentLoop: state.contentLoop ? { ...state.contentLoop, selectedProjectId: projectId } : state.contentLoop,
        selectedPublishRecordId: null,
        selectedReviewReportId: null,
        reviewKnowledgeResult: null,
        isGeneratingReviewReport: false,
        isExtractingReviewKnowledge: false,
        reviewGenerationErrorKey: null,
        knowledgeExtractionErrorKey: null
      })
    ),
  selectPublishRecord: (publishRecordId) =>
    set((state) => {
      const nextContentLoop = selectPublishProject(state.contentLoop, publishRecordId)

      return withDerived({
        ...state,
        contentLoop: nextContentLoop,
        selectedPublishRecordId: publishRecordId,
        selectedReviewReportId: null,
        reviewKnowledgeResult: null,
        isGeneratingReviewReport: false,
        isExtractingReviewKnowledge: false,
        reviewGenerationErrorKey: null,
        knowledgeExtractionErrorKey: null
      })
    }),
  load: async () => {
    set({ isLoading: true, loadErrorKey: null })

    try {
      const contentLoop = await loadPersistedContentLoop()
      set((state) => withDerived({ ...state, contentLoop, isLoading: false }))
    } catch {
      set({ isLoading: false, loadErrorKey: "app.loading" })
    }
  },
  promoteTopic: async (topicId) => {
    const contentLoop = await promotePersistedTopic(topicId)
    set((state) => withDerived({ ...state, contentLoop, screen: "creation" }))
  },
  generateTopics: async () => {
    set({ isGeneratingTopics: true, topicGenerationErrorKey: null })

    try {
      const contentLoop = await generatePersistedTopics(get().topicGenerationColumn)
      set((state) => withDerived({ ...state, contentLoop, isGeneratingTopics: false }))
    } catch {
      set({ isGeneratingTopics: false, topicGenerationErrorKey: "topics.generateFailed" })
    }
  },
  generateDraftPackage: async (projectId) => {
    set({ isGeneratingDraftPackage: true, draftGenerationErrorKey: null })

    try {
      const contentLoop = await generatePersistedDraftPackage(projectId)
      set((state) => withDerived({ ...state, contentLoop, isGeneratingDraftPackage: false }))
    } catch {
      set({ isGeneratingDraftPackage: false, draftGenerationErrorKey: "creation.draftFailed" })
    }
  },
  generatePlatformPackage: async (projectId) => {
    set({ isGeneratingPlatformPackage: true, platformGenerationErrorKey: null })

    try {
      const contentLoop = await generatePersistedPlatformPackage(projectId, "xiaohongshu")
      set((state) => withDerived({ ...state, contentLoop, screen: "publish", isGeneratingPlatformPackage: false }))
    } catch {
      set({ isGeneratingPlatformPackage: false, platformGenerationErrorKey: "creation.platformFailed" })
    }
  },
  archiveProject: async (projectId) => {
    set({ isArchivingProject: true, archiveErrorKey: null })

    try {
      const contentLoop = await archivePersistedProject(projectId)
      set((state) => withDerived({ ...state, contentLoop, isArchivingProject: false }))
    } catch {
      set({ isArchivingProject: false, archiveErrorKey: "creation.archiveFailed" })
    }
  },
  recordManualPublish: async (platformPackageId, input) => {
    set({ isSavingPublishRecord: true, publishSaveErrorKey: null })

    try {
      const draft = { ...get().manualPublishDraft, ...input }
      const publishInput: ManualPublishInput = {
        platformPackageId,
        publishedAt: toPublishTimestamp(draft.publishedAt)
      }

      if (draft.url !== undefined) {
        publishInput.url = draft.url
      }

      if (draft.note !== undefined) {
        publishInput.note = draft.note
      }

      const contentLoop = await recordPersistedManualPublish(publishInput)
      set((state) =>
        withDerived({
          ...state,
          contentLoop,
          screen: "review",
          manualPublishDraft: draft,
          isSavingPublishRecord: false,
          isGeneratingReviewReport: false,
          isExtractingReviewKnowledge: false,
          reviewGenerationErrorKey: null,
          knowledgeExtractionErrorKey: null,
          reviewKnowledgeResult: null
        })
      )
    } catch {
      set({ isSavingPublishRecord: false, publishSaveErrorKey: "publish.saveFailed" })
    }
  },
  importMetricCsv: async () => {
    set({ isImportingMetrics: true, metricImportErrorKey: null, metricSaveErrorKey: null })

    try {
      const contentLoop = await importPersistedMetricCsv()
      set((state) => withDerived({ ...state, contentLoop, isImportingMetrics: false }))
    } catch {
      set({ isImportingMetrics: false, metricImportErrorKey: "metrics.importFailed" })
    }
  },
  saveMetricImport: async () => {
    set({ isSavingMetricImport: true, metricSaveErrorKey: null })

    try {
      const contentLoop = await savePersistedMetricImport()
      set((state) => withDerived({ ...state, contentLoop, isSavingMetricImport: false }))
    } catch {
      set({ isSavingMetricImport: false, metricSaveErrorKey: "metrics.saveFailed" })
    }
  },
  generateReviewReport: async (publishRecordId) => {
    set({
      selectedPublishRecordId: publishRecordId,
      isGeneratingReviewReport: true,
      reviewGenerationErrorKey: null
    })

    try {
      const contentLoop = await generatePersistedReviewReport(publishRecordId)
      // The review pane is tied to the selected publish record. Late responses for an older
      // record must not replace the active project or review state after the user navigates.
      if (get().selectedPublishRecordId === publishRecordId) {
        set((state) => withDerived({ ...state, contentLoop, isGeneratingReviewReport: false }))
      }
    } catch {
      if (get().selectedPublishRecordId === publishRecordId) {
        set({ isGeneratingReviewReport: false, reviewGenerationErrorKey: "review.generateFailed" })
      }
    }
  },
  extractReviewKnowledge: async (reviewReportId) => {
    set({
      selectedReviewReportId: reviewReportId,
      isExtractingReviewKnowledge: true,
      reviewKnowledgeResult: null,
      knowledgeExtractionErrorKey: null
    })

    try {
      const contentLoop = await extractPersistedReviewKnowledge(reviewReportId)
      // Review extraction may be blocked by archive prerequisites. Only apply the result if
      // the same report is still selected, then inspect returned state instead of assuming success.
      if (get().selectedReviewReportId === reviewReportId) {
        const reportProjectId = contentLoop.reviewReports.find((report) => report.id === reviewReportId)?.contentProjectId ?? null
        const hasReviewKnowledge = contentLoop.knowledgeItems.some(
          (item) =>
            item.contentProjectId === reportProjectId &&
            item.tags.includes("review") &&
            item.tags.includes("performance")
        )
        const reviewKnowledgeResult: ReviewKnowledgeResult = hasReviewKnowledge
          ? { kind: "success", textKey: "review.knowledgeExtracted" }
          : { kind: "blocked", textKey: "review.archiveRequired" }

        set((state) =>
          withDerived({
            ...state,
            contentLoop,
            reviewKnowledgeResult,
            isExtractingReviewKnowledge: false
          })
        )
      }
    } catch {
      if (get().selectedReviewReportId === reviewReportId) {
        set({ isExtractingReviewKnowledge: false, knowledgeExtractionErrorKey: "review.extractFailed" })
      }
    }
  },
  reset: () => set(createInitialState())
}))

function createDefaultManualPublishDraft(): ManualPublishDraft {
  return {
    publishedAt: formatDatetimeLocalValue(new Date()),
    url: "",
    note: ""
  }
}

function withDerived(state: ContentLoopStoreState): ContentLoopStoreState {
  const derived = deriveContentLoopState(state.contentLoop, state.selectedPublishRecordId, state.selectedReviewReportId)
  const manualPublishDraft =
    derived.selectedXiaohongshuPackage && derived.selectedPublishRecord
      ? {
          publishedAt: toDatetimeLocalValue(derived.selectedPublishRecord.publishedAt),
          url: derived.selectedPublishRecord.url,
          note: derived.selectedPublishRecord.note
        }
      : state.manualPublishDraft

  return {
    ...state,
    ...derived,
    selectedPublishRecordId: derived.selectedPublishRecord?.id ?? null,
    selectedReviewReportId: derived.selectedLatestReviewReport?.id ?? null,
    manualPublishDraft
  }
}

function deriveContentLoopState(
  contentLoop: PersistedContentLoopState | null,
  selectedPublishRecordId: string | null,
  selectedReviewReportId: string | null
): DerivedState {
  if (!contentLoop) {
    return initialDerivedState
  }

  const selectedProject = contentLoop.projects.find((project) => project.id === contentLoop.selectedProjectId) ?? null
  const selectedDraft = selectedProject
    ? contentLoop.drafts.find((draft) => draft.contentProjectId === selectedProject.id) ?? null
    : null
  const selectedXiaohongshuPackage =
    selectedProject
      ? contentLoop.platformPackages.find(
          (platformPackage) =>
            platformPackage.contentProjectId === selectedProject.id && platformPackage.platform === "xiaohongshu"
        ) ?? null
      : null
  const selectedPublishRecordById = contentLoop.publishRecords.find(
    (record) => record.id === selectedPublishRecordId && record.contentProjectId === selectedProject?.id
  )
  const selectedPublishRecord =
    selectedPublishRecordById ??
    (selectedXiaohongshuPackage
      ? contentLoop.publishRecords.find((record) => record.platformPackageId === selectedXiaohongshuPackage.id) ?? null
      : null)
  const selectedLatestMetricSnapshot =
    selectedPublishRecord
      ? contentLoop.metricSnapshots.find((snapshot) => snapshot.publishRecordId === selectedPublishRecord.id) ?? null
      : null
  const reviewReports = selectedPublishRecord
    ? contentLoop.reviewReports.filter((report) => report.publishRecordId === selectedPublishRecord.id)
    : []
  const selectedLatestReviewReport =
    reviewReports.find((report) => report.id === selectedReviewReportId) ?? reviewReports[0] ?? null
  const selectedArchiveRecord =
    selectedProject
      ? contentLoop.archiveRecords.find((archiveRecord) => archiveRecord.contentProjectId === selectedProject.id) ?? null
      : null

  return {
    candidateTopicCount: contentLoop.topics.filter((topic) => topic.status === "candidate").length,
    activeProjectCount: contentLoop.projects.length,
    selectedProject,
    selectedDraft,
    selectedXiaohongshuPackage,
    selectedPublishRecord,
    selectedLatestMetricSnapshot,
    selectedLatestReviewReport,
    selectedArchiveRecord,
    matchedMetricImportPreviewRows: contentLoop.metricImportPreview?.rows.filter((row) => row.status === "matched") ?? [],
    invalidMetricImportPreviewRows: contentLoop.metricImportPreview?.rows.filter((row) => row.status === "invalid") ?? []
  }
}

function selectPublishProject(
  contentLoop: PersistedContentLoopState | null,
  publishRecordId: string
): PersistedContentLoopState | null {
  const publishRecord = contentLoop?.publishRecords.find((record) => record.id === publishRecordId)

  if (!contentLoop || !publishRecord) {
    return contentLoop
  }

  return { ...contentLoop, selectedProjectId: publishRecord.contentProjectId }
}
