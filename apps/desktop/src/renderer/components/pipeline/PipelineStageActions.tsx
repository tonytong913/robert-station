import type { PublishRecord } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import type {
  PipelineAction,
  PipelineContentLoopState,
  PipelineDetailViewModel
} from "../../pipeline/pipeline-model"
import { Button } from "../shared/Button"

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
  const actions = [
    ...(detail.primaryAction ? [detail.primaryAction] : []),
    ...detail.secondaryActions.filter((action) => action.kind === "archiveProject")
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
          isGeneratingReviewReport,
          isArchivingProject
        })

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

type LoadingFlags = Pick<
  PipelineStageActionsProps,
  | "isPromotingTopic"
  | "isGeneratingDraftPackage"
  | "isGeneratingPlatformPackage"
  | "isSavingPublishRecord"
  | "isGeneratingReviewReport"
  | "isArchivingProject"
>

type ActionHandlers = Pick<
  PipelineStageActionsProps,
  | "promoteTopic"
  | "generateDraftPackage"
  | "generatePlatformPackage"
  | "recordManualPublish"
  | "generateReviewReport"
  | "archiveProject"
>

type ResolvedAction =
  | { kind: "promoteTopic"; topicId: string }
  | { kind: "generateDraftPackage"; projectId: string }
  | { kind: "generatePlatformPackage"; projectId: string }
  | { kind: "recordManualPublish"; platformPackageId: string }
  | { kind: "generateReviewReport"; publishRecordId: string }
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

  if (action.kind === "generateReviewReport") {
    return flags.isGeneratingReviewReport
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
