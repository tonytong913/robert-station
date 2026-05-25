import { createEntityId } from "./ids";
import type { ContentProject, MetricSnapshot, PlatformPackage, PublishRecord, ReviewReport } from "./types";

interface GenerateMockReviewReportRequest {
  project: ContentProject;
  publishRecord: PublishRecord;
  platformPackage?: PlatformPackage | null;
  metricSnapshot?: MetricSnapshot | null;
  version: number;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-20T00:00:00.000Z");

export function generateMockReviewReport(request: GenerateMockReviewReportRequest): ReviewReport {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const id = createEntityId("review-report", `${request.publishRecord.id}-v${request.version}`);
  const packageTitle = request.platformPackage?.title ?? request.project.title;
  const base = {
    id,
    workspaceId: request.publishRecord.workspaceId,
    contentProjectId: request.publishRecord.contentProjectId,
    publishRecordId: request.publishRecord.id,
    version: request.version,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!request.metricSnapshot) {
    return {
      ...base,
      summary: `${request.project.title} 还没有导入指标。当前仅作为发布准备度复盘。`,
      highlights: ["发布元数据已记录，可以导入指标。"],
      underperformingSignals: ["导入指标快照前无法评估表现。"],
      likelyCauses: [`${formatPlatformName(request.publishRecord.platform)} 发布包「${packageTitle}」需要指标数据，才能判断内容匹配度。`],
      nextActions: [
        "先导入最新平台指标 CSV，再做表现结论。",
        "确认发布链接和发布时间正确。",
        "保留草稿、发布包和来源笔记之间的关联，供后续表现复盘使用。"
      ]
    };
  }

  const metrics = request.metricSnapshot;
  const likeRate = rate(metrics.likes, metrics.views);
  const favoriteRate = rate(metrics.favorites, metrics.views);
  const commentRate = rate(metrics.comments, metrics.views);
  const shareRate = rate(metrics.shares, metrics.views);

  return {
    ...base,
    metricSnapshotId: metrics.id,
    summary: `${request.project.title} 在最新快照中达到 ${metrics.views} 次浏览、${metrics.likes} 次点赞、${metrics.favorites} 次收藏、${metrics.comments} 条评论和 ${metrics.shares} 次分享。`,
    highlights: buildHighlights(likeRate, favoriteRate, commentRate, shareRate),
    underperformingSignals: buildUnderperformingSignals(metrics.views, likeRate, favoriteRate, commentRate, shareRate),
    likelyCauses: [
      `发布包角度「${packageTitle}」是本次报告的主要测试变量。`,
      `发布时间记录为 ${request.publishRecord.publishedAt}。调整选题方向前，先和后续报告对比这个时间段。`,
      "当前指标建议下一轮先调整标题、封面文案或开头钩子，再扩展新形式。"
    ],
    nextActions: [
      "将这个发布包作为下一轮迭代的基线。",
      "重新发布相关选题前，先写一个备选标题和封面文案。",
      "下一个复盘窗口后再导入一次指标快照，用于比较趋势方向。"
    ]
  };
}

function buildHighlights(likeRate: number, favoriteRate: number, commentRate: number, shareRate: number): string[] {
  return [
    `点赞率为 ${formatPercent(likeRate)}。`,
    `收藏率为 ${formatPercent(favoriteRate)}。`,
    `评论率为 ${formatPercent(commentRate)}，分享率为 ${formatPercent(shareRate)}。`
  ];
}

function buildUnderperformingSignals(
  views: number,
  likeRate: number,
  favoriteRate: number,
  commentRate: number,
  shareRate: number
): string[] {
  if (views === 0) {
    return ["最新快照浏览量为 0，触达尚未建立。"];
  }

  const signals: string[] = [];
  if (likeRate < 0.05) {
    signals.push("点赞率低于 v0 注意力阈值 5%。");
  }
  if (favoriteRate < 0.03) {
    signals.push("收藏率低于 v0 收藏意图阈值 3%。");
  }
  if (commentRate < 0.01) {
    signals.push("评论率低于 v0 讨论阈值 1%。");
  }
  if (shareRate < 0.01) {
    signals.push("分享率低于 v0 传播阈值 1%。");
  }

  return signals.length > 0 ? signals : ["没有弱互动信号触发 v0 阈值。"];
}

function rate(value: number, views: number): number {
  if (views <= 0) {
    return 0;
  }

  return value / views;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPlatformName(platform: PublishRecord["platform"]): string {
  const names: Record<PublishRecord["platform"], string> = {
    xiaohongshu: "Xiaohongshu",
    douyin: "Douyin",
    wechat_channels: "微信视频号",
    bilibili: "Bilibili"
  };

  return names[platform];
}
