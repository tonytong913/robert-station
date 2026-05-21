import type { KnowledgeItem } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { EmptyState } from "../shared/EmptyState"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"

export function KnowledgeScreen(): ReactElement {
  const knowledgeItems = useContentLoopStore((state) => state.contentLoop?.knowledgeItems ?? [])
  const t = useTranslation()

  return (
    <section className="knowledge-screen">
      <div className="screen-heading">
        <p className="eyebrow">knowledge</p>
        <h1>{t("knowledge.title")}</h1>
      </div>
      {knowledgeItems.length === 0 ? (
        <EmptyState title={t("knowledge.empty")} />
      ) : (
        <div className="creation-studio">
          {knowledgeItems.map((item) => (
            <KnowledgeItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}

function KnowledgeItemCard({ item }: { item: KnowledgeItem }): ReactElement {
  return (
    <Panel aria-label={item.title}>
      <p className="eyebrow">{item.columnSlug}</p>
      <h2>{item.title}</h2>
      <div className="workspace-header__meta">
        {item.tags.map((tag) => (
          <StatusBadge key={tag}>{tag}</StatusBadge>
        ))}
      </div>
      <p>{item.lesson}</p>
      <p>{item.evidence}</p>
    </Panel>
  )
}
