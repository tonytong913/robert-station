import type { PublishRecord, ReviewReport } from "@robert-station/core"
import type { ReactElement } from "react"
import { useTranslation, type TranslationKey } from "../../i18n"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { Button } from "../shared/Button"
import { EmptyState } from "../shared/EmptyState"
import { Panel } from "../shared/Panel"
import { StatusBadge } from "../shared/StatusBadge"

export function ReviewScreen(): ReactElement {
  const selectedProject = useContentLoopStore((state) => state.selectedProject)
  const selectedPublishRecord = useContentLoopStore((state) => state.selectedPublishRecord)
  const selectedLatestReviewReport = useContentLoopStore((state) => state.selectedLatestReviewReport)
  const isGeneratingReviewReport = useContentLoopStore((state) => state.isGeneratingReviewReport)
  const isExtractingReviewKnowledge = useContentLoopStore((state) => state.isExtractingReviewKnowledge)
  const reviewReportError = useContentLoopStore((state) => state.reviewReportError)
  const reviewKnowledgeError = useContentLoopStore((state) => state.reviewKnowledgeError)
  const reviewKnowledgeResult = useContentLoopStore((state) => state.reviewKnowledgeResult)
  const generateReviewReport = useContentLoopStore((state) => state.generateReviewReport)
  const extractReviewKnowledge = useContentLoopStore((state) => state.extractReviewKnowledge)
  const t = useTranslation()

  if (!selectedPublishRecord) {
    return <EmptyState title={t("review.empty")} />
  }

  return (
    <section className="review-screen">
      <div className="screen-heading">
        <p className="eyebrow">{selectedProject?.status ?? "published"}</p>
        <h1>{t("review.title")}</h1>
      </div>
      <div className="creation-studio">
        <PublishRecordSummary publishRecord={selectedPublishRecord} />
        <Panel>
          <Button
            disabled={isGeneratingReviewReport}
            onClick={() => void generateReviewReport(selectedPublishRecord.id)}
          >
            {isGeneratingReviewReport ? t("review.generating") : t("review.generate")}
          </Button>
          {reviewReportError ? (
            <p className="inline-error" role="alert">
              {t(reviewReportError as TranslationKey)}
            </p>
          ) : null}
        </Panel>
        {selectedLatestReviewReport ? (
          <ReviewReportCard
            report={selectedLatestReviewReport}
            isExtractingReviewKnowledge={isExtractingReviewKnowledge}
            reviewKnowledgeError={reviewKnowledgeError}
            reviewKnowledgeResult={reviewKnowledgeResult}
            extractReviewKnowledge={extractReviewKnowledge}
          />
        ) : null}
      </div>
    </section>
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

type ReviewReportCardProps = {
  report: ReviewReport
  isExtractingReviewKnowledge: boolean
  reviewKnowledgeError: string | null
  reviewKnowledgeResult: { kind: "success" | "blocked"; textKey: "review.knowledgeExtracted" | "review.archiveRequired" } | null
  extractReviewKnowledge: (reviewReportId: string) => Promise<void>
}

function ReviewReportCard({
  report,
  isExtractingReviewKnowledge,
  reviewKnowledgeError,
  reviewKnowledgeResult,
  extractReviewKnowledge
}: ReviewReportCardProps): ReactElement {
  const t = useTranslation()

  return (
    <Panel>
      <StatusBadge>{t("review.reportVersion", { version: report.version })}</StatusBadge>
      <p>{t("review.generatedAt", { time: report.createdAt })}</p>
      <p>{report.summary}</p>
      <ReportList title={t("review.highlights")} items={report.highlights} />
      <ReportList title={t("review.underperforming")} items={report.underperformingSignals} />
      <ReportList title={t("review.causes")} items={report.likelyCauses} />
      <ReportList title={t("review.nextActions")} items={report.nextActions} />
      <Button disabled={isExtractingReviewKnowledge} onClick={() => void extractReviewKnowledge(report.id)}>
        {isExtractingReviewKnowledge ? t("review.extracting") : t("review.extractKnowledge")}
      </Button>
      {reviewKnowledgeResult ? (
        <p role={reviewKnowledgeResult.kind === "success" ? "status" : "alert"}>
          {t(reviewKnowledgeResult.textKey)}
        </p>
      ) : null}
      {reviewKnowledgeError ? (
        <p className="inline-error" role="alert">
          {t(reviewKnowledgeError as TranslationKey)}
        </p>
      ) : null}
    </Panel>
  )
}

function ReportList({ title, items }: { title: string; items: string[] }): ReactElement {
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
