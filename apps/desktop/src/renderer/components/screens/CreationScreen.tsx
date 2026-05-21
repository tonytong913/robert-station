import type { PlatformPackage } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { EmptyState } from "../shared/EmptyState"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"

export function CreationScreen(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const selectedProject = useContentLoopStore((state) => state.selectedProject)
  const selectedDraft = useContentLoopStore((state) => state.selectedDraft)
  const selectedXiaohongshuPackage = useContentLoopStore((state) => state.selectedXiaohongshuPackage)
  const selectedArchiveRecord = useContentLoopStore((state) => state.selectedArchiveRecord)
  const isGeneratingDraftPackage = useContentLoopStore((state) => state.isGeneratingDraftPackage)
  const isGeneratingPlatformPackage = useContentLoopStore((state) => state.isGeneratingPlatformPackage)
  const isArchivingProject = useContentLoopStore((state) => state.isArchivingProject)
  const draftPackageError = useContentLoopStore((state) => state.draftPackageError)
  const platformPackageError = useContentLoopStore((state) => state.platformPackageError)
  const archiveError = useContentLoopStore((state) => state.archiveError)
  const generateDraftPackage = useContentLoopStore((state) => state.generateDraftPackage)
  const generatePlatformPackage = useContentLoopStore((state) => state.generatePlatformPackage)
  const archiveProject = useContentLoopStore((state) => state.archiveProject)
  const setScreen = useContentLoopStore((state) => state.setScreen)
  const t = useTranslation()

  if (!selectedProject || !selectedDraft) {
    return <EmptyState title={t("creation.empty")} />
  }

  const selectedProjectId = selectedProject.id
  const sourceReferences =
    contentLoop?.sourceReferences.filter(
      (source) => source.contentProjectId === selectedProjectId || source.topicId === selectedProject.sourceTopicId
    ) ?? []

  async function handleGeneratePlatformPackage(): Promise<void> {
    await generatePlatformPackage(selectedProjectId)
    setScreen("creation")
  }

  return (
    <section className="creation-screen">
      <div className="screen-heading">
        <p className="eyebrow">{selectedProject.status}</p>
        <h1>{t("creation.title")}</h1>
      </div>
      <div className="creation-studio">
        <div className="creation-actions">
          <Button disabled={isGeneratingDraftPackage} onClick={() => void generateDraftPackage(selectedProjectId)}>
            {isGeneratingDraftPackage ? t("creation.generating") : t("creation.generateDraft")}
          </Button>
          <Button disabled={isGeneratingPlatformPackage} onClick={() => void handleGeneratePlatformPackage()}>
            {isGeneratingPlatformPackage ? t("creation.generating") : t("creation.generatePlatform")}
          </Button>
          <Button disabled={isArchivingProject} onClick={() => void archiveProject(selectedProjectId)}>
            {isArchivingProject ? t("creation.archiving") : t("creation.archive")}
          </Button>
        </div>
        {draftPackageError ? <p className="inline-error" role="alert">{t(draftPackageError as TranslationKey)}</p> : null}
        {platformPackageError ? <p className="inline-error" role="alert">{t(platformPackageError as TranslationKey)}</p> : null}
        {archiveError ? <p className="inline-error" role="alert">{t(archiveError as TranslationKey)}</p> : null}
        <Panel className="draft-panel">
          <div className="topic-card__meta">
            <StatusBadge>{t("creation.draftVersion", { version: selectedDraft.version })}</StatusBadge>
          </div>
          <h2>{selectedDraft.title}</h2>
          <div className="draft-section-list">{renderDraftBody(selectedDraft.body)}</div>
        </Panel>
        <Panel className="source-panel" title={t("creation.sources")}>
          {sourceReferences.length > 0 ? (
            sourceReferences.map((source) => (
              <article key={source.id}>
                <h3>{source.title}</h3>
                <p>{source.note}</p>
                {source.url ? <a href={source.url}>{source.url}</a> : null}
              </article>
            ))
          ) : (
            <p>{t("creation.sources")}</p>
          )}
        </Panel>
        {selectedXiaohongshuPackage ? (
          <XiaohongshuPackagePanel platformPackage={selectedXiaohongshuPackage} />
        ) : (
          <EmptyState className="publish-package-panel" title={t("package.noPackage")} />
        )}
        <Panel className="archive-status-panel" title={t("creation.archiveTitle")}>
          {selectedArchiveRecord ? (
            <>
              <StatusBadge tone="success">{t("creation.archived")}</StatusBadge>
              <p>{selectedArchiveRecord.summary}</p>
            </>
          ) : (
            <p>{t("creation.notArchived")}</p>
          )}
        </Panel>
      </div>
    </section>
  )
}

function XiaohongshuPackagePanel({ platformPackage }: { platformPackage: PlatformPackage }): ReactElement {
  const t = useTranslation()

  return (
    <Panel className="publish-package-panel">
      <h2>{t("package.title")}</h2>
      <section>
        <h3>{t("package.fieldTitle")}</h3>
        <p>{platformPackage.title}</p>
      </section>
      <section>
        <h3>{t("package.body")}</h3>
        <p>{platformPackage.body}</p>
      </section>
      <section>
        <h3>{t("package.tags")}</h3>
        <p>{platformPackage.tags.join(" ")}</p>
      </section>
      <section>
        <h3>{t("package.coverText")}</h3>
        <p>{platformPackage.coverText}</p>
      </section>
      <section>
        <h3>{t("package.requiredAssets")}</h3>
        <ul>
          {platformPackage.requiredAssets.map((asset) => (
            <li key={asset}>{asset}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>{t("package.checks")}</h3>
        <ul>
          {platformPackage.checks.map((check) => (
            <li key={check.name}>{check.message}</li>
          ))}
        </ul>
      </section>
    </Panel>
  )
}

function renderDraftBody(body: string): ReactElement[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) =>
      isDraftSectionHeading(line) ? (
        <h3 className="draft-section" key={`${line}-${index}`}>
          {line}
        </h3>
      ) : (
        <p key={`${line}-${index}`}>{line}</p>
      )
    )
}

function isDraftSectionHeading(line: string): boolean {
  return !line.includes(":") && !/^\d+\./.test(line) && !line.startsWith("#") && line.length <= 32
}
