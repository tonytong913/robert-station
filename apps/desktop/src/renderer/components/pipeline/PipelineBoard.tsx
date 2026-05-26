import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import type { PipelineColumnViewModel, PipelineItem } from "../../pipeline/pipeline-model"
import { PipelineColumn } from "./PipelineColumn"

type PipelineBoardProps = {
  columns: PipelineColumnViewModel[]
  selectedItem: PipelineItem | null
  onSelectItem: (item: PipelineItem) => void
}

export function PipelineBoard({ columns, selectedItem, onSelectItem }: PipelineBoardProps): ReactElement {
  const t = useTranslation()

  return (
    <section aria-label={t("pipeline.boardLabel")} className="pipeline-board">
      {columns.map((column) => (
        <PipelineColumn
          column={column}
          key={column.stage}
          onSelectItem={onSelectItem}
          selectedItem={selectedItem}
        />
      ))}
    </section>
  )
}
