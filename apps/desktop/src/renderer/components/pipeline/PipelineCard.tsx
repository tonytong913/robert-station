import type { KeyboardEvent, ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import type { PipelineCardViewModel, PipelineItem } from "../../pipeline/pipeline-model"
import { StatusBadge } from "../shared/StatusBadge"

type PipelineCardProps = {
  card: PipelineCardViewModel
  isSelected: boolean
  onSelect: (item: PipelineItem) => void
}

export function PipelineCard({ card, isSelected, onSelect }: PipelineCardProps): ReactElement {
  const t = useTranslation()

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(card.item)
    }
  }

  return (
    <button
      aria-current={isSelected ? "true" : undefined}
      aria-label={card.title}
      className={["pipeline-card", isSelected ? "pipeline-card--active" : ""].filter(Boolean).join(" ")}
      onClick={() => onSelect(card.item)}
      onKeyDown={handleKeyDown}
      type="button"
    >
      <span className="pipeline-card__meta">
        <StatusBadge tone={statusTone(card.stage)}>{t(card.statusLabelKey as TranslationKey)}</StatusBadge>
        <StatusBadge>{card.columnLabel}</StatusBadge>
      </span>
      <span className="pipeline-card__title">{card.title}</span>
      <span className="pipeline-card__description">{card.description}</span>
      <span className="pipeline-card__metric">
        <span>{metricLabel(card.primaryMetricLabelKey, t)}</span>
        <strong>{card.primaryMetricValue}</strong>
      </span>
      {card.warningLabelKey ? (
        <span className="pipeline-card__warning">{t(card.warningLabelKey as TranslationKey)}</span>
      ) : null}
    </button>
  )
}

function statusTone(stage: PipelineCardViewModel["stage"]): "neutral" | "success" | "warning" {
  if (stage === "published" || stage === "learning") {
    return "success"
  }

  if (stage === "readyToPublish") {
    return "warning"
  }

  return "neutral"
}

function metricLabel(labelKey: string, t: (key: TranslationKey) => string): string {
  if (labelKey === "pipeline.metric.heat") {
    return t("common.heat")
  }

  if (labelKey === "pipeline.metric.artifacts") {
    return t("dashboard.workflowHealth")
  }

  return labelKey
}
