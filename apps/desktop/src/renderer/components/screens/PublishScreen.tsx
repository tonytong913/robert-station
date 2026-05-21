import type { MetricImportPreviewRow, MetricSnapshot, PlatformPackage, PublishRecord } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { EmptyState } from "../shared/EmptyState"
import { FieldGroup } from "../shared/FieldGroup"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"

export function PublishScreen(): ReactElement {
  const selectedXiaohongshuPackage = useContentLoopStore((state) => state.selectedXiaohongshuPackage)
  const selectedPublishRecord = useContentLoopStore((state) => state.selectedPublishRecord)
  const selectedLatestMetricSnapshot = useContentLoopStore((state) => state.selectedLatestMetricSnapshot)
  const manualPublishDraft = useContentLoopStore((state) => state.manualPublishDraft)
  const matchedMetricImportPreviewRows = useContentLoopStore((state) => state.matchedMetricImportPreviewRows)
  const invalidMetricImportPreviewRows = useContentLoopStore((state) => state.invalidMetricImportPreviewRows)
  const isSavingPublishRecord = useContentLoopStore((state) => state.isSavingPublishRecord)
  const isImportingMetrics = useContentLoopStore((state) => state.isImportingMetrics)
  const isSavingMetricImport = useContentLoopStore((state) => state.isSavingMetricImport)
  const publishRecordError = useContentLoopStore((state) => state.publishRecordError)
  const metricImportError = useContentLoopStore((state) => state.metricImportError)
  const metricSaveError = useContentLoopStore((state) => state.metricSaveError)
  const setManualPublishDraft = useContentLoopStore((state) => state.setManualPublishDraft)
  const recordManualPublish = useContentLoopStore((state) => state.recordManualPublish)
  const importMetricCsv = useContentLoopStore((state) => state.importMetricCsv)
  const saveMetricImport = useContentLoopStore((state) => state.saveMetricImport)
  const t = useTranslation()

  if (!selectedXiaohongshuPackage) {
    return <EmptyState title={t("publish.empty")} />
  }

  return (
    <section className="publish-screen">
      <div className="screen-heading">
        <p className="eyebrow">xiaohongshu</p>
        <h1>{t("publish.title")}</h1>
      </div>
      <div className="creation-studio">
        <XiaohongshuPackagePanel platformPackage={selectedXiaohongshuPackage} />
        <Panel title={t("publish.manual")}>
          <div className="creation-actions">
            <FieldGroup label={t("publish.publishedAt")}>
              <input
                type="datetime-local"
                value={manualPublishDraft.publishedAt}
                onChange={(event) => setManualPublishDraft({ publishedAt: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label={t("publish.url")}>
              <input
                type="url"
                value={manualPublishDraft.url}
                onChange={(event) => setManualPublishDraft({ url: event.target.value })}
              />
            </FieldGroup>
            <FieldGroup label={t("publish.note")}>
              <textarea
                value={manualPublishDraft.note}
                onChange={(event) => setManualPublishDraft({ note: event.target.value })}
              />
            </FieldGroup>
          </div>
          <Button
            disabled={isSavingPublishRecord}
            onClick={() => void recordManualPublish(selectedXiaohongshuPackage.id)}
          >
            {isSavingPublishRecord ? t("publish.saving") : t("publish.save")}
          </Button>
          {publishRecordError ? (
            <p className="inline-error" role="alert">
              {t(publishRecordError as TranslationKey)}
            </p>
          ) : null}
        </Panel>
        {selectedPublishRecord ? (
          <>
            <PublishRecordSummary publishRecord={selectedPublishRecord} />
            <MetricSnapshotPanel snapshot={selectedLatestMetricSnapshot} />
            <MetricsImportPanel
              matchedRows={matchedMetricImportPreviewRows}
              invalidRows={invalidMetricImportPreviewRows}
              isImportingMetrics={isImportingMetrics}
              isSavingMetricImport={isSavingMetricImport}
              metricImportError={metricImportError}
              metricSaveError={metricSaveError}
              importMetricCsv={importMetricCsv}
              saveMetricImport={saveMetricImport}
            />
          </>
        ) : null}
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

function PublishRecordSummary({ publishRecord }: { publishRecord: PublishRecord }): ReactElement {
  const t = useTranslation()

  return (
    <Panel>
      <StatusBadge tone="success">{t("publish.saved")}</StatusBadge>
      <p>{publishRecord.url || t("publish.noUrl")}</p>
      {publishRecord.note ? <p>{publishRecord.note}</p> : null}
      <p>{publishRecord.publishedAt}</p>
    </Panel>
  )
}

function MetricSnapshotPanel({ snapshot }: { snapshot: MetricSnapshot | null }): ReactElement {
  const t = useTranslation()

  if (!snapshot) {
    return <Panel title={t("metrics.importTitle")}><p>{t("metrics.snapshot")}</p></Panel>
  }

  return (
    <Panel title={t("metrics.importTitle")}>
      <dl>
        <dt>{t("metrics.views")}</dt>
        <dd>{snapshot.views}</dd>
        <dt>{t("metrics.likes")}</dt>
        <dd>{snapshot.likes}</dd>
        <dt>{t("metrics.favorites")}</dt>
        <dd>{snapshot.favorites}</dd>
        <dt>{t("metrics.comments")}</dt>
        <dd>{snapshot.comments}</dd>
        <dt>{t("metrics.shares")}</dt>
        <dd>{snapshot.shares}</dd>
      </dl>
    </Panel>
  )
}

type MetricsImportPanelProps = {
  matchedRows: MetricImportPreviewRow[]
  invalidRows: MetricImportPreviewRow[]
  isImportingMetrics: boolean
  isSavingMetricImport: boolean
  metricImportError: string | null
  metricSaveError: string | null
  importMetricCsv: () => Promise<void>
  saveMetricImport: () => Promise<void>
}

function MetricsImportPanel({
  matchedRows,
  invalidRows,
  isImportingMetrics,
  isSavingMetricImport,
  metricImportError,
  metricSaveError,
  importMetricCsv,
  saveMetricImport
}: MetricsImportPanelProps): ReactElement {
  const t = useTranslation()

  return (
    <Panel title={t("metrics.importTitle")}>
      <Button disabled={isImportingMetrics} onClick={() => void importMetricCsv()}>
        {isImportingMetrics ? t("metrics.importing") : t("metrics.importCsv")}
      </Button>
      {metricImportError ? (
        <p className="inline-error" role="alert">
          {t(metricImportError as TranslationKey)}
        </p>
      ) : null}
      {metricSaveError ? (
        <p className="inline-error" role="alert">
          {t(metricSaveError as TranslationKey)}
        </p>
      ) : null}
      {matchedRows.length > 0 ? (
        <>
          <p>{t("metrics.previewMatched", { count: matchedRows.length })}</p>
          <ul>
            {matchedRows.map((row) => (
              <li key={`${row.rowNumber}-${row.url}`}>
                {t("metrics.row", { row: row.rowNumber, value: row.url || (row.publishRecordId ?? "") })}
              </li>
            ))}
          </ul>
          <Button disabled={isSavingMetricImport} onClick={() => void saveMetricImport()}>
            {isSavingMetricImport ? t("metrics.saving") : t("metrics.saveImported")}
          </Button>
        </>
      ) : null}
      {invalidRows.length > 0 ? (
        <>
          <p>{t("metrics.previewInvalid", { count: invalidRows.length })}</p>
          <ul>
            {invalidRows.map((row) => (
              <li key={`${row.rowNumber}-${row.error ?? "invalid"}`}>
                {t("metrics.row", { row: row.rowNumber, value: row.error ?? "" })}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  )
}
