import { describe, expect, it } from "vitest";
import { createEntityId } from "./ids";
import { generateMockReviewReport } from "./review-report";
import type { ContentProject, MetricSnapshot, PlatformPackage, PublishRecord } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "如何搭建个人 AI 工作站处理日常内容",
  status: "published",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const platformPackage: PlatformPackage = {
  id: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  draftVersionId: "draft_project-topic-ai-local-workstation-2",
  platform: "xiaohongshu",
  title: "Build a personal AI workstation",
  body: "A practical note for creators building repeatable AI workflows.",
  tags: ["#AI", "#workflow"],
  coverText: "AI workstation",
  requiredAssets: ["封面图"],
  checks: [{ name: "标题长度", status: "pass", message: "Title is short enough." }],
  createdAt: "2026-05-19T01:00:00.000Z",
  updatedAt: "2026-05-19T01:00:00.000Z"
};

const publishRecord: PublishRecord = {
  id: "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  platformPackageId: platformPackage.id,
  platform: "xiaohongshu",
  status: "published",
  publishedAt: "2026-05-19T12:00:00.000Z",
  url: "https://www.xiaohongshu.com/explore/demo",
  note: "Published after manual review.",
  createdAt: "2026-05-19T12:01:00.000Z",
  updatedAt: "2026-05-19T12:01:00.000Z"
};

const metricSnapshot: MetricSnapshot = {
  id: "metric-snapshot_publish-record-demo_2026-05-20T08:00:00.000Z",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  publishRecordId: publishRecord.id,
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

function expectedReviewReportId(version: number): string {
  return createEntityId("review-report", `${publishRecord.id}-v${version}`);
}

describe("generateMockReviewReport", () => {
  it("creates a deterministic metrics-backed review report", () => {
    const report = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot,
      version: 1,
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(report).toMatchObject({
      id: expectedReviewReportId(1),
      workspaceId: "workspace_robert-station",
      contentProjectId: project.id,
      publishRecordId: publishRecord.id,
      metricSnapshotId: metricSnapshot.id,
      version: 1,
      createdAt: "2026-05-20T09:00:00.000Z",
      updatedAt: "2026-05-20T09:00:00.000Z"
    });
    expect(report.summary).toContain("1000 次浏览");
    expect(report.highlights.join(" ")).toContain("点赞率");
    expect(report.underperformingSignals.length).toBeGreaterThan(0);
    expect(report.likelyCauses.join(" ")).toContain("Build a personal AI workstation");
    expect(report.nextActions.length).toBeGreaterThanOrEqual(3);
  });

  it("creates a no-metrics report without performance claims", () => {
    const report = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot: null,
      version: 2,
      now: new Date("2026-05-20T10:00:00.000Z")
    });

    expect(report.id).toBe(expectedReviewReportId(2));
    expect(report.metricSnapshotId).toBeUndefined();
    expect(report.summary).toContain("还没有导入指标");
    expect(report.highlights).toEqual(["发布元数据已记录，可以导入指标。"]);
    expect(report.nextActions).toContain("先导入最新平台指标 CSV，再做表现结论。");
  });

  it("handles zero-view metrics without dividing by zero", () => {
    const report = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot: { ...metricSnapshot, views: 0, likes: 0, favorites: 0, comments: 0, shares: 0 },
      version: 3,
      now: new Date("2026-05-20T11:00:00.000Z")
    });

    expect(report.summary).toContain("0 次浏览");
    expect(report.underperformingSignals).toContain("最新快照浏览量为 0，触达尚未建立。");
  });
});
