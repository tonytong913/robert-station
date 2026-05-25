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
    title: `复盘经验： ${request.project.title}`,
    lesson: buildLesson(request.reviewReport),
    evidence: buildEvidence(request.reviewReport, request.metricSnapshot),
    tags,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildLesson(reviewReport: ReviewReport): string {
  const nextAction = reviewReport.nextActions[0] ?? "保持复盘报告与未来内容决策关联。";
  return `可复用经验：${reviewReport.summary} 下一步：${nextAction}`;
}

function buildEvidence(reviewReport: ReviewReport, metricSnapshot?: MetricSnapshot | null): string {
  const parts = [`复盘报告 v${reviewReport.version}`];

  if (metricSnapshot) {
    parts.push(`指标快照 ${metricSnapshot.id}，时间 ${metricSnapshot.snapshotAt}`);
  }

  return parts.join(". ");
}

function resolveColumnSlug(project: ContentProject): ContentColumnSlug {
  return project.primaryColumnId.replace(/^column_/, "") as ContentColumnSlug;
}
