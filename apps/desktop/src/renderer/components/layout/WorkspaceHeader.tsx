import { DEFAULT_COLUMNS } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { StatusBadge } from "../shared/StatusBadge"

export function WorkspaceHeader(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const candidateTopicCount = useContentLoopStore((state) => state.candidateTopicCount)
  const activeProjectCount = useContentLoopStore((state) => state.activeProjectCount)
  const selectedProject = useContentLoopStore((state) => state.selectedProject)
  const t = useTranslation()

  const selectedColumn = selectedProject
    ? DEFAULT_COLUMNS.find((column) => `column_${column.slug}` === selectedProject.primaryColumnId) ?? null
    : null
  const publishRecordCount = contentLoop?.publishRecords.length ?? 0
  const knowledgeItemCount = contentLoop?.knowledgeItems.length ?? 0

  return (
    <header className="workspace-header">
      <div className="workspace-header__context">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        {selectedProject ? (
          <div className="workspace-header__project">
            <h1>{selectedProject.title}</h1>
            <div className="workspace-header__badges workspace-header__meta">
              <StatusBadge>{selectedProject.status}</StatusBadge>
              {selectedColumn ? <span>{selectedColumn.name}</span> : null}
            </div>
          </div>
        ) : (
          <div className="workspace-header__project">
            <h1>{t("header.noProject")}</h1>
            <p>{t("header.noProjectHint")}</p>
          </div>
        )}
      </div>
      <div className="workspace-metrics metric-strip" aria-label="Workspace metrics">
        <span>{t("metrics.candidateTopics", { count: candidateTopicCount })}</span>
        <span>{t("metrics.activeProjects", { count: activeProjectCount })}</span>
        <span>{t("metrics.publishedRecords", { count: publishRecordCount })}</span>
        <span>{t("metrics.knowledgeItems", { count: knowledgeItemCount })}</span>
      </div>
    </header>
  )
}
