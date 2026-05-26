import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import type {
  PipelineContentLoopState,
  PipelineDetailViewModel
} from "../../pipeline/pipeline-model"
import { EmptyState } from "../shared/EmptyState"
import { StatusBadge } from "../shared/StatusBadge"
import { PipelineStageActions } from "./PipelineStageActions"

type PipelineDetailPanelProps = {
  detail: PipelineDetailViewModel | null
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

export function PipelineDetailPanel({
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
}: PipelineDetailPanelProps): ReactElement {
  const t = useTranslation()

  if (!detail) {
    return <EmptyState className="pipeline-detail-panel" title={t("pipeline.noSelection")} />
  }

  return (
    <aside aria-labelledby="pipeline-detail-title" className="pipeline-detail-panel">
      <div className="pipeline-detail-panel__header">
        <StatusBadge tone={detail.stage === "published" || detail.stage === "learning" ? "success" : "neutral"}>
          {t(detail.statusLabelKey as TranslationKey)}
        </StatusBadge>
        <h2 id="pipeline-detail-title">{detail.title}</h2>
        <p>{detail.description}</p>
      </div>
      <PipelineStageActions
        archiveProject={archiveProject}
        contentLoop={contentLoop}
        detail={detail}
        generateDraftPackage={generateDraftPackage}
        generatePlatformPackage={generatePlatformPackage}
        generateReviewReport={generateReviewReport}
        isArchivingProject={isArchivingProject}
        isGeneratingDraftPackage={isGeneratingDraftPackage}
        isGeneratingPlatformPackage={isGeneratingPlatformPackage}
        isGeneratingReviewReport={isGeneratingReviewReport}
        isPromotingTopic={isPromotingTopic}
        isSavingPublishRecord={isSavingPublishRecord}
        promoteTopic={promoteTopic}
        recordManualPublish={recordManualPublish}
      />
      <div className="pipeline-detail-panel__sections">
        {detail.sections.map((section) => (
          <section key={section.titleKey}>
            <h3>{t(section.titleKey as TranslationKey)}</h3>
            <dl>
              {section.items.map((item) => (
                <div key={`${item.labelKey}-${item.value}`}>
                  <dt>{detailLabel(item.labelKey, t)}</dt>
                  <dd>{item.value || "-"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  )
}

function detailLabel(
  labelKey: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  const knownLabels: Record<string, TranslationKey> = {
    "pipeline.detail.hook": "pipeline.detail.topic",
    "pipeline.detail.audience": "header.eyebrow",
    "pipeline.detail.status": "common.status",
    "pipeline.detail.score.heat": "common.heat",
    "pipeline.detail.score.fit": "common.fit",
    "pipeline.detail.score.difficulty": "common.difficulty",
    "pipeline.detail.score.personaConsistency": "dashboard.workflowHealth",
    "pipeline.detail.sourceTopic": "topics.title",
    "pipeline.detail.version": "creation.draftVersion",
    "pipeline.detail.title": "package.fieldTitle",
    "pipeline.detail.updatedAt": "review.generatedAt",
    "pipeline.detail.platform": "pipeline.filters.platform",
    "pipeline.detail.url": "publish.url",
    "pipeline.detail.publishedAt": "publish.publishedAt",
    "pipeline.detail.summary": "review.title"
  }
  const knownKey = knownLabels[labelKey]

  return knownKey ? t(knownKey, { version: "", time: "" }).trim() : labelKey
}
