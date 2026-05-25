import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("uses the current time when now and snapshotAt are omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T10:11:12.000Z"));

    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "current-time.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          ",2026-05-19T12:00:00.000Z,xiaohongshu,,,,,,,"
      },
      publishRecords: [publishRecord]
    });

    expect(preview.createdAt).toBe("2026-05-21T10:11:12.000Z");
    expect(preview.rows[0]?.snapshotAt).toBe("2026-05-21T10:11:12.000Z");
  });

  it("ignores blank lines without creating invalid preview rows", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "blank-lines.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "\n" +
          "   \n" +
          "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,1000,88,34,12,9,2026-05-20T08:00:00.000Z,first import\n" +
          "\n" +
          "   \n"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 4,
      status: "matched",
      publishRecordId: publishRecord.id
    });
  });

  it("parses quoted commas in notes", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "quoted-note.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          'https://www.xiaohongshu.com/explore/demo,,xiaohongshu,1000,88,34,12,9,2026-05-20T08:00:00.000Z,"first import, with comma"'
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]).toMatchObject({
      status: "matched",
      note: "first import, with comma"
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
    expect(preview.rows[0]?.error).toBe("views 必须是非负整数。");
  });

  it("marks non-empty unsupported platform values as invalid before matching", () => {
    const preview = createMetricImportPreview({
      input: {
        sourceFileName: "unsupported-platform.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "https://www.xiaohongshu.com/explore/demo,,bad,1,1,1,1,1,,bad platform"
      },
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    expect(preview.rows[0]?.status).toBe("invalid");
    expect(preview.rows[0]?.error).toBe("不支持的平台：bad。");
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
    expect(preview.rows[0]?.error).toBe("没有匹配的发布记录。");
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

  it("uses the current time when creating snapshots without now", () => {
    const preview = createMetricImportPreview({
      input,
      publishRecords: [publishRecord],
      now: new Date("2026-05-20T09:00:00.000Z")
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T10:11:12.000Z"));

    const snapshots = createMetricSnapshotsFromPreview({
      preview,
      publishRecords: [publishRecord]
    });

    expect(snapshots[0]).toMatchObject({
      createdAt: "2026-05-21T10:11:12.000Z",
      updatedAt: "2026-05-21T10:11:12.000Z"
    });
  });
});
