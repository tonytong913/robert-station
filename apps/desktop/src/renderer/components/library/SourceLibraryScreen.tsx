import type { ContentColumnSlug, Platform, SourceReference } from "@robert-station/core"
import type { FormEvent, ReactElement } from "react"
import { useState } from "react"
import { type TranslationKey, useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { FieldGroup } from "../shared/FieldGroup"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"

export function SourceLibraryScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const sourceReferences = useContentLoopStore((state) => state.contentLoop?.sourceReferences ?? [])
  const isAddingSourceReference = useContentLoopStore((state) => state.isAddingSourceReference)
  const sourceLibraryError = useContentLoopStore((state) => state.sourceLibraryError)
  const addSourceReference = useContentLoopStore((state) => state.addSourceReference)
  const filterSourceReferences = useContentLoopStore((state) => state.filterSourceReferences)
  const createTopicFromSourceReference = useContentLoopStore((state) => state.createTopicFromSourceReference)
  const [sourceTitle, setSourceTitle] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [sourceNote, setSourceNote] = useState("")
  const [sourceColumn, setSourceColumn] = useState<ContentColumnSlug>("ai")
  const [sourcePlatform, setSourcePlatform] = useState<Platform>("xiaohongshu")
  const [sourceAuthor, setSourceAuthor] = useState("")
  const [sourceTags, setSourceTags] = useState("")
  const [sourceExcerpt, setSourceExcerpt] = useState("")
  const [sourceSearch, setSourceSearch] = useState("")
  const [filterColumn, setFilterColumn] = useState<ContentColumnSlug | "all">("all")
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all")
  const [filterTag, setFilterTag] = useState("")
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
      platform: sourcePlatform,
      ...(sourceAuthor ? { author: sourceAuthor } : {}),
      ...(sourceExcerpt ? { excerpt: sourceExcerpt } : {}),
      tags: sourceTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      note: sourceNote
    })
    setSourceTitle("")
    setSourceUrl("")
    setSourceAuthor("")
    setSourceTags("")
    setSourceExcerpt("")
    setSourceNote("")
  }

  return (
    <section className="knowledge-screen">
      <div className="screen-heading">
        <p className="eyebrow">source library</p>
        <h1>{t("sources.title")}</h1>
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
          <FieldGroup label={t("knowledge.sourcePlatform")}>
            <select value={sourcePlatform} onChange={(event) => setSourcePlatform(event.target.value as Platform)}>
              <option value="xiaohongshu">xiaohongshu</option>
              <option value="douyin">douyin</option>
              <option value="wechat_channels">wechat_channels</option>
              <option value="bilibili">bilibili</option>
            </select>
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceAuthor")}>
            <input value={sourceAuthor} onChange={(event) => setSourceAuthor(event.target.value)} />
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceTags")}>
            <input value={sourceTags} onChange={(event) => setSourceTags(event.target.value)} />
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceExcerpt")}>
            <textarea value={sourceExcerpt} onChange={(event) => setSourceExcerpt(event.target.value)} />
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceNote")}>
            <textarea value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} />
          </FieldGroup>
          <div className="source-library-actions">
            <Button disabled={isAddingSourceReference || !sourceTitle.trim()} type="submit">
              {isAddingSourceReference ? t("knowledge.addingSource") : t("knowledge.addSource")}
            </Button>
          </div>
        </form>
        {sourceLibraryError ? <p className="inline-error" role="alert">{t(sourceLibraryError as TranslationKey)}</p> : null}
        <div className="source-library-filter">
          <FieldGroup label={t("knowledge.sourceSearch")}>
            <input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} />
          </FieldGroup>
          <FieldGroup label={t("knowledge.sourceColumn")}>
            <select value={filterColumn} onChange={(event) => setFilterColumn(event.target.value as ContentColumnSlug | "all")}>
              <option value="all">All</option>
              <option value="ai">AI</option>
              <option value="finance">Finance</option>
              <option value="parenting">Parenting</option>
              <option value="fitness">Fitness</option>
            </select>
          </FieldGroup>
          <FieldGroup label={t("knowledge.filterPlatform")}>
            <select value={filterPlatform} onChange={(event) => setFilterPlatform(event.target.value as Platform | "all")}>
              <option value="all">All</option>
              <option value="xiaohongshu">xiaohongshu</option>
              <option value="douyin">douyin</option>
              <option value="wechat_channels">wechat_channels</option>
              <option value="bilibili">bilibili</option>
            </select>
          </FieldGroup>
          <FieldGroup label={t("knowledge.filterTag")}>
            <input value={filterTag} onChange={(event) => setFilterTag(event.target.value)} />
          </FieldGroup>
          <Button
            disabled={isAddingSourceReference}
            onClick={() =>
              void filterSourceReferences({
                ...(filterColumn !== "all" ? { columnSlug: filterColumn } : {}),
                ...(filterPlatform !== "all" ? { platform: filterPlatform } : {}),
                ...(filterTag ? { tag: filterTag } : {}),
                ...(sourceSearch ? { query: sourceSearch } : {})
              })
            }
            type="button"
            variant="secondary"
          >
            {t("knowledge.filterSources")}
          </Button>
        </div>
        <div className="source-library-list">
          {sourceReferences.map((source) => (
            <SourceReferenceRow
              key={source.id}
              onCreateTopic={() => void createTopicFromSourceReference(source.id)}
              source={source}
            />
          ))}
        </div>
      </Panel>
    </section>
  )
}

function SourceReferenceRow({
  onCreateTopic,
  source
}: {
  onCreateTopic: () => void
  source: SourceReference
}): ReactElement {
  const t = useTranslation()

  return (
    <article className="source-reference-row" aria-label={source.title}>
      <div>
        <strong>{source.title}</strong>
        {source.url ? <p>{source.url}</p> : null}
        {source.author ? <p>{source.author}</p> : null}
        {source.excerpt ? <p>{source.excerpt}</p> : null}
      </div>
      <div className="workspace-header__meta">
        {source.columnSlug ? <StatusBadge>{source.columnSlug}</StatusBadge> : null}
        {source.platform ? <StatusBadge>{source.platform}</StatusBadge> : null}
        {(source.tags ?? []).map((tag) => (
          <StatusBadge key={tag}>{tag}</StatusBadge>
        ))}
        <StatusBadge>{source.usageStatus ?? "unused"}</StatusBadge>
        <Button onClick={onCreateTopic} type="button" variant="secondary">
          {t("knowledge.createTopic")}
        </Button>
      </div>
    </article>
  )
}
