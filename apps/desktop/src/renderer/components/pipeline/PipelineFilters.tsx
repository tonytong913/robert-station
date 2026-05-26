import { DEFAULT_COLUMNS, type ContentColumnSlug, type Platform } from "@robert-station/core"
import type { ChangeEvent, ReactElement } from "react"
import { useTranslation } from "../../i18n"
import type {
  PipelineColumnFilter,
  PipelinePlatformFilter,
  PipelineStageFilter
} from "../../pipeline/pipeline-model"
import { pipelineStages } from "../../pipeline/pipeline-model"
import { Button } from "../shared/Button"

const platforms: Platform[] = ["xiaohongshu", "douyin", "wechat_channels", "bilibili"]

type PipelineFiltersProps = {
  columnFilter: PipelineColumnFilter
  platformFilter: PipelinePlatformFilter
  stageFilter: PipelineStageFilter
  searchQuery: string
  isGeneratingTopics: boolean
  onColumnFilterChange: (columnSlug: PipelineColumnFilter) => void
  onPlatformFilterChange: (platform: PipelinePlatformFilter) => void
  onStageFilterChange: (stage: PipelineStageFilter) => void
  onSearchQueryChange: (query: string) => void
  onGenerateTopics: () => void
}

export function PipelineFilters({
  columnFilter,
  platformFilter,
  stageFilter,
  searchQuery,
  isGeneratingTopics,
  onColumnFilterChange,
  onPlatformFilterChange,
  onStageFilterChange,
  onSearchQueryChange,
  onGenerateTopics
}: PipelineFiltersProps): ReactElement {
  const t = useTranslation()

  function handleColumnChange(event: ChangeEvent<HTMLSelectElement>): void {
    onColumnFilterChange(event.target.value as PipelineColumnFilter)
  }

  function handlePlatformChange(event: ChangeEvent<HTMLSelectElement>): void {
    onPlatformFilterChange(event.target.value as PipelinePlatformFilter)
  }

  function handleStageChange(event: ChangeEvent<HTMLSelectElement>): void {
    onStageFilterChange(event.target.value as PipelineStageFilter)
  }

  return (
    <div className="pipeline-filters">
      <label>
        {t("pipeline.filters.column")}
        <select onChange={handleColumnChange} value={columnFilter}>
          <option value="all">{t("pipeline.filters.all")}</option>
          {DEFAULT_COLUMNS.map((column) => (
            <option key={column.slug} value={column.slug satisfies ContentColumnSlug}>
              {column.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("pipeline.filters.platform")}
        <select onChange={handlePlatformChange} value={platformFilter}>
          <option value="all">{t("pipeline.filters.all")}</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("pipeline.filters.stage")}
        <select onChange={handleStageChange} value={stageFilter}>
          <option value="all">{t("pipeline.filters.all")}</option>
          {pipelineStages.map((stage) => (
            <option key={stage} value={stage}>
              {t(`pipeline.stage.${stage}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("pipeline.filters.search")}
        <input
          onChange={(event) => onSearchQueryChange(event.target.value)}
          type="search"
          value={searchQuery}
        />
      </label>
      <Button disabled={isGeneratingTopics} onClick={onGenerateTopics}>
        {isGeneratingTopics ? t("topics.generating") : t("topics.generate")}
      </Button>
    </div>
  )
}
