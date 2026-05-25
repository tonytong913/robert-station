import type { ContentColumnSlug, KnowledgeItem, SourceReference } from "@robert-station/core"
import type { FormEvent, ReactElement } from "react"
import { useState } from "react"
import { type TranslationKey, useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { EmptyState } from "../shared/EmptyState"
import { FieldGroup } from "../shared/FieldGroup"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"

export function KnowledgeScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const knowledgeItems = useContentLoopStore((state) => state.contentLoop?.knowledgeItems ?? [])
  const sourceReferences = useContentLoopStore((state) => state.contentLoop?.sourceReferences ?? [])
  const isAddingSourceReference = useContentLoopStore((state) => state.isAddingSourceReference)
  const isCreatingExport = useContentLoopStore((state) => state.isCreatingExport)
  const sourceLibraryError = useContentLoopStore((state) => state.sourceLibraryError)
  const exportError = useContentLoopStore((state) => state.exportError)
  const lastExportFile = useContentLoopStore((state) => state.lastExportFile)
  const addSourceReference = useContentLoopStore((state) => state.addSourceReference)
  const createContentLoopExport = useContentLoopStore((state) => state.createContentLoopExport)
  const [sourceTitle, setSourceTitle] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [sourceNote, setSourceNote] = useState("")
  const [sourceColumn, setSourceColumn] = useState<ContentColumnSlug>("ai")
  const t = useTranslation()
  const workspaceId = contentLoop?.topics[0]?.workspaceId ?? "workspace_robert-station"

  const handleAddSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!sourceTitle.trim()) {
      return
    }

    await addSourceReference({
      workspaceId,
      columnSlug: sourceColumn,
      title: sourceTitle,
      ...(sourceUrl ? { url: sourceUrl } : {}),
      note: sourceNote
    })
    setSourceTitle("")
    setSourceUrl("")
    setSourceNote("")
  }

  return (
    <section className="knowledge-screen">
      <div className="screen-heading">
        <p className="eyebrow">knowledge</p>
        <h1>{t("knowledge.title")}</h1>
      </div>
      <Panel aria-label={t("knowledge.sources")}>
        <div className="screen-heading screen-heading--compact">
          <p className="eyebrow">source library</p>
          <h2>{t("knowledge.sources")}</h2>
        </div>
        <form className="source-library-form" onSubmit={handleAddSource}>
          <FieldGroup label={t("knowledge.sourceTitle")}>
            <input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceUrl")}>
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceColumn")}>
            <select value={sourceColumn} onChange={(event) => setSourceColumn(event.target.value as ContentColumnSlug)}>
              <option value="ai">AI</option>
              <option value="finance">Finance</option>
              <option value="parenting">Parenting</option>
              <option value="fitness">Fitness</option>
            </select>
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceNote")}>
            <textarea value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} />
          </FieldGroup>
          <div className="source-library-actions">
            <Button disabled={isAddingSourceReference || !sourceTitle.trim()} type="submit">
              {isAddingSourceReference ? t("knowledge.addingSource") : t("knowledge.addSource")}
            </Button>
            <Button
              disabled={isCreatingExport}
              onClick={() => void createContentLoopExport("markdown")}
              type="button"
              variant="secondary"
            >
              {isCreatingExport ? t("knowledge.exporting") : t("knowledge.exportMarkdown")}
            </Button>
          </div>
        </form>
        {sourceLibraryError ? <p className="inline-error" role="alert">{t(sourceLibraryError as TranslationKey)}</p> : null}
        {exportError ? <p className="inline-error" role="alert">{t(exportError as TranslationKey)}</p> : null}
        {lastExportFile ? <p>{t("knowledge.lastExport", { fileName: lastExportFile.fileName })}</p> : null}
        <div className="source-library-list">
          {sourceReferences.map((source) => (
            <SourceReferenceRow key={source.id} source={source} />
          ))}
        </div>
      </Panel>
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

function SourceReferenceRow({ source }: { source: SourceReference }): ReactElement {
  return (
    <article className="source-reference-row" aria-label={source.title}>
      <div>
        <strong>{source.title}</strong>
        {source.url ? <p>{source.url}</p> : null}
      </div>
      <div className="workspace-header__meta">
        {source.columnSlug ? <StatusBadge>{source.columnSlug}</StatusBadge> : null}
        <StatusBadge>{source.usageStatus ?? "unused"}</StatusBadge>
      </div>
    </article>
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
