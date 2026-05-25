import { describe, expect, it } from "vitest";
import { createEntityId } from "./ids";
import { generateMockReviewKnowledgeItem } from "./review-knowledge";
import type { ArchiveRecord, ContentProject, MetricSnapshot, ReviewReport } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "如何搭建个人 AI 工作站处理日常内容",
  status: "reviewed",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-20T09:00:00.000Z"
};

const archiveRecord: ArchiveRecord = {
  id: "archive-record_project-topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  draftVersionId: "draft_project-topic-ai-local-workstation-2",
  platformPackageId: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  title: project.title,
  summary: "Archived AI workstation package.",
  sourceCount: 1,
  packageCount: 1,
  status: "archived",
  createdAt: "2026-05-20T08:00:00.000Z",
  updatedAt: "2026-05-20T08:00:00.000Z"
};

const reviewReport: ReviewReport = {
  id: "review-report_publish-record-demo-v1",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  publishRecordId: "publish-record_demo",
  metricSnapshotId: "metric-snapshot_demo",
  version: 1,
  summary: "工作站内容达到 1000 次浏览，并显示出强收藏意图。",
  highlights: ["收藏率为 5.0%。"],
  underperformingSignals: ["评论率低于 v0 讨论阈值 1%。"],
  likelyCauses: ["标题把工作流收益讲得很具体。"],
  nextActions: [
    "重新发布相关选题前，先写一个备选标题和封面文案。",
    "下一个复盘窗口后再导入一次指标快照。"
  ],
  createdAt: "2026-05-20T09:00:00.000Z",
  updatedAt: "2026-05-20T09:00:00.000Z"
};

const metricSnapshot: MetricSnapshot = {
  id: "metric-snapshot_demo",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  publishRecordId: "publish-record_demo",
  platform: "xiaohongshu",
  sourceFileName: "metrics.csv",
  snapshotAt: "2026-05-20T08:00:00.000Z",
  views: 1000,
  likes: 95,
  favorites: 50,
  comments: 8,
  shares: 4,
  note: "first import",
  createdAt: "2026-05-20T08:01:00.000Z",
  updatedAt: "2026-05-20T08:01:00.000Z"
};

describe("generateMockReviewKnowledgeItem", () => {
  it("creates deterministic review-derived knowledge from a review report and archive", () => {
    const item = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport,
      metricSnapshot,
      now: new Date("2026-05-20T10:00:00.000Z")
    });

    expect(item).toMatchObject({
      id: createEntityId("knowledge-item-review", reviewReport.id),
      workspaceId: "workspace_robert-station",
      archiveRecordId: archiveRecord.id,
      contentProjectId: project.id,
      columnSlug: "ai",
      title: `复盘经验： ${project.title}`,
      createdAt: "2026-05-20T10:00:00.000Z",
      updatedAt: "2026-05-20T10:00:00.000Z"
    });
    expect(item.lesson).toContain(reviewReport.summary);
    expect(item.lesson).toContain(reviewReport.nextActions[0]);
    expect(item.evidence).toContain("复盘报告 v1");
    expect(item.evidence).toContain(metricSnapshot.id);
    expect(item.tags).toEqual(["ai", "review", "performance", "metrics"]);
  });

  it("omits the metrics tag and metric evidence when the report has no metric snapshot", () => {
    const { metricSnapshotId: _metricSnapshotId, ...reviewReportWithoutMetricSnapshot } = reviewReport;
    const item = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport: reviewReportWithoutMetricSnapshot,
      metricSnapshot: null,
      now: new Date("2026-05-20T11:00:00.000Z")
    });

    expect(item.tags).toEqual(["ai", "review", "performance"]);
    expect(item.evidence).toContain("复盘报告 v1");
    expect(item.evidence).not.toContain("metric-snapshot");
  });
});
