import type {
  ArchiveRecord,
  ContentColumnSlug,
  ContentLoopExportFile,
  ContentLoopExportFormat,
  ContentProject,
  DraftVersion,
  ManualSourceReferenceInput,
  ManualPublishInput,
  MetricImportPreviewRow,
  MetricSnapshot,
  PlatformPackage,
  PublishRecord,
  ReviewReport,
  SourceReferenceFilter
} from "@robert-station/core"
import { createEntityId } from "@robert-station/core"
import type { PersistedContentLoopState } from "@robert-station/local-store"
import { create } from "zustand"
import type {
  PipelineColumnFilter,
  PipelineItem,
  PipelinePlatformFilter,
  PipelineStageFilter
} from "../pipeline/pipeline-model"
import {
  addPersistedSourceReference,
  archivePersistedProject,
  createPersistedContentLoopExport,
  createPersistedTopicFromSourceReference,
  extractPersistedReviewKnowledge,
  filterPersistedSourceReferences,
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

export type AppScreen = "pipeline" | "sources" | "knowledge" | "exports"

export type ReviewKnowledgeResult = {
  kind: "success" | "blocked"
  textKey: "review.knowledgeExtracted" | "review.archiveRequired"
}

type ManualPublishDraft = Omit<ManualPublishInput, "platformPackageId">
type ManualPublishDraftInput = Partial<ManualPublishDraft>

type AsyncState = {
  isLoading: boolean
  isPromotingTopic: boolean
  isGeneratingTopics: boolean
  isGeneratingDraftPackage: boolean
  isGeneratingPlatformPackage: boolean
  isArchivingProject: boolean
  isSavingPublishRecord: boolean
  isImportingMetrics: boolean
  isSavingMetricImport: boolean
  isGeneratingReviewReport: boolean
  isExtractingReviewKnowledge: boolean
  isAddingSourceReference: boolean
  isCreatingExport: boolean
  loadErrorKey: string | null
  promoteTopicError: string | null
  topicGenerationError: string | null
  draftPackageError: string | null
  platformPackageError: string | null
  archiveError: string | null
  publishRecordError: string | null
  metricImportError: string | null
  metricSaveError: string | null
  reviewReportError: string | null
  reviewKnowledgeError: string | null
  sourceLibraryError: string | null
  exportError: string | null
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
    screen: AppScreen
    contentLoop: PersistedContentLoopState | null
    pipelineStageFilter: PipelineStageFilter
    pipelineColumnFilter: PipelineColumnFilter
    pipelinePlatformFilter: PipelinePlatformFilter
    pipelineSearchQuery: string
    selectedPipelineItem: PipelineItem | null
    topicGenerationColumn: ContentColumnSlug
    selectedPublishRecordId: string | null
    selectedReviewReportId: string | null
    manualPublishDraft: ManualPublishDraft
    reviewKnowledgeResult: ReviewKnowledgeResult | null
    lastExportFile: ContentLoopExportFile | null
    setScreen: (screen: AppScreen) => void
    selectPipelineItem: (item: PipelineItem) => void
    setPipelineStageFilter: (stage: PipelineStageFilter) => void
    setPipelineColumnFilter: (columnSlug: PipelineColumnFilter) => void
    setPipelinePlatformFilter: (platform: PipelinePlatformFilter) => void
    setPipelineSearchQuery: (query: string) => void
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
    addSourceReference: (input: ManualSourceReferenceInput) => Promise<void>
    filterSourceReferences: (filter: SourceReferenceFilter) => Promise<void>
    createTopicFromSourceReference: (sourceReferenceId: string) => Promise<void>
    createContentLoopExport: (format: ContentLoopExportFormat) => Promise<void>
    reset: () => void
  }

const initialAsyncState: AsyncState = {
  isLoading: false,
  isPromotingTopic: false,
  isGeneratingTopics: false,
  isGeneratingDraftPackage: false,
  isGeneratingPlatformPackage: false,
  isArchivingProject: false,
  isSavingPublishRecord: false,
  isImportingMetrics: false,
  isSavingMetricImport: false,
  isGeneratingReviewReport: false,
  isExtractingReviewKnowledge: false,
  isAddingSourceReference: false,
  isCreatingExport: false,
  loadErrorKey: null,
  promoteTopicError: null,
  topicGenerationError: null,
  draftPackageError: null,
  platformPackageError: null,
  archiveError: null,
  publishRecordError: null,
  metricImportError: null,
  metricSaveError: null,
  reviewReportError: null,
  reviewKnowledgeError: null,
  sourceLibraryError: null,
  exportError: null
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
    screen: "pipeline" as AppScreen,
    contentLoop: null,
    pipelineStageFilter: "all" as PipelineStageFilter,
    pipelineColumnFilter: "all" as PipelineColumnFilter,
    pipelinePlatformFilter: "all" as PipelinePlatformFilter,
    pipelineSearchQuery: "",
    selectedPipelineItem: null,
    topicGenerationColumn: "ai" as ContentColumnSlug,
    selectedPublishRecordId: null,
    selectedReviewReportId: null,
    manualPublishDraft: createDefaultManualPublishDraft(),
    reviewKnowledgeResult: null,
    lastExportFile: null,
    ...initialAsyncState,
    ...initialDerivedState
  }
}

export const useContentLoopStore = create<ContentLoopStoreState>((set, get) => ({
  ...createInitialState(),
  setScreen: (screen) => set({ screen }),
  selectPipelineItem: (item) =>
    set((state) => {
      if (item.kind === "topic") {
        return { selectedPipelineItem: item }
      }

      return withDerived({
        ...state,
        contentLoop: state.contentLoop
          ? { ...state.contentLoop, selectedProjectId: item.projectId }
          : state.contentLoop,
        selectedPipelineItem: item,
        selectedPublishRecordId: null,
        selectedReviewReportId: null,
        reviewKnowledgeResult: null,
        isGeneratingReviewReport: false,
        isExtractingReviewKnowledge: false,
        reviewReportError: null,
        reviewKnowledgeError: null
      })
    }),
  setPipelineStageFilter: (stage) => set({ pipelineStageFilter: stage }),
  setPipelineColumnFilter: (columnSlug) => set({ pipelineColumnFilter: columnSlug }),
  setPipelinePlatformFilter: (platform) => set({ pipelinePlatformFilter: platform }),
  setPipelineSearchQuery: (query) => set({ pipelineSearchQuery: query }),
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
        reviewReportError: null,
        reviewKnowledgeError: null
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
        reviewReportError: null,
        reviewKnowledgeError: null
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
    set({ isPromotingTopic: true, promoteTopicError: null })

    try {
      const contentLoop = await promotePersistedTopic(topicId)
      set((state) =>
        withDerived({
          ...state,
          contentLoop,
          screen: "pipeline",
          selectedPipelineItem: contentLoop.selectedProjectId
            ? { kind: "project", stage: "drafting", projectId: contentLoop.selectedProjectId }
            : state.selectedPipelineItem,
          isPromotingTopic: false
        })
      )
    } catch {
      set({ isPromotingTopic: false, promoteTopicError: "topics.promoteFailed" })
    }
  },
  generateTopics: async () => {
    set({ isGeneratingTopics: true, topicGenerationError: null })

    try {
      const contentLoop = await generatePersistedTopics(get().topicGenerationColumn)
      set((state) => withDerived({ ...state, contentLoop, isGeneratingTopics: false }))
    } catch {
      set({ isGeneratingTopics: false, topicGenerationError: "topics.generateFailed" })
    }
  },
  generateDraftPackage: async (projectId) => {
    set({ isGeneratingDraftPackage: true, draftPackageError: null })

    try {
      const contentLoop = await generatePersistedDraftPackage(projectId)
      set((state) => withDerived({ ...state, contentLoop, isGeneratingDraftPackage: false }))
    } catch {
      set({ isGeneratingDraftPackage: false, draftPackageError: "creation.draftFailed" })
    }
  },
  generatePlatformPackage: async (projectId) => {
    set({ isGeneratingPlatformPackage: true, platformPackageError: null })

    try {
      const contentLoop = await generatePersistedPlatformPackage(projectId, "xiaohongshu")
      set((state) =>
        withDerived({
          ...state,
          contentLoop,
          screen: "pipeline",
          selectedPipelineItem: { kind: "project", stage: "readyToPublish", projectId },
          isGeneratingPlatformPackage: false
        })
      )
    } catch {
      set({ isGeneratingPlatformPackage: false, platformPackageError: "creation.platformFailed" })
    }
  },
  archiveProject: async (projectId) => {
    set({ isArchivingProject: true, archiveError: null })

    try {
      const contentLoop = await archivePersistedProject(projectId)
      set((state) => withDerived({ ...state, contentLoop, isArchivingProject: false }))
    } catch {
      set({ isArchivingProject: false, archiveError: "creation.archiveFailed" })
    }
  },
  recordManualPublish: async (platformPackageId, input) => {
    set({ isSavingPublishRecord: true, publishRecordError: null })

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
        })
      )
    } catch {
      set({ isSavingPublishRecord: false, publishRecordError: "publish.saveFailed" })
    }
  },
  importMetricCsv: async () => {
    set({ isImportingMetrics: true, metricImportError: null, metricSaveError: null })

    try {
      const contentLoop = await importPersistedMetricCsv()
      set((state) => withDerived({ ...state, contentLoop, isImportingMetrics: false }))
    } catch {
      set({ isImportingMetrics: false, metricImportError: "metrics.importFailed" })
    }
  },
  saveMetricImport: async () => {
    set({ isSavingMetricImport: true, metricSaveError: null })

    try {
      const contentLoop = await savePersistedMetricImport()
      set((state) => withDerived({ ...state, contentLoop, isSavingMetricImport: false }))
    } catch {
      set({ isSavingMetricImport: false, metricSaveError: "metrics.saveFailed" })
    }
  },
  generateReviewReport: async (publishRecordId) => {
    set({
      selectedPublishRecordId: publishRecordId,
      isGeneratingReviewReport: true,
      reviewReportError: null,
      reviewKnowledgeResult: null
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
        set({ isGeneratingReviewReport: false, reviewReportError: "review.generateFailed" })
      }
    }
  },
  extractReviewKnowledge: async (reviewReportId) => {
    const previousReviewKnowledgeItem = getReviewKnowledgeItem(get().contentLoop, reviewReportId)

    set({
      selectedReviewReportId: reviewReportId,
      isExtractingReviewKnowledge: true,
      reviewKnowledgeResult: null,
      reviewKnowledgeError: null
    })

    try {
      const contentLoop = await extractPersistedReviewKnowledge(reviewReportId)
      // Review extraction may be blocked by archive prerequisites. Only apply the result if
      // the same report is still selected, then inspect returned state instead of assuming success.
      if (get().selectedReviewReportId === reviewReportId) {
        const nextReviewKnowledgeItem = getReviewKnowledgeItem(contentLoop, reviewReportId)
        const didExtractReviewKnowledge =
          !!nextReviewKnowledgeItem &&
          (!previousReviewKnowledgeItem ||
            JSON.stringify(nextReviewKnowledgeItem) !== JSON.stringify(previousReviewKnowledgeItem))
        const reviewKnowledgeResult: ReviewKnowledgeResult = didExtractReviewKnowledge
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
        set({ isExtractingReviewKnowledge: false, reviewKnowledgeError: "review.extractFailed" })
      }
    }
  },
  addSourceReference: async (input) => {
    set({ isAddingSourceReference: true, sourceLibraryError: null })

    try {
      const contentLoop = await addPersistedSourceReference(input)
      set((state) => withDerived({ ...state, contentLoop, isAddingSourceReference: false }))
    } catch {
      set({ isAddingSourceReference: false, sourceLibraryError: "knowledge.sourceAddFailed" })
    }
  },
  filterSourceReferences: async (filter) => {
    set({ isAddingSourceReference: true, sourceLibraryError: null })

    try {
      const contentLoop = await filterPersistedSourceReferences(filter)
      set((state) => withDerived({ ...state, contentLoop, isAddingSourceReference: false }))
    } catch {
      set({ isAddingSourceReference: false, sourceLibraryError: "knowledge.sourceFilterFailed" })
    }
  },
  createTopicFromSourceReference: async (sourceReferenceId) => {
    set({ isAddingSourceReference: true, sourceLibraryError: null })

    try {
      const contentLoop = await createPersistedTopicFromSourceReference(sourceReferenceId)
      set((state) => withDerived({ ...state, contentLoop, isAddingSourceReference: false, screen: "pipeline" }))
    } catch {
      set({ isAddingSourceReference: false, sourceLibraryError: "knowledge.topicCreateFailed" })
    }
  },
  createContentLoopExport: async (format) => {
    set({ isCreatingExport: true, exportError: null, lastExportFile: null })

    try {
      const lastExportFile = await createPersistedContentLoopExport(format)
      set({ lastExportFile, isCreatingExport: false })
    } catch {
      set({ isCreatingExport: false, exportError: "knowledge.exportFailed" })
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
  const contextChanged =
    state.selectedProject?.id !== derived.selectedProject?.id ||
    state.selectedPublishRecord?.id !== derived.selectedPublishRecord?.id ||
    state.selectedLatestReviewReport?.id !== derived.selectedLatestReviewReport?.id
  const manualPublishDraft =
    derived.selectedXiaohongshuPackage && derived.selectedPublishRecord
      ? {
          publishedAt: toDatetimeLocalValue(derived.selectedPublishRecord.publishedAt),
          url: derived.selectedPublishRecord.url,
          note: derived.selectedPublishRecord.note
        }
      : contextChanged
        ? createDefaultManualPublishDraft()
      : state.manualPublishDraft

  return {
    ...state,
    ...derived,
    selectedPublishRecordId: derived.selectedPublishRecord?.id ?? null,
    selectedReviewReportId: derived.selectedLatestReviewReport?.id ?? null,
    manualPublishDraft,
    isGeneratingReviewReport: contextChanged ? false : state.isGeneratingReviewReport,
    isExtractingReviewKnowledge: contextChanged ? false : state.isExtractingReviewKnowledge,
    reviewReportError: contextChanged ? null : state.reviewReportError,
    reviewKnowledgeError: contextChanged ? null : state.reviewKnowledgeError,
    reviewKnowledgeResult: contextChanged ? null : state.reviewKnowledgeResult
  }
}

function getReviewKnowledgeItem(contentLoop: PersistedContentLoopState | null, reviewReportId: string) {
  const reviewKnowledgeItemId = createEntityId("knowledge-item-review", reviewReportId)

  return contentLoop?.knowledgeItems.find((item) => item.id === reviewKnowledgeItemId) ?? null
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
    activeProjectCount: contentLoop.projects.filter((project) => project.status !== "archived").length,
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
