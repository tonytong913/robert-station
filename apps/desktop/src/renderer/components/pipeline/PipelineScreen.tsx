import { useMemo, type ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { buildPipelineColumns, resolvePipelineDetail } from "../../pipeline/pipeline-model"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { PipelineBoard } from "./PipelineBoard"
import { PipelineDetailPanel } from "./PipelineDetailPanel"
import { PipelineFilters } from "./PipelineFilters"

export function PipelineScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const selectedPipelineItem = useContentLoopStore((state) => state.selectedPipelineItem)
  const pipelineColumnFilter = useContentLoopStore((state) => state.pipelineColumnFilter)
  const pipelinePlatformFilter = useContentLoopStore((state) => state.pipelinePlatformFilter)
  const pipelineStageFilter = useContentLoopStore((state) => state.pipelineStageFilter)
  const pipelineSearchQuery = useContentLoopStore((state) => state.pipelineSearchQuery)
  const isGeneratingTopics = useContentLoopStore((state) => state.isGeneratingTopics)
  const isPromotingTopic = useContentLoopStore((state) => state.isPromotingTopic)
  const isGeneratingDraftPackage = useContentLoopStore((state) => state.isGeneratingDraftPackage)
  const isGeneratingPlatformPackage = useContentLoopStore((state) => state.isGeneratingPlatformPackage)
  const isSavingPublishRecord = useContentLoopStore((state) => state.isSavingPublishRecord)
  const isGeneratingReviewReport = useContentLoopStore((state) => state.isGeneratingReviewReport)
  const isArchivingProject = useContentLoopStore((state) => state.isArchivingProject)
  const selectPipelineItem = useContentLoopStore((state) => state.selectPipelineItem)
  const setPipelineColumnFilter = useContentLoopStore((state) => state.setPipelineColumnFilter)
  const setPipelinePlatformFilter = useContentLoopStore((state) => state.setPipelinePlatformFilter)
  const setPipelineStageFilter = useContentLoopStore((state) => state.setPipelineStageFilter)
  const setPipelineSearchQuery = useContentLoopStore((state) => state.setPipelineSearchQuery)
  const generateTopics = useContentLoopStore((state) => state.generateTopics)
  const promoteTopic = useContentLoopStore((state) => state.promoteTopic)
  const generateDraftPackage = useContentLoopStore((state) => state.generateDraftPackage)
  const generatePlatformPackage = useContentLoopStore((state) => state.generatePlatformPackage)
  const recordManualPublish = useContentLoopStore((state) => state.recordManualPublish)
  const generateReviewReport = useContentLoopStore((state) => state.generateReviewReport)
  const archiveProject = useContentLoopStore((state) => state.archiveProject)
  const t = useTranslation()
  const filters = useMemo(
    () => ({
      columnSlug: pipelineColumnFilter,
      platform: pipelinePlatformFilter,
      stage: pipelineStageFilter,
      query: pipelineSearchQuery
    }),
    [pipelineColumnFilter, pipelinePlatformFilter, pipelineSearchQuery, pipelineStageFilter]
  )
  const columns = useMemo(() => buildPipelineColumns(contentLoop, filters), [contentLoop, filters])
  const detail = useMemo(
    () => resolvePipelineDetail(contentLoop, selectedPipelineItem),
    [contentLoop, selectedPipelineItem]
  )

  return (
    <section className="pipeline-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        <h1>{t("pipeline.title")}</h1>
      </div>
      <PipelineFilters
        columnFilter={pipelineColumnFilter}
        isGeneratingTopics={isGeneratingTopics}
        onColumnFilterChange={setPipelineColumnFilter}
        onGenerateTopics={() => void generateTopics()}
        onPlatformFilterChange={setPipelinePlatformFilter}
        onSearchQueryChange={setPipelineSearchQuery}
        onStageFilterChange={setPipelineStageFilter}
        platformFilter={pipelinePlatformFilter}
        searchQuery={pipelineSearchQuery}
        stageFilter={pipelineStageFilter}
      />
      <div className="pipeline-screen__workspace">
        <PipelineBoard columns={columns} onSelectItem={selectPipelineItem} selectedItem={selectedPipelineItem} />
        <PipelineDetailPanel
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
      </div>
    </section>
  )
}
