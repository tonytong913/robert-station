import { createEntityId } from "./ids";
import type { ArchiveRecord, ContentColumnSlug, ContentProject, KnowledgeItem, MetricSnapshot, ReviewReport } from "./types";

interface GenerateMockReviewKnowledgeItemRequest {
  project: ContentProject;
  archiveRecord: ArchiveRecord;
  reviewReport: ReviewReport;
  metricSnapshot?: MetricSnapshot | null;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-20T00:00:00.000Z");

export function generateMockReviewKnowledgeItem(request: GenerateMockReviewKnowledgeItemRequest): KnowledgeItem {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const columnSlug = resolveColumnSlug(request.project);
  const tags = request.metricSnapshot
    ? [columnSlug, "review", "performance", "metrics"]
    : [columnSlug, "review", "performance"];

  return {
    id: createEntityId("knowledge-item-review", request.reviewReport.id),
    workspaceId: request.reviewReport.workspaceId,
    archiveRecordId: request.archiveRecord.id,
    contentProjectId: request.reviewReport.contentProjectId,
    columnSlug,
    title: `Review lesson: ${request.project.title}`,
    lesson: buildLesson(request.reviewReport),
    evidence: buildEvidence(request.reviewReport, request.metricSnapshot),
    tags,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildLesson(reviewReport: ReviewReport): string {
  const nextAction = reviewReport.nextActions[0] ?? "Keep the review report linked to future content decisions.";
  return `Reusable lesson: ${reviewReport.summary} Next action: ${nextAction}`;
}

function buildEvidence(reviewReport: ReviewReport, metricSnapshot?: MetricSnapshot | null): string {
  const parts = [`Review Report v${reviewReport.version}`];

  if (metricSnapshot) {
    parts.push(`Metric snapshot ${metricSnapshot.id} at ${metricSnapshot.snapshotAt}`);
  }

  return parts.join(". ");
}

function resolveColumnSlug(project: ContentProject): ContentColumnSlug {
  return project.primaryColumnId.replace(/^column_/, "") as ContentColumnSlug;
}
