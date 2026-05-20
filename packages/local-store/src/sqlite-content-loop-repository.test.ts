import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createEntityId } from "@robert-station/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteContentLoopRepository } from "./sqlite-content-loop-repository";

describe("SqliteContentLoopRepository", () => {
  let tempDirectory: string;
  let databasePath: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "robert-station-sqlite-"));
    databasePath = path.join(tempDirectory, "content-loop.sqlite");
  });

  afterEach(async () => {
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it("seeds and reloads the content loop from disk", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const firstLoad = await firstRepository.loadContentLoop();
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const secondLoad = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(firstLoad.topics).toHaveLength(4);
    expect(firstLoad.projects).toHaveLength(0);
    expect(firstLoad.drafts).toHaveLength(0);
    expect(firstLoad.platformPackages).toHaveLength(0);
    expect(firstLoad.publishRecords).toHaveLength(0);
    expect(firstLoad.metricSnapshots).toHaveLength(0);
    expect(firstLoad.metricImportPreview).toBeNull();
    expect(firstLoad.reviewReports).toHaveLength(0);
    expect(firstLoad.archiveRecords).toHaveLength(0);
    expect(firstLoad.knowledgeItems).toHaveLength(0);
    expect(secondLoad).toEqual(firstLoad);
  });

  it("creates the required schema tables on initialization", () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    repository.close();

    const database = new DatabaseSync(databasePath);
    const tableRows = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name ASC;")
      .all() as unknown as Array<{ name: string }>;
    database.close();

    expect(tableRows.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "workspaces",
        "columns",
        "topics",
        "source_references",
        "content_projects",
        "draft_versions",
        "platform_packages",
        "publish_records",
        "metric_snapshots",
        "review_reports",
        "archive_records",
        "knowledge_items"
      ])
    );
  });

  it("persists promoted topic across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPromote.projects).toHaveLength(1);
    expect(afterPromote.drafts).toHaveLength(1);
    expect(afterPromote.selectedProjectId).toBe("project_topic-ai-local-workstation");
    expect(afterReload).toEqual(afterPromote);
  });

  it("persists generated topics across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterGenerate = await firstRepository.generateTopics("finance");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterGenerate.topics.some((topic) => topic.id === "topic_finance_mock-monthly-money-review")).toBe(true);
    expect(afterReload).toEqual(afterGenerate);
  });

  it("persists generated draft packages across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterGenerate = await firstRepository.generateDraftPackage(projectId);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterGenerate.drafts.filter((draft) => draft.contentProjectId === projectId)).toHaveLength(2);
    expect(afterReload).toEqual(afterGenerate);
  });

  it("does not insert a draft package for a missing project", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterGenerate = await repository.generateDraftPackage("project_missing");
    repository.close();

    expect(afterGenerate).toEqual(before);
  });

  it("persists generated platform packages across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    const afterPackage = await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPackage.platformPackages).toHaveLength(1);
    expect(afterPackage.platformPackages[0]?.platform).toBe("xiaohongshu");
    expect(afterReload).toEqual(afterPackage);
  });

  it("replaces a generated platform package for the same draft and platform", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterFirstPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterSecondPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    repository.close();

    expect(afterFirstPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages[0]?.id).toBe(afterFirstPackage.platformPackages[0]?.id);
  });

  it("does not insert a platform package for a missing project", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterMissingProject = await repository.generatePlatformPackage("project_missing", "xiaohongshu");
    repository.close();

    expect(afterMissingProject).toEqual(before);
  });

  it("persists manual publish records across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    const afterPackage = await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterPublish = await firstRepository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo"
    });
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPublish.publishRecords).toHaveLength(1);
    expect(afterReload).toEqual(afterPublish);
  });

  it("replaces the same SQLite publish row and preserves createdAt across reload", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    const afterPackage = await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterFirstPublish = await firstRepository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/first",
      note: "First publish."
    });
    const afterSecondPublish = await firstRepository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T16:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/second",
      note: "Second publish."
    });
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterSecondPublish.publishRecords).toHaveLength(1);
    expect(afterSecondPublish.publishRecords[0]?.id).toBe(afterFirstPublish.publishRecords[0]?.id);
    expect(afterSecondPublish.publishRecords[0]?.createdAt).toBe(afterFirstPublish.publishRecords[0]?.createdAt);
    expect(afterSecondPublish.publishRecords[0]?.publishedAt).toBe("2026-05-19T16:00:00.000Z");
    expect(afterSecondPublish.publishRecords[0]?.url).toBe("https://www.xiaohongshu.com/explore/second");
    expect(afterSecondPublish.publishRecords[0]?.note).toBe("Second publish.");
    expect(afterReload).toEqual(afterSecondPublish);
  });

  it("loads multiple SQLite publish records newest first", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const afterFirstPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const firstProjectId = afterFirstPromote.selectedProjectId;

    if (!firstProjectId) {
      throw new Error("Expected first promoted project to be selected.");
    }

    await repository.generateDraftPackage(firstProjectId);
    const afterFirstPackage = await repository.generatePlatformPackage(firstProjectId, "xiaohongshu");
    const firstPackageId = afterFirstPackage.platformPackages.find(
      (platformPackage) => platformPackage.contentProjectId === firstProjectId
    )?.id;

    if (!firstPackageId) {
      throw new Error("Expected a generated platform package for the first project.");
    }

    const afterSecondPromote = await repository.promoteTopic("topic_finance-family-dashboard");
    const secondProjectId = afterSecondPromote.selectedProjectId;

    if (!secondProjectId) {
      throw new Error("Expected second promoted project to be selected.");
    }

    await repository.generateDraftPackage(secondProjectId);
    const afterSecondPackage = await repository.generatePlatformPackage(secondProjectId, "xiaohongshu");
    const secondPackageId = afterSecondPackage.platformPackages.find(
      (platformPackage) => platformPackage.contentProjectId === secondProjectId
    )?.id;

    if (!secondPackageId) {
      throw new Error("Expected a generated platform package for the second project.");
    }

    await repository.recordManualPublish({
      platformPackageId: firstPackageId,
      publishedAt: "2026-05-19T15:00:00.000Z"
    });
    const afterSecondPublish = await repository.recordManualPublish({
      platformPackageId: secondPackageId,
      publishedAt: "2026-05-19T17:00:00.000Z"
    });
    repository.close();

    expect(afterSecondPublish.publishRecords).toHaveLength(2);
    expect(afterSecondPublish.publishRecords[0]?.publishedAt).toBe("2026-05-19T17:00:00.000Z");
    expect(afterSecondPublish.publishRecords[1]?.publishedAt).toBe("2026-05-19T15:00:00.000Z");
  });

  it("does not insert a manual publish record for a missing package", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterPublish = await repository.recordManualPublish({
      platformPackageId: "platform-package_missing",
      publishedAt: "2026-05-19T15:00:00.000Z"
    });
    repository.close();

    expect(afterPublish).toEqual(before);
  });

  it("persists metric snapshots across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });

    await publishXiaohongshuDemo(firstRepository);
    await firstRepository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV
    });
    const afterSave = await firstRepository.saveMetricImport();
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterSave.metricSnapshots).toHaveLength(1);
    expect(afterReload).toEqual(afterSave);
  });

  it("does not change SQLite state when saving without a metric preview", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterSave = await repository.saveMetricImport();
    repository.close();

    expect(afterSave).toEqual(before);
  });

  it("keeps metric import previews transient in SQLite", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });

    await publishXiaohongshuDemo(firstRepository);
    const afterPreview = await firstRepository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV_WITH_INVALID_ROW
    });
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPreview.metricSnapshots).toHaveLength(0);
    expect(afterPreview.metricImportPreview?.rows).toHaveLength(2);
    expect(afterPreview.metricImportPreview?.rows.filter((row) => row.status === "matched")).toHaveLength(1);
    expect(afterPreview.metricImportPreview?.rows.filter((row) => row.status === "invalid")).toHaveLength(1);
    expect(afterReload.metricImportPreview).toBeNull();
  });

  it("replaces a SQLite metric snapshot while preserving createdAt and updating metrics", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    await publishXiaohongshuDemo(repository);
    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV
    });
    const afterFirstSave = await repository.saveMetricImport();

    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText:
        "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
        "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,150,20,10,4,3,2026-05-20T08:00:00.000Z,better"
    });
    const afterSecondSave = await repository.saveMetricImport();
    repository.close();

    expect(afterSecondSave.metricSnapshots).toHaveLength(1);
    expect(afterSecondSave.metricSnapshots[0]?.id).toBe(afterFirstSave.metricSnapshots[0]?.id);
    expect(afterSecondSave.metricSnapshots[0]?.createdAt).toBe(afterFirstSave.metricSnapshots[0]?.createdAt);
    expect(afterSecondSave.metricSnapshots[0]?.updatedAt).not.toBe(afterFirstSave.metricSnapshots[0]?.updatedAt);
    expect(afterSecondSave.metricSnapshots[0]).toMatchObject({
      views: 150,
      likes: 20,
      favorites: 10,
      comments: 4,
      shares: 3,
      note: "better"
    });
  });

  it("uses metric snapshotAt as a SQLite clock source for later generated records", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    await publishXiaohongshuDemo(repository);
    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText:
        "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
        "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2030-01-01T00:00:00.000Z,future snapshot"
    });
    await repository.saveMetricImport();
    const afterGenerate = await repository.generateTopics("parenting");
    repository.close();

    const generatedTopic = afterGenerate.topics.find((topic) => topic.id === "topic_parenting_mock-homework-reset");

    expect(generatedTopic).toBeDefined();
    expect(new Date(generatedTopic?.updatedAt ?? 0).getTime()).toBeGreaterThan(
      new Date("2030-01-01T00:00:00.000Z").getTime()
    );
  });

  it("persists review reports across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPublish = await publishXiaohongshuDemo(firstRepository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    await firstRepository.generateReviewReport(publishRecord!.id);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const reloaded = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(reloaded.reviewReports).toHaveLength(1);
    expect(reloaded.reviewReports[0]).toMatchObject({
      publishRecordId: publishRecord!.id,
      contentProjectId: publishRecord!.contentProjectId,
      version: 1
    });
    expect(reloaded.projects.find((project) => project.id === publishRecord!.contentProjectId)?.status).toBe("reviewed");
  });

  it("creates increasing SQLite review report versions", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    await repository.generateReviewReport(publishRecord!.id);
    const afterSecondReview = await repository.generateReviewReport(publishRecord!.id);
    repository.close();

    expect(afterSecondReview.reviewReports.map((report) => report.version)).toEqual([2, 1]);
    expect(afterSecondReview.reviewReports[0]?.id).toBe(createEntityId("review-report", `${publishRecord!.id}-v2`));
  });

  it("does not insert a SQLite review report for a missing publish record", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterReview = await repository.generateReviewReport("publish-record_missing");
    repository.close();

    expect(afterReview.reviewReports).toHaveLength(0);
    expect(afterReview.projects).toEqual(before.projects);
  });

  it("does not duplicate a project when promoting the same topic twice or unknown topic", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    await repository.promoteTopic("topic_ai_local-workstation");
    const afterSecondPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const afterUnknownPromote = await repository.promoteTopic("topic_missing");

    repository.close();

    expect(afterSecondPromote.projects).toHaveLength(1);
    expect(afterSecondPromote.drafts).toHaveLength(1);
    expect(afterUnknownPromote).toEqual(afterSecondPromote);
  });

  it("does not duplicate generated topics for repeated column requests", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    const afterGenerate = await repository.generateTopics("parenting");
    const afterRepeat = await repository.generateTopics("parenting");

    repository.close();

    expect(afterGenerate.topics).toHaveLength(6);
    expect(afterGenerate.sourceReferences).toHaveLength(6);
    expect(afterGenerate.topics.filter((topic) => topic.id.startsWith("topic_parenting_mock-"))).toHaveLength(2);
    expect(afterRepeat.topics).toHaveLength(6);
    expect(afterRepeat.sourceReferences).toHaveLength(6);
    expect(afterRepeat.topics.filter((topic) => topic.id.startsWith("topic_parenting_mock-"))).toHaveLength(2);
  });

  it("selects the latest promoted project after promoting different topics", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    await firstRepository.promoteTopic("topic_ai_local-workstation");
    const afterSecondPromote = await firstRepository.promoteTopic("topic_finance-family-dashboard");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterSecondPromote.selectedProjectId).toBe("project_topic-finance-family-dashboard");
    expect(afterReload.selectedProjectId).toBe("project_topic-finance-family-dashboard");
  });

  it("persists archived projects and knowledge items across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterArchive = await firstRepository.archiveProject(projectId);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterArchive.archiveRecords).toHaveLength(1);
    expect(afterArchive.knowledgeItems).toHaveLength(1);
    expect(afterReload).toEqual(afterArchive);
  });

  it("does not archive a missing project", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterArchive = await repository.archiveProject("project_missing");
    repository.close();

    expect(afterArchive).toEqual(before);
  });
});

const METRIC_CSV =
  "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
  "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good";

const METRIC_CSV_WITH_INVALID_ROW =
  `${METRIC_CSV}\n` +
  "https://www.xiaohongshu.com/explore/missing,,xiaohongshu,1,1,1,1,1,2026-05-20T09:00:00.000Z,bad";

async function publishXiaohongshuDemo(repository: SqliteContentLoopRepository) {
  const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
  const projectId = afterPromote.selectedProjectId;

  if (!projectId) {
    throw new Error("Expected promoted project to be selected.");
  }

  await repository.generateDraftPackage(projectId);
  const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
  const packageId = afterPackage.platformPackages[0]?.id;

  if (!packageId) {
    throw new Error("Expected a generated platform package.");
  }

  return repository.recordManualPublish({
    platformPackageId: packageId,
    publishedAt: "2026-05-19T12:00:00.000Z",
    url: "https://www.xiaohongshu.com/explore/demo"
  });
}
