import { DEFAULT_COLUMNS, type ContentColumnSlug } from "@robert-station/core"
import type { ChangeEvent, ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { EmptyState } from "../shared/EmptyState"
import { StatusBadge } from "../shared/StatusBadge"

export function TopicScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const topicGenerationColumn = useContentLoopStore((state) => state.topicGenerationColumn)
  const isGeneratingTopics = useContentLoopStore((state) => state.isGeneratingTopics)
  const topicGenerationError = useContentLoopStore((state) => state.topicGenerationError)
  const isPromotingTopic = useContentLoopStore((state) => state.isPromotingTopic)
  const promoteTopicError = useContentLoopStore((state) => state.promoteTopicError)
  const setTopicGenerationColumn = useContentLoopStore((state) => state.setTopicGenerationColumn)
  const generateTopics = useContentLoopStore((state) => state.generateTopics)
  const promoteTopic = useContentLoopStore((state) => state.promoteTopic)
  const t = useTranslation()

  const topics = contentLoop?.topics ?? []

  function handleColumnChange(event: ChangeEvent<HTMLSelectElement>): void {
    setTopicGenerationColumn(event.target.value as ContentColumnSlug)
  }

  return (
    <section className="topic-screen">
      <div className="screen-heading">
        <p className="eyebrow">{t("dashboard.workflowHealth")}</p>
        <h1>{t("topics.title")}</h1>
      </div>
      <div className="topic-toolbar">
        <label>
          {t("topics.column")}
          <select onChange={handleColumnChange} value={topicGenerationColumn}>
            {DEFAULT_COLUMNS.map((column) => (
              <option key={column.slug} value={column.slug}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={isGeneratingTopics} onClick={() => void generateTopics()}>
          {isGeneratingTopics ? t("topics.generating") : t("topics.generate")}
        </Button>
      </div>
      {topicGenerationError ? <p className="inline-error" role="alert">{t(topicGenerationError as TranslationKey)}</p> : null}
      {promoteTopicError ? <p className="inline-error" role="alert">{t(promoteTopicError as TranslationKey)}</p> : null}
      {topics.length > 0 ? (
        <div className="topic-grid">
          {topics.map((topic) => {
            const column = DEFAULT_COLUMNS.find((candidate) => candidate.slug === topic.columnSlug)
            const isPromoted = topic.status === "promoted"

            return (
              <article aria-label={topic.title} className="topic-card" key={topic.id}>
                <div className="topic-card__meta">
                  <StatusBadge>{column?.name ?? topic.columnSlug}</StatusBadge>
                  <StatusBadge tone={isPromoted ? "success" : "neutral"}>
                    {isPromoted ? t("topics.promoted") : topic.status}
                  </StatusBadge>
                </div>
                <h2>{topic.title}</h2>
                <p>{topic.hook}</p>
                <dl className="score-grid">
                  <div>
                    <dt>{t("common.heat")}</dt>
                    <dd>{topic.score.heat}</dd>
                  </div>
                  <div>
                    <dt>{t("common.fit")}</dt>
                    <dd>{topic.score.fit}</dd>
                  </div>
                  <div>
                    <dt>{t("common.difficulty")}</dt>
                    <dd>{topic.score.difficulty}</dd>
                  </div>
                </dl>
                <Button disabled={isPromotingTopic || isPromoted} onClick={() => void promoteTopic(topic.id)}>
                  {isPromoted ? t("topics.promoted") : t("topics.promote")}
                </Button>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState title={t("topics.empty")} />
      )}
    </section>
  )
}
