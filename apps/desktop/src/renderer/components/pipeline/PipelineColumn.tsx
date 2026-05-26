import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import type { PipelineCardViewModel, PipelineColumnViewModel, PipelineItem } from "../../pipeline/pipeline-model"
import { PipelineCard } from "./PipelineCard"

type PipelineColumnProps = {
  column: PipelineColumnViewModel
  selectedItem: PipelineItem | null
  onSelectItem: (item: PipelineItem) => void
}

export function PipelineColumn({ column, selectedItem, onSelectItem }: PipelineColumnProps): ReactElement {
  const t = useTranslation()

  return (
    <section aria-labelledby={`pipeline-column-${column.stage}`} className="pipeline-column">
      <header className="pipeline-column__header">
        <div>
          <h2 id={`pipeline-column-${column.stage}`}>{t(column.titleKey as TranslationKey)}</h2>
          <p>{t(stageDescriptionKey(column.stage))}</p>
        </div>
        <span className="pipeline-column__count">{column.items.length}</span>
      </header>
      {column.items.length > 0 ? (
        <div className="pipeline-column__cards">
          {column.items.map((card) => (
            <PipelineCard
              card={card}
              isSelected={isSamePipelineItem(card.item, selectedItem)}
              key={pipelineCardKey(card)}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      ) : (
        <p className="pipeline-column__empty">{t(stageEmptyKey(column.stage))}</p>
      )}
    </section>
  )
}

function pipelineCardKey(card: PipelineCardViewModel): string {
  return card.item.kind === "topic"
    ? `topic-${card.item.topicId}`
    : `project-${card.item.projectId}`
}

function isSamePipelineItem(left: PipelineItem, right: PipelineItem | null): boolean {
  if (!right || left.kind !== right.kind) {
    return false
  }

  if (left.kind === "topic" && right.kind === "topic") {
    return left.topicId === right.topicId
  }

  if (left.kind === "project" && right.kind === "project") {
    return left.projectId === right.projectId
  }

  return false
}

function stageDescriptionKey(stage: PipelineColumnViewModel["stage"]): TranslationKey {
  return `pipeline.stage.${stage}Description` as TranslationKey
}

function stageEmptyKey(stage: PipelineColumnViewModel["stage"]): TranslationKey {
  return `pipeline.empty.${stage}` as TranslationKey
}
