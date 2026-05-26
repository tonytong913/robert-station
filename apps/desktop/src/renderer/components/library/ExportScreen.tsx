import type { ReactElement } from "react"
import { type TranslationKey, useTranslation } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { Panel } from "../shared/Panel"

export function ExportScreen(): ReactElement {
  const isCreatingExport = useContentLoopStore((state) => state.isCreatingExport)
  const exportError = useContentLoopStore((state) => state.exportError)
  const lastExportFile = useContentLoopStore((state) => state.lastExportFile)
  const createContentLoopExport = useContentLoopStore((state) => state.createContentLoopExport)
  const t = useTranslation()

  return (
    <section className="knowledge-screen">
      <div className="screen-heading">
        <p className="eyebrow">export center</p>
        <h1>{t("exports.title")}</h1>
      </div>
      <Panel aria-label={t("exports.title")}>
        <div className="source-library-actions">
          <Button
            disabled={isCreatingExport}
            onClick={() => void createContentLoopExport("markdown")}
            type="button"
          >
            {isCreatingExport ? t("knowledge.exporting") : t("knowledge.exportMarkdown")}
          </Button>
        </div>
        {exportError ? <p className="inline-error" role="alert">{t(exportError as TranslationKey)}</p> : null}
        {lastExportFile ? <p>{t("knowledge.lastExport", { fileName: lastExportFile.fileName })}</p> : null}
      </Panel>
    </section>
  )
}
