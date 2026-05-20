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
      summary: `No imported metrics are available yet for ${request.project.title}. Treat this as a readiness review only.`,
      highlights: ["Publish metadata is recorded and ready for metric import."],
      underperformingSignals: ["Performance cannot be evaluated until a metric snapshot is imported."],
      likelyCauses: [`The ${formatPlatformName(request.publishRecord.platform)} package "${packageTitle}" needs metric data before content-fit conclusions are useful.`],
      nextActions: [
        "Import the latest platform metrics CSV before making performance conclusions.",
        "Confirm the publish URL and publish time are correct.",
        "Keep the draft, package, and source notes linked for the later performance review."
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
    summary: `${request.project.title} reached ${metrics.views} views with ${metrics.likes} likes, ${metrics.favorites} favorites, ${metrics.comments} comments, and ${metrics.shares} shares in the latest snapshot.`,
    highlights: buildHighlights(likeRate, favoriteRate, commentRate, shareRate),
    underperformingSignals: buildUnderperformingSignals(metrics.views, likeRate, favoriteRate, commentRate, shareRate),
    likelyCauses: [
      `The package angle "${packageTitle}" is the main test variable for this report.`,
      `Publish timing was recorded as ${request.publishRecord.publishedAt}. Compare this slot with future reports before changing the topic direction.`,
      "The current metrics suggest the next iteration should adjust the title, cover text, or opening hook before expanding into a new format."
    ],
    nextActions: [
      "Keep this package as the baseline for the next iteration.",
      "Write one alternate title and cover text before republishing a related topic.",
      "Import another metric snapshot after the next review window to compare trend direction."
    ]
  };
}

function buildHighlights(likeRate: number, favoriteRate: number, commentRate: number, shareRate: number): string[] {
  return [
    `Like rate is ${formatPercent(likeRate)}.`,
    `Favorite rate is ${formatPercent(favoriteRate)}.`,
    `Comment rate is ${formatPercent(commentRate)} and share rate is ${formatPercent(shareRate)}.`
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
    return ["Reach is not established yet because the latest snapshot has 0 views."];
  }

  const signals: string[] = [];
  if (likeRate < 0.05) {
    signals.push("Like rate is below the v0 attention threshold of 5%.");
  }
  if (favoriteRate < 0.03) {
    signals.push("Favorite rate is below the v0 save-intent threshold of 3%.");
  }
  if (commentRate < 0.01) {
    signals.push("Comment rate is below the v0 discussion threshold of 1%.");
  }
  if (shareRate < 0.01) {
    signals.push("Share rate is below the v0 spread threshold of 1%.");
  }

  return signals.length > 0 ? signals : ["No weak engagement signal crossed the v0 thresholds."];
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
    wechat_channels: "Wechat Channels",
    bilibili: "Bilibili"
  };

  return names[platform];
}
