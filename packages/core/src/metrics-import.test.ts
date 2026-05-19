import { describe, expect, it } from "vitest";
import { createMetricImportPreview, createMetricSnapshotsFromPreview } from "./metrics-import";
import type { MetricCsvImportInput, PublishRecord } from "./types";

const publishRecord: PublishRecord = {
  id: "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: "project_topic-ai-local-workstation",
  platformPackageId: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  platform: "xiaohongshu",
  status: "published",
  publishedAt: "2026-05-19T12:00:00.000Z",
  url: "https://www.xiaohongshu.com/explore/demo",
  note: "",
  createdAt: "2026-05-19T12:01:00.000Z",
  updatedAt: "2026-05-19T12:01:00.000Z"
};

const input: MetricCsvImportInput = {
  sourceFileName: "xiaohongshu-metrics.csv",
  csvText:
    "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
    "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,1000,88,34,12,9,2026-05-20T08:00:00.000Z,first import"
};

describe("createMetricImportPreview", () => {
  it("parses valid metric CSV rows and matches publish records by URL", () => {
    const preview = createMetricImportPreview({
      input,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.sourceFileName).toBe("xiaohongshu-metrics.csv");
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      status: "matched",
      publishRecordId: publishRecord.id,
      url: publishRecord.url,
      platform: "xiaohongshu",
      publishedAt: "",
      snapshotAt: "2026-05-20T08:00:00.000Z",
      metrics: {
        views: 1000,
        likes: 88,
        favorites: 34,
        comments: 12,
        shares: 9
      },
      note: "first import"
    });
  });

  it("defaults omitted numeric metrics to zero and matches by platform plus publishedAt", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "minimal.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          ",2026-05-19T12:00:00.000Z,xiaohongshu,,,,,,,"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]).toMatchObject({
      status: "matched",
      publishRecordId: publishRecord.id,
      snapshotAt: "2026-05-20T09:00:00.000Z",
      metrics: {
        views: 0,
        likes: 0,
        favorites: 0,
        comments: 0,
        shares: 0
      }
    });
  });

  it("marks rows with invalid metrics as invalid", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "invalid.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,-1,8,3,1,0,,bad row"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]?.status).toBe("invalid");
    expect(preview.rows[0]?.error).toBe("views must be a non-negative integer.");
  });

  it("marks unmatched rows as invalid", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "unmatched.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "https://www.xiaohongshu.com/explore/missing,,xiaohongshu,1,1,1,1,1,,missing"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]?.status).toBe("invalid");
    expect(preview.rows[0]?.error).toBe("No matching publish record.");
  });

  it("creates deterministic metric snapshots from matched preview rows", () => {
    const preview = createMetricImportPreview({
      input,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });
    const snapshots = createMetricSnapshotsFromPreview({
      preview,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:30:00.000Z")
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      id: "metric-snapshot_publish-record-platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu-2026-05-20t08-00-00-000z",
      workspaceId: publishRecord.workspaceId,
      contentProjectId: publishRecord.contentProjectId,
      publishRecordId: publishRecord.id,
      platform: "xiaohongshu",
      sourceFileName: "xiaohongshu-metrics.csv",
      snapshotAt: "2026-05-20T08:00:00.000Z",
      views: 1000,
      likes: 88,
      favorites: 34,
      comments: 12,
      shares: 9,
      note: "first import",
      createdAt: "2026-05-20T09:30:00.000Z",
      updatedAt: "2026-05-20T09:30:00.000Z"
    });
  });
});
