import type { PublishRecord, ReviewReport } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import type {
  PipelineAction,
  PipelineContentLoopState,
  PipelineDetailViewModel
} from "../../pipeline/pipeline-model"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { FieldGroup } from "../shared/FieldGroup"

type PipelineStageActionsProps = {
  detail: PipelineDetailViewModel
  contentLoop: PipelineContentLoopState | null
  isPromotingTopic: boolean
  isGeneratingDraftPackage: boolean
  isGeneratingPlatformPackage: boolean
  isSavingPublishRecord: boolean
  isGeneratingReviewReport: boolean
  isArchivingProject: boolean
  promoteTopic: (topicId: string) => Promise<void>
  generateDraftPackage: (projectId: string) => Promise<void>
  generatePlatformPackage: (projectId: string) => Promise<void>
  recordManualPublish: (platformPackageId: string) => Promise<void>
  generateReviewReport: (publishRecordId: string) => Promise<void>
  archiveProject: (projectId: string) => Promise<void>
}

export function PipelineStageActions({
  detail,
  contentLoop,
  isPromotingTopic,
  isGeneratingDraftPackage,
  isGeneratingPlatformPackage,
  isSavingPublishRecord,
  isGeneratingReviewReport,
  isArchivingProject,
  promoteTopic,
  generateDraftPackage,
  generatePlatformPackage,
  recordManualPublish,
  generateReviewReport,
  archiveProject
}: PipelineStageActionsProps): ReactElement {
  const t = useTranslation()
  const manualPublishDraft = useContentLoopStore((state) => state.manualPublishDraft)
  const matchedMetricImportPreviewRows = useContentLoopStore((state) => state.matchedMetricImportPreviewRows)
  const invalidMetricImportPreviewRows = useContentLoopStore((state) => state.invalidMetricImportPreviewRows)
  const isImportingMetrics = useContentLoopStore((state) => state.isImportingMetrics)
  const isSavingMetricImport = useContentLoopStore((state) => state.isSavingMetricImport)
  const isExtractingReviewKnowledge = useContentLoopStore((state) => state.isExtractingReviewKnowledge)
  const publishRecordError = useContentLoopStore((state) => state.publishRecordError)
  const metricImportError = useContentLoopStore((state) => state.metricImportError)
  const metricSaveError = useContentLoopStore((state) => state.metricSaveError)
  const reviewKnowledgeError = useContentLoopStore((state) => state.reviewKnowledgeError)
  const reviewKnowledgeResult = useContentLoopStore((state) => state.reviewKnowledgeResult)
  const setManualPublishDraft = useContentLoopStore((state) => state.setManualPublishDraft)
  const importMetricCsv = useContentLoopStore((state) => state.importMetricCsv)
  const saveMetricImport = useContentLoopStore((state) => state.saveMetricImport)
  const extractReviewKnowledge = useContentLoopStore((state) => state.extractReviewKnowledge)
  const actions = [
    ...(detail.primaryAction ? [detail.primaryAction] : []),
    ...detail.secondaryActions.filter((action) =>
      action.kind === "archiveProject" ||
      action.kind === "importMetricCsv" ||
      action.kind === "extractReviewKnowledge"
    )
  ]

  return (
    <div className="pipeline-stage-actions">
      {actions.map((action) => {
        const resolved = resolveAction(action, detail, contentLoop)
        const isLoading = actionIsLoading(action, {
          isPromotingTopic,
          isGeneratingDraftPackage,
          isGeneratingPlatformPackage,
          isSavingPublishRecord,
          isImportingMetrics,
          isSavingMetricImport,
          isGeneratingReviewReport,
          isExtractingReviewKnowledge,
          isArchivingProject
        })

        if (action.kind === "recordManualPublish") {
          const platformPackageId = resolved?.kind === "recordManualPublish" ? resolved.platformPackageId : null

          return (
            <div className="creation-actions" key={`${action.kind}-${action.platformPackageId ?? "detail"}`}>
              <FieldGroup label={t("publish.publishedAt")}>
                <input
                  type="datetime-local"
                  value={manualPublishDraft.publishedAt}
                  onChange={(event) => setManualPublishDraft({ publishedAt: event.target.value })}
                />
              </FieldGroup>
              <FieldGroup label={t("publish.url")}>
                <input
                  type="url"
                  value={manualPublishDraft.url}
                  onChange={(event) => setManualPublishDraft({ url: event.target.value })}
                />
              </FieldGroup>
              <FieldGroup label={t("publish.note")}>
                <textarea
                  value={manualPublishDraft.note}
                  onChange={(event) => setManualPublishDraft({ note: event.target.value })}
                />
              </FieldGroup>
              <Button
                disabled={!platformPackageId || isLoading}
                onClick={() => {
                  if (platformPackageId) {
                    void recordManualPublish(platformPackageId)
                  }
                }}
              >
                {isLoading ? t("publish.saving") : actionLabel(action, t)}
              </Button>
              {publishRecordError ? (
                <p className="inline-error" role="alert">
                  {t(publishRecordError as TranslationKey)}
                </p>
              ) : null}
            </div>
          )
        }

        if (action.kind === "importMetricCsv") {
          return (
            <div className="creation-actions" key={`${action.kind}-${action.projectId ?? "detail"}`}>
              <Button disabled={isLoading} onClick={() => void importMetricCsv()}>
                {isLoading ? t("metrics.importing") : actionLabel(action, t)}
              </Button>
              {metricImportError ? (
                <p className="inline-error" role="alert">
                  {t(metricImportError as TranslationKey)}
                </p>
              ) : null}
              {metricSaveError ? (
                <p className="inline-error" role="alert">
                  {t(metricSaveError as TranslationKey)}
                </p>
              ) : null}
              {matchedMetricImportPreviewRows.length > 0 ? (
                <>
                  <p>{t("metrics.previewMatched", { count: matchedMetricImportPreviewRows.length })}</p>
                  <Button disabled={isSavingMetricImport} onClick={() => void saveMetricImport()}>
                    {isSavingMetricImport ? t("metrics.saving") : t("metrics.saveImported")}
                  </Button>
                </>
              ) : null}
              {invalidMetricImportPreviewRows.length > 0 ? (
                <p>{t("metrics.previewInvalid", { count: invalidMetricImportPreviewRows.length })}</p>
              ) : null}
            </div>
          )
        }

        if (action.kind === "extractReviewKnowledge") {
          const reviewReportId = resolved?.kind === "extractReviewKnowledge" ? resolved.reviewReportId : null

          return (
            <div className="creation-actions" key={`${action.kind}-${action.reviewReportId ?? "detail"}`}>
              <Button
                disabled={!reviewReportId || isLoading}
                onClick={() => {
                  if (reviewReportId) {
                    void extractReviewKnowledge(reviewReportId)
                  }
                }}
              >
                {isLoading ? t("review.extracting") : actionLabel(action, t)}
              </Button>
              {reviewKnowledgeError ? (
                <p className="inline-error" role="alert">
                  {t(reviewKnowledgeError as TranslationKey)}
                </p>
              ) : null}
              {reviewKnowledgeResult ? (
                <p role={reviewKnowledgeResult.kind === "success" ? "status" : "alert"}>
                  {t(reviewKnowledgeResult.textKey)}
                </p>
              ) : null}
            </div>
          )
        }

        return (
          <Button
            disabled={!resolved || isLoading}
            key={`${action.kind}-${action.topicId ?? action.projectId ?? action.platformPackageId ?? action.publishRecordId ?? "detail"}`}
            onClick={() => {
              if (resolved) {
                void runAction(resolved, {
                  promoteTopic,
                  generateDraftPackage,
                  generatePlatformPackage,
                  recordManualPublish,
                  generateReviewReport,
                  importMetricCsv,
                  saveMetricImport,
                  extractReviewKnowledge,
                  archiveProject
                })
              }
            }}
            variant={action.kind === "archiveProject" ? "secondary" : "primary"}
          >
            {isLoading ? t(loadingLabelKey(action.kind)) : actionLabel(action, t)}
          </Button>
        )
      })}
    </div>
  )
}

type LoadingFlags = {
  isPromotingTopic: boolean
  isGeneratingDraftPackage: boolean
  isGeneratingPlatformPackage: boolean
  isSavingPublishRecord: boolean
  isImportingMetrics: boolean
  isSavingMetricImport: boolean
  isGeneratingReviewReport: boolean
  isExtractingReviewKnowledge: boolean
  isArchivingProject: boolean
}

type ActionHandlers = {
  promoteTopic: (topicId: string) => Promise<void>
  generateDraftPackage: (projectId: string) => Promise<void>
  generatePlatformPackage: (projectId: string) => Promise<void>
  recordManualPublish: (platformPackageId: string) => Promise<void>
  generateReviewReport: (publishRecordId: string) => Promise<void>
  importMetricCsv: () => Promise<void>
  saveMetricImport: () => Promise<void>
  extractReviewKnowledge: (reviewReportId: string) => Promise<void>
  archiveProject: (projectId: string) => Promise<void>
}

type ResolvedAction =
  | { kind: "promoteTopic"; topicId: string }
  | { kind: "generateDraftPackage"; projectId: string }
  | { kind: "generatePlatformPackage"; projectId: string }
  | { kind: "recordManualPublish"; platformPackageId: string }
  | { kind: "generateReviewReport"; publishRecordId: string }
  | { kind: "importMetricCsv" }
  | { kind: "saveMetricImport" }
  | { kind: "extractReviewKnowledge"; reviewReportId: string }
  | { kind: "archiveProject"; projectId: string }

function resolveAction(
  action: PipelineAction,
  detail: PipelineDetailViewModel,
  contentLoop: PipelineContentLoopState | null
): ResolvedAction | null {
  if (action.kind === "promoteTopic" && detail.item.kind === "topic") {
    return { kind: action.kind, topicId: action.topicId ?? detail.item.topicId }
  }

  if (
    (action.kind === "generateDraftPackage" ||
      action.kind === "generatePlatformPackage" ||
      action.kind === "archiveProject") &&
    detail.item.kind === "project"
  ) {
    return { kind: action.kind, projectId: action.projectId ?? detail.item.projectId }
  }

  if (action.kind === "recordManualPublish" && action.platformPackageId) {
    return { kind: action.kind, platformPackageId: action.platformPackageId }
  }

  if (action.kind === "generateReviewReport" && detail.item.kind === "project") {
    const publishRecordId = action.publishRecordId ?? latestProjectPublishRecord(contentLoop, detail.item.projectId)?.id

    return publishRecordId ? { kind: action.kind, publishRecordId } : null
  }

  if (action.kind === "importMetricCsv") {
    return { kind: action.kind }
  }

  if (action.kind === "saveMetricImport") {
    return { kind: action.kind }
  }

  if (action.kind === "extractReviewKnowledge" && detail.item.kind === "project") {
    const reviewReportId = action.reviewReportId ?? latestProjectReviewReport(contentLoop, detail.item.projectId)?.id

    return reviewReportId ? { kind: action.kind, reviewReportId } : null
  }

  return null
}

async function runAction(action: ResolvedAction, handlers: ActionHandlers): Promise<void> {
  if (action.kind === "promoteTopic") {
    await handlers.promoteTopic(action.topicId)
    return
  }

  if (action.kind === "generateDraftPackage") {
    await handlers.generateDraftPackage(action.projectId)
    return
  }

  if (action.kind === "generatePlatformPackage") {
    await handlers.generatePlatformPackage(action.projectId)
    return
  }

  if (action.kind === "recordManualPublish") {
    await handlers.recordManualPublish(action.platformPackageId)
    return
  }

  if (action.kind === "generateReviewReport") {
    await handlers.generateReviewReport(action.publishRecordId)
    return
  }

  if (action.kind === "importMetricCsv") {
    await handlers.importMetricCsv()
    return
  }

  if (action.kind === "saveMetricImport") {
    await handlers.saveMetricImport()
    return
  }

  if (action.kind === "extractReviewKnowledge") {
    await handlers.extractReviewKnowledge(action.reviewReportId)
    return
  }

  await handlers.archiveProject(action.projectId)
}

function latestProjectPublishRecord(
  contentLoop: PipelineContentLoopState | null,
  projectId: string
): PublishRecord | null {
  return [...(contentLoop?.publishRecords ?? [])]
    .filter((record) => record.contentProjectId === projectId)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0] ?? null
}

function latestProjectReviewReport(
  contentLoop: PipelineContentLoopState | null,
  projectId: string
): ReviewReport | null {
  return [...(contentLoop?.reviewReports ?? [])]
    .filter((report) => report.contentProjectId === projectId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

function actionIsLoading(action: PipelineAction, flags: LoadingFlags): boolean {
  if (action.kind === "promoteTopic") {
    return flags.isPromotingTopic
  }

  if (action.kind === "generateDraftPackage") {
    return flags.isGeneratingDraftPackage
  }

  if (action.kind === "generatePlatformPackage") {
    return flags.isGeneratingPlatformPackage
  }

  if (action.kind === "recordManualPublish") {
    return flags.isSavingPublishRecord
  }

  if (action.kind === "importMetricCsv") {
    return flags.isImportingMetrics
  }

  if (action.kind === "saveMetricImport") {
    return flags.isSavingMetricImport
  }

  if (action.kind === "generateReviewReport") {
    return flags.isGeneratingReviewReport
  }

  if (action.kind === "extractReviewKnowledge") {
    return flags.isExtractingReviewKnowledge
  }

  if (action.kind === "archiveProject") {
    return flags.isArchivingProject
  }

  return false
}

function loadingLabelKey(kind: PipelineAction["kind"]): TranslationKey {
  if (kind === "archiveProject") {
    return "creation.archiving"
  }

  if (kind === "recordManualPublish") {
    return "publish.saving"
  }

  if (kind === "generateReviewReport") {
    return "review.generating"
  }

  if (kind === "extractReviewKnowledge") {
    return "review.extracting"
  }

  if (kind === "importMetricCsv") {
    return "metrics.importing"
  }

  if (kind === "saveMetricImport") {
    return "metrics.saving"
  }

  if (kind === "generateTopics") {
    return "topics.generating"
  }

  return "creation.generating"
}

function actionLabel(action: PipelineAction, t: (key: TranslationKey) => string): string {
  const labelKeyByKind: Partial<Record<PipelineAction["kind"], TranslationKey>> = {
    generateTopics: "topics.generate",
    promoteTopic: "topics.promote",
    generateDraftPackage: "creation.generateDraft",
    generatePlatformPackage: "creation.generatePlatform",
    recordManualPublish: "publish.save",
    importMetricCsv: "metrics.importCsv",
    saveMetricImport: "metrics.saveImported",
    generateReviewReport: "review.generate",
    extractReviewKnowledge: "review.extractKnowledge",
    archiveProject: "creation.archive",
    createContentLoopExport: "knowledge.exportMarkdown"
  }
  const labelKey = labelKeyByKind[action.kind] ?? action.labelKey as TranslationKey

  return t(labelKey)
}
