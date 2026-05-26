import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createEntityId } from "@robert-station/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        "knowledge_items",
        "task_runs"
      ])
    );
  });

  it("migrates legacy source reference metadata columns on initialization", async () => {
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE source_references (
        id TEXT PRIMARY KEY,
        remote_id TEXT,
        workspace_id TEXT NOT NULL,
        topic_id TEXT,
        content_project_id TEXT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        note TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'local',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    database.close();

    const repository = SqliteContentLoopRepository.open({ databasePath });
    const state = await repository.loadContentLoop();
    repository.close();

    expect(state.sourceReferences[0]?.tags).toEqual([]);

    const migratedDatabase = new DatabaseSync(databasePath);
    const columns = migratedDatabase
      .prepare("PRAGMA table_info(source_references);")
      .all() as unknown as Array<{ name: string }>;
    migratedDatabase.close();

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "column_slug",
        "platform",
        "author",
        "published_at",
        "extraction_status",
        "usage_status",
        "excerpt",
        "tags_json"
      ])
    );
  });

  it("persists source library metadata across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterAdd = await firstRepository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter",
      platform: "wechat_channels",
      author: "wechat-article",
      excerpt: "支持 HTML、Markdown、Excel 等格式导出。",
      tags: ["采集", "导出"]
    });
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterAdd.sourceReferences.find((source) => source.title === "微信公众号文章导出器")).toMatchObject({
      columnSlug: "ai",
      platform: "wechat_channels",
      author: "wechat-article",
      usageStatus: "unused",
      tags: ["采集", "导出"]
    });
    expect(afterReload).toEqual(afterAdd);
  });

  it("filters SQLite source references without mutating persisted state", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    await repository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "AI 工作流文章",
      url: "https://example.com/ai-workflow",
      platform: "wechat_channels",
      excerpt: "资料库导入案例",
      tags: ["导入"]
    });
    await repository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "finance",
      title: "家庭财务看板",
      url: "https://example.com/finance-dashboard",
      platform: "xiaohongshu",
      tags: ["复盘"]
    });

    const filtered = await repository.filterSourceReferences({
      columnSlug: "ai",
      platform: "wechat_channels",
      tag: "导入",
      query: "资料库"
    });
    const reloaded = await repository.loadContentLoop();
    repository.close();

    expect(filtered.sourceReferences.map((source) => source.title)).toEqual(["AI 工作流文章"]);
    expect(reloaded.sourceReferences.some((source) => source.title === "家庭财务看板")).toBe(true);
  });

  it("persists topics created from source references across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterAdd = await firstRepository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信长文导出案例",
      url: "https://example.com/wechat-case",
      platform: "wechat_channels",
      excerpt: "多格式导出和资源缓存值得参考。"
    });
    const sourceId = afterAdd.sourceReferences.find((source) => source.title === "微信长文导出案例")?.id;

    if (!sourceId) {
      throw new Error("Expected a source reference to be added.");
    }

    const afterCreate = await firstRepository.createTopicFromSourceReference(sourceId);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterCreate.topics.find((topic) => topic.id === "topic_source-wechat-case")).toMatchObject({
      title: "微信长文导出案例",
      targetPlatforms: ["wechat_channels"]
    });
    expect(afterCreate.sourceReferences.find((source) => source.id === sourceId)).toMatchObject({
      topicId: "topic_source-wechat-case",
      usageStatus: "used"
    });
    expect(afterReload).toEqual(afterCreate);
  });

  it("persists task progress across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterStart = await firstRepository.startTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "export",
      label: "导出资料库",
      totalCount: 2
    });
    const taskId = afterStart.taskRuns[0]?.id;

    if (!taskId) {
      throw new Error("Expected a task run to be persisted.");
    }

    const afterAdvance = await firstRepository.advanceTaskRun(taskId, {
      phase: "writing",
      completedCount: 1,
      message: "写入 Markdown"
    });
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterAdvance.taskRuns[0]).toMatchObject({
      id: taskId,
      phase: "writing",
      status: "running",
      completedCount: 1
    });
    expect(afterReload).toEqual(afterAdvance);
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

  it("uses a configured runtime for SQLite topic generation", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => ({
        candidates: [
          {
            title: "SQLite runtime topic",
            hook: "SQLite runtime hook",
            audience: "SQLite runtime audience",
            targetPlatforms: ["xiaohongshu" as const],
            score: { heat: 91, fit: 92, difficulty: 30, personaConsistency: 89 },
            sourceNotes: ["SQLite runtime source note"],
            riskNotes: ["SQLite runtime risk note"],
            verificationNotes: ["SQLite runtime verification note"]
          }
        ]
      })),
      generateDraft: vi.fn()
    };
    const firstRepository = SqliteContentLoopRepository.open({ databasePath, agentRuntime: runtime });
    const afterGenerate = await firstRepository.generateTopics("ai");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(runtime.generateTopics).toHaveBeenCalledWith({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: expect.any(Date)
    });
    expect(afterGenerate.topics.some((topic) => topic.title === "SQLite runtime topic")).toBe(true);
    expect(afterGenerate.sourceReferences.some((source) => source.note.includes("SQLite runtime source note"))).toBe(true);
    expect(afterGenerate.taskRuns[0]).toMatchObject({
      kind: "generation",
      status: "completed",
      message: "Agent runtime generated topics."
    });
    expect(afterReload).toEqual(afterGenerate);
  });

  it("falls back to mock SQLite topics when runtime topic generation fails", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => {
        throw new Error("runtime offline");
      }),
      generateDraft: vi.fn()
    };
    const repository = SqliteContentLoopRepository.open({ databasePath, agentRuntime: runtime });
    const state = await repository.generateTopics("ai");
    repository.close();

    expect(runtime.generateTopics).toHaveBeenCalledOnce();
    expect(state.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
    expect(state.taskRuns[0]).toMatchObject({
      kind: "generation",
      status: "completed",
      message: "Fell back to mock topic generator."
    });
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

  it("uses a configured runtime for SQLite draft generation", async () => {
    const runtime = {
      generateTopics: vi.fn(),
      generateDraft: vi.fn(async () => ({
        package: {
          brief: "SQLite runtime brief",
          titleOptions: ["SQLite runtime title", "SQLite runtime title 2"],
          bodyDraft: "SQLite runtime body",
          coverCopy: "SQLite runtime cover",
          tags: ["#runtime"],
          visualDirection: "SQLite runtime visual direction",
          pendingVerification: ["SQLite runtime verification"]
        }
      }))
    };
    const firstRepository = SqliteContentLoopRepository.open({ databasePath, agentRuntime: runtime });
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

    expect(runtime.generateDraft).toHaveBeenCalledOnce();
    expect(afterGenerate.drafts[0]?.body).toContain("SQLite runtime brief");
    expect(afterGenerate.drafts[0]?.body).toContain("SQLite runtime body");
    expect(afterGenerate.drafts[0]?.body).toContain("SQLite runtime verification");
    expect(afterGenerate.taskRuns[0]).toMatchObject({
      kind: "generation",
      status: "completed",
      message: "Agent runtime generated draft."
    });
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

  it("uses metric snapshotAt as a SQLite clock source for generated review reports", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText:
        "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
        "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2030-01-01T00:00:00.000Z,future snapshot"
    });
    await repository.saveMetricImport();
    const afterReview = await repository.generateReviewReport(publishRecord!.id);
    repository.close();

    const reviewReport = afterReview.reviewReports[0];
    const reviewedProject = afterReview.projects.find((project) => project.id === publishRecord!.contentProjectId);

    expect(reviewReport).toBeDefined();
    expect(reviewedProject).toBeDefined();
    expect(new Date(reviewReport?.updatedAt ?? 0).getTime()).toBeGreaterThan(
      new Date("2030-01-01T00:00:00.000Z").getTime()
    );
    expect(reviewedProject?.updatedAt).toBe(reviewReport?.updatedAt);
  });

  it("does not insert a SQLite review report for a missing publish record", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterReview = await repository.generateReviewReport("publish-record_missing");
    repository.close();

    expect(afterReview.reviewReports).toHaveLength(0);
    expect(afterReview.projects).toEqual(before.projects);
  });

  it("persists review-derived knowledge across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPublish = await publishXiaohongshuDemo(firstRepository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    const afterReview = await firstRepository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];

    expect(reviewReport).toBeDefined();

    await firstRepository.archiveProject(publishRecord!.contentProjectId);
    const afterExtract = await firstRepository.extractReviewKnowledge(reviewReport!.id);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const reloaded = await secondRepository.loadContentLoop();
    secondRepository.close();

    const reviewKnowledgeItem = reloaded.knowledgeItems.find((item) => item.id.startsWith("knowledge-item-review"));

    expect(afterExtract.knowledgeItems).toHaveLength(2);
    expect(reloaded.knowledgeItems).toHaveLength(2);
    expect(reviewKnowledgeItem).toMatchObject({
      id: createEntityId("knowledge-item-review", reviewReport!.id),
      contentProjectId: publishRecord!.contentProjectId,
      title: "复盘经验： 如何搭建个人 AI 工作站处理日常内容"
    });
    expect(reviewKnowledgeItem?.lesson).toContain(reviewReport!.summary);
  });

  it("does not insert SQLite review knowledge without an archive", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    expect(publishRecord).toBeDefined();

    const afterReview = await repository.generateReviewReport(publishRecord!.id);
    const reviewReport = afterReview.reviewReports[0];

    expect(reviewReport).toBeDefined();

    const afterExtract = await repository.extractReviewKnowledge(reviewReport!.id);
    repository.close();

    expect(afterExtract.knowledgeItems.find((item) => item.id.startsWith("knowledge-item-review"))).toBeUndefined();
    expect(afterExtract.knowledgeItems).toHaveLength(0);
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
