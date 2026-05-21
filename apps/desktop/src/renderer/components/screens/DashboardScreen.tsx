import { DEFAULT_COLUMNS } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Panel } from "../shared/Panel"

export function DashboardScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const t = useTranslation()

  return (
    <section className="dashboard-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("dashboard.workflowHealth")}</p>
        <h1>{t("dashboard.title")}</h1>
      </div>
      <div className="summary-grid">
        {DEFAULT_COLUMNS.map((column) => {
          const columnId = `column_${column.slug}`
          const topicCount = contentLoop?.topics.filter((topic) => topic.columnSlug === column.slug).length ?? 0
          const projects = contentLoop?.projects.filter((project) => project.primaryColumnId === columnId) ?? []
          const draftCount =
            contentLoop?.drafts.filter((draft) =>
              projects.some((project) => project.id === draft.contentProjectId)
            ).length ?? 0
          const publishedCount =
            contentLoop?.publishRecords.filter((record) =>
              projects.some((project) => project.id === record.contentProjectId)
            ).length ?? 0

          return (
            <Panel className="column-card" key={column.slug}>
              <div className="column-card__header">
                <h2>{column.name}</h2>
                <span>{t("common.priority", { priority: column.priority })}</span>
              </div>
              <p>{column.description}</p>
              <dl>
                <div>
                  <dt>{t("dashboard.topics")}</dt>
                  <dd>{topicCount}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.drafts")}</dt>
                  <dd>{draftCount}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.published")}</dt>
                  <dd>{publishedCount}</dd>
                </div>
              </dl>
            </Panel>
          )
        })}
      </div>
    </section>
  )
}
