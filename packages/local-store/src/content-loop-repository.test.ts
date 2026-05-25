import { describe, expect, it, vi } from "vitest";
import { createEntityId } from "@robert-station/core";
import { InMemoryContentLoopRepository } from "./content-loop-repository";

describe("InMemoryContentLoopRepository", () => {
  it("loads the seeded content loop state", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const state = await repository.loadContentLoop();

    expect(state.topics).toHaveLength(4);
    expect(state.projects).toHaveLength(0);
    expect(state.drafts).toHaveLength(0);
    expect(state.platformPackages).toHaveLength(0);
    expect(state.publishRecords).toHaveLength(0);
    expect(state.metricSnapshots).toHaveLength(0);
    expect(state.metricImportPreview).toBeNull();
    expect(state.reviewReports).toHaveLength(0);
    expect(state.archiveRecords).toHaveLength(0);
    expect(state.knowledgeItems).toHaveLength(0);
    expect(state.selectedProjectId).toBeNull();
  });

  it("promotes a topic and persists the updated state in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const topicId = before.topics[0]?.id;

    if (!topicId) {
      throw new Error("Expected seeded repository to include a first topic.");
    }

    const afterPromote = await repository.promoteTopic(topicId);
    const afterReload = await repository.loadContentLoop();

    expect(afterPromote.projects).toHaveLength(1);
    expect(afterPromote.drafts).toHaveLength(1);
    expect(afterPromote.topics.find((topic) => topic.id === topicId)?.status).toBe("promoted");
    expect(afterReload).toEqual(afterPromote);
  });

  it("generates mock topics in memory without duplicating repeated requests", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    const afterGenerate = await repository.generateTopics("ai");
    const afterRepeat = await repository.generateTopics("ai");

    expect(afterGenerate.topics).toHaveLength(6);
    expect(afterGenerate.sourceReferences).toHaveLength(6);
    expect(afterGenerate.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
    expect(afterRepeat.topics).toHaveLength(6);
    expect(afterRepeat.sourceReferences).toHaveLength(6);
  });

  it("uses a configured runtime for in-memory topic generation", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => ({
        candidates: [
          {
            title: "Runtime topic",
            hook: "Runtime hook",
            audience: "Runtime audience",
            targetPlatforms: ["xiaohongshu" as const],
            score: { heat: 91, fit: 92, difficulty: 30, personaConsistency: 89 },
            sourceNotes: ["Runtime source note"],
            riskNotes: ["Runtime risk note"],
            verificationNotes: ["Runtime verification note"]
          }
        ]
      })),
      generateDraft: vi.fn()
    };
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station", { agentRuntime: runtime });

    const state = await repository.generateTopics("ai");

    expect(runtime.generateTopics).toHaveBeenCalledWith({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: expect.any(Date)
    });
    expect(state.topics.some((topic) => topic.title === "Runtime topic")).toBe(true);
    expect(state.sourceReferences.some((source) => source.note.includes("Runtime source note"))).toBe(true);
    expect(state.taskRuns[0]).toMatchObject({
      kind: "generation",
      status: "completed",
      message: "Agent runtime generated topics."
    });
  });

  it("falls back to mock in-memory topics when runtime topic generation fails", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => {
        throw new Error("runtime offline");
      }),
      generateDraft: vi.fn()
    };
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station", { agentRuntime: runtime });

    const state = await repository.generateTopics("ai");

    expect(runtime.generateTopics).toHaveBeenCalledOnce();
    expect(state.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
    expect(state.taskRuns[0]).toMatchObject({
      kind: "generation",
      status: "completed",
      message: "Fell back to mock topic generator."
    });
  });

  it("adds and filters source library references in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    await repository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter",
      platform: "wechat_channels",
      author: "wechat-article",
      excerpt: "支持 HTML、Markdown、Excel 等格式导出。",
      tags: ["采集", "导出"]
    });

    const afterFilter = await repository.filterSourceReferences({
      columnSlug: "ai",
      platform: "wechat_channels",
      tag: "采集",
      query: "Markdown"
    });

    expect(afterFilter.sourceReferences.map((source) => source.title)).toEqual(["微信公众号文章导出器"]);
  });

  it("marks source references as used when attached to a project in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterAdd = await repository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "AI 工作流文章",
      url: "https://example.com/ai-workflow"
    });
    const sourceId = afterAdd.sourceReferences.find((source) => source.title === "AI 工作流文章")?.id;

    if (!sourceId) {
      throw new Error("Expected a source reference to be added.");
    }

    const afterUse = await repository.markSourceReferenceUsed(sourceId, "project_ai_workflow");

    expect(afterUse.sourceReferences.find((source) => source.id === sourceId)).toMatchObject({
      contentProjectId: "project_ai_workflow",
      usageStatus: "used"
    });
  });

  it("creates export files from in-memory state", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    await repository.addSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter"
    });
    const exported = await repository.createContentLoopExport("markdown");

    expect(exported.fileName).toBe("robert-station-export.md");
    expect(exported.content).toContain("微信公众号文章导出器");
  });

  it("records task progress in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    const afterStart = await repository.startTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "export",
      label: "导出资料库",
      totalCount: 2
    });
    const taskId = afterStart.taskRuns[0]?.id;

    if (!taskId) {
      throw new Error("Expected a task run to be recorded.");
    }

    const afterAdvance = await repository.advanceTaskRun(taskId, {
      phase: "writing",
      completedCount: 1,
      message: "写入 Markdown"
    });

    expect(afterAdvance.taskRuns[0]).toMatchObject({
      id: taskId,
      phase: "writing",
      status: "running",
      completedCount: 1,
      message: "写入 Markdown"
    });
  });

  it("generates the next draft package in memory for a promoted project", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterGenerate = await repository.generateDraftPackage(projectId);

    expect(afterGenerate.drafts.filter((draft) => draft.contentProjectId === projectId)).toHaveLength(2);
    expect(afterGenerate.drafts[0]?.version).toBe(2);
    expect(afterGenerate.drafts[0]?.body).toContain("标题选项");
    expect(afterGenerate.selectedProjectId).toBe(projectId);
  });

  it("uses a configured runtime for in-memory draft generation", async () => {
    const runtime = {
      generateTopics: vi.fn(),
      generateDraft: vi.fn(async () => ({
        package: {
          brief: "Runtime brief",
          titleOptions: ["Runtime title", "Runtime title 2"],
          bodyDraft: "Runtime body",
          coverCopy: "Runtime cover",
          tags: ["#runtime"],
          visualDirection: "Runtime visual direction",
          pendingVerification: ["Runtime verification"]
        }
      }))
    };
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station", { agentRuntime: runtime });
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const state = await repository.generateDraftPackage(projectId);

    expect(runtime.generateDraft).toHaveBeenCalledOnce();
    expect(state.drafts[0]?.body).toContain("Runtime brief");
    expect(state.drafts[0]?.body).toContain("Runtime body");
    expect(state.drafts[0]?.body).toContain("Runtime verification");
    expect(state.taskRuns[0]).toMatchObject({
      kind: "generation",
      status: "completed",
      message: "Agent runtime generated draft."
    });
  });

  it("generates a Xiaohongshu platform package in memory for the latest draft", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterDraft = await repository.generateDraftPackage(projectId);
    const latestDraft = afterDraft.drafts.find((draft) => draft.contentProjectId === projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");

    expect(afterPackage.platformPackages).toHaveLength(1);
    expect(afterPackage.platformPackages[0]?.platform).toBe("xiaohongshu");
    expect(afterPackage.platformPackages[0]?.contentProjectId).toBe(projectId);
    expect(afterPackage.platformPackages[0]?.draftVersionId).toBe(latestDraft?.id);
    expect(afterPackage.platformPackages[0]?.tags).toContain("#ai");
    expect(afterPackage.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory platform package for repeated generation on the same draft", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterFirstPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterSecondPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");

    expect(afterFirstPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages[0]?.id).toBe(afterFirstPackage.platformPackages[0]?.id);
  });

  it("does not insert a platform package when the project is missing", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const afterGenerate = await repository.generatePlatformPackage("project_missing", "xiaohongshu");

    expect(afterGenerate).toEqual(before);
  });

  it("records a manual publish in memory and marks the project as published", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
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

    const afterPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "Published manually."
    });

    expect(afterPublish.publishRecords).toHaveLength(1);
    expect(afterPublish.publishRecords[0]?.platformPackageId).toBe(packageId);
    expect(afterPublish.projects.find((project) => project.id === projectId)?.status).toBe("published");
    expect(afterPublish.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory publish record and preserves createdAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
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

    const afterFirstPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/first"
    });
    const afterSecondPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T16:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/second"
    });

    expect(afterSecondPublish.publishRecords).toHaveLength(1);
    expect(afterSecondPublish.publishRecords[0]?.id).toBe(afterFirstPublish.publishRecords[0]?.id);
    expect(afterSecondPublish.publishRecords[0]?.createdAt).toBe(afterFirstPublish.publishRecords[0]?.createdAt);
    expect(afterSecondPublish.publishRecords[0]?.url).toBe("https://www.xiaohongshu.com/explore/second");
  });

  it("orders multiple in-memory publish records newest first by publishedAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
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
      publishedAt: "2026-05-19T17:00:00.000Z"
    });
    const afterSecondPublish = await repository.recordManualPublish({
      platformPackageId: secondPackageId,
      publishedAt: "2026-05-19T15:00:00.000Z"
    });

    expect(afterSecondPublish.publishRecords).toHaveLength(2);
    expect(afterSecondPublish.publishRecords[0]?.publishedAt).toBe("2026-05-19T17:00:00.000Z");
    expect(afterSecondPublish.publishRecords[1]?.publishedAt).toBe("2026-05-19T15:00:00.000Z");
  });

  it("previews metric CSV rows in memory without saving snapshots", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const afterPreview = await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV_WITH_INVALID_ROW
    });

    expect(afterPublish.metricSnapshots).toHaveLength(0);
    expect(afterPreview.metricSnapshots).toHaveLength(0);
    expect(afterPreview.metricImportPreview?.rows).toHaveLength(2);
    expect(afterPreview.metricImportPreview?.rows.filter((row) => row.status === "matched")).toHaveLength(1);
    expect(afterPreview.metricImportPreview?.rows.filter((row) => row.status === "invalid")).toHaveLength(1);
  });

  it("saves matched metric preview rows in memory and clears the preview", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    await publishXiaohongshuDemo(repository);
    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV
    });
    const afterSave = await repository.saveMetricImport();

    expect(afterSave.metricSnapshots).toHaveLength(1);
    expect(afterSave.metricSnapshots[0]).toMatchObject({
      views: 100,
      likes: 10,
      favorites: 8,
      comments: 3,
      shares: 2,
      note: "good"
    });
    expect(afterSave.metricImportPreview).toBeNull();
  });

  it("does not change in-memory state when saving without a metric preview", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const afterSave = await repository.saveMetricImport();

    expect(afterSave).toEqual(before);
  });

  it("replaces an in-memory metric snapshot and preserves createdAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    await publishXiaohongshuDemo(repository);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-20T10:00:00.000Z"));
      await repository.previewMetricCsvImport({
        sourceFileName: "metrics.csv",
        csvText: METRIC_CSV
      });
      const afterFirstSave = await repository.saveMetricImport();

      vi.setSystemTime(new Date("2026-05-20T11:00:00.000Z"));
      await repository.previewMetricCsvImport({
        sourceFileName: "metrics.csv",
        csvText:
          "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
          "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,150,20,10,4,3,2026-05-20T08:00:00.000Z,better"
      });
      const afterSecondSave = await repository.saveMetricImport();

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
    } finally {
      vi.useRealTimers();
    }
  });

  it("generates a review report in memory and marks project reviewed", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    if (!publishRecord) {
      throw new Error("Expected a publish record.");
    }

    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV
    });
    const afterSave = await repository.saveMetricImport();
    const metricSnapshot = afterSave.metricSnapshots[0];

    if (!metricSnapshot) {
      throw new Error("Expected a saved metric snapshot.");
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
      const afterReview = await repository.generateReviewReport(publishRecord.id);
      const reviewReports = afterReview.reviewReports ?? [];
      const report = reviewReports[0];

      expect(reviewReports).toHaveLength(1);
      expect(report).toMatchObject({
        id: createEntityId("review-report", `${publishRecord.id}-v1`),
        publishRecordId: publishRecord.id,
        metricSnapshotId: metricSnapshot.id,
        version: 1,
        updatedAt: "2026-05-20T12:00:00.000Z"
      });
      expect(afterReview.projects.find((project) => project.id === publishRecord.contentProjectId)?.status).toBe(
        "reviewed"
      );
      expect(afterReview.projects.find((project) => project.id === publishRecord.contentProjectId)?.updatedAt).toBe(
        report?.updatedAt
      );
      expect(afterReview.selectedProjectId).toBe(publishRecord.contentProjectId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates increasing in-memory review report versions", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    if (!publishRecord) {
      throw new Error("Expected a publish record.");
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
      await repository.generateReviewReport(publishRecord.id);

      vi.setSystemTime(new Date("2026-05-20T13:00:00.000Z"));
      const afterSecondReview = await repository.generateReviewReport(publishRecord.id);
      const reviewReports = afterSecondReview.reviewReports ?? [];

      expect(reviewReports).toHaveLength(2);
      expect(reviewReports.map((report) => report.version)).toEqual([2, 1]);
      expect(reviewReports.map((report) => report.id)).toEqual([
        createEntityId("review-report", `${publishRecord.id}-v2`),
        createEntityId("review-report", `${publishRecord.id}-v1`)
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not change in-memory state when the publish record is missing for review generation", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const afterReview = await repository.generateReviewReport("publish-record_missing");

    expect(afterReview).toEqual(before);
  });

  it("extracts review knowledge in memory when archive exists", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    if (!publishRecord) {
      throw new Error("Expected a publish record.");
    }

    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV
    });
    await repository.saveMetricImport();
    const afterReview = await repository.generateReviewReport(publishRecord.id);
    const reviewReport = afterReview.reviewReports[0];

    if (!reviewReport) {
      throw new Error("Expected a review report.");
    }

    await repository.archiveProject(publishRecord.contentProjectId);
    const afterExtract = await repository.extractReviewKnowledge(reviewReport.id);
    const reviewKnowledgeItem = afterExtract.knowledgeItems.find((item) =>
      item.id.startsWith("knowledge-item-review")
    );

    expect(afterExtract.knowledgeItems).toHaveLength(2);
    expect(reviewKnowledgeItem).toMatchObject({
      id: createEntityId("knowledge-item-review", reviewReport.id),
      archiveRecordId: afterExtract.archiveRecords[0]?.id,
      contentProjectId: publishRecord.contentProjectId,
      title: "复盘经验： 如何搭建个人 AI 工作站处理日常内容"
    });
    expect(reviewKnowledgeItem?.lesson).toContain(reviewReport.summary);
    expect(afterExtract.selectedProjectId).toBe(publishRecord.contentProjectId);
  });

  it("replaces same in-memory review knowledge item and preserves createdAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    if (!publishRecord) {
      throw new Error("Expected a publish record.");
    }

    await repository.previewMetricCsvImport({
      sourceFileName: "metrics.csv",
      csvText: METRIC_CSV
    });
    await repository.saveMetricImport();
    const afterReview = await repository.generateReviewReport(publishRecord.id);
    const reviewReport = afterReview.reviewReports[0];

    if (!reviewReport) {
      throw new Error("Expected a review report.");
    }

    await repository.archiveProject(publishRecord.contentProjectId);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-20T14:00:00.000Z"));
      const afterFirstExtract = await repository.extractReviewKnowledge(reviewReport.id);
      const firstReviewKnowledgeItem = afterFirstExtract.knowledgeItems.find((item) =>
        item.id.startsWith("knowledge-item-review")
      );

      vi.setSystemTime(new Date("2026-05-20T15:00:00.000Z"));
      const afterSecondExtract = await repository.extractReviewKnowledge(reviewReport.id);
      const reviewKnowledgeItems = afterSecondExtract.knowledgeItems.filter((item) =>
        item.id.startsWith("knowledge-item-review")
      );
      const secondReviewKnowledgeItem = reviewKnowledgeItems[0];

      expect(reviewKnowledgeItems).toHaveLength(1);
      expect(secondReviewKnowledgeItem?.id).toBe(firstReviewKnowledgeItem?.id);
      expect(secondReviewKnowledgeItem?.createdAt).toBe(firstReviewKnowledgeItem?.createdAt);
      expect(secondReviewKnowledgeItem?.updatedAt).not.toBe(firstReviewKnowledgeItem?.updatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not extract in-memory review knowledge without an archive", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    if (!publishRecord) {
      throw new Error("Expected a publish record.");
    }

    const afterReview = await repository.generateReviewReport(publishRecord.id);
    const reviewReport = afterReview.reviewReports[0];

    if (!reviewReport) {
      throw new Error("Expected a review report.");
    }

    const afterExtract = await repository.extractReviewKnowledge(reviewReport.id);

    expect(afterExtract).toEqual(afterReview);
  });

  it("does not extract in-memory review knowledge for a missing review report", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPublish = await publishXiaohongshuDemo(repository);
    const publishRecord = afterPublish.publishRecords[0];

    if (!publishRecord) {
      throw new Error("Expected a publish record.");
    }

    const before = await repository.archiveProject(publishRecord.contentProjectId);
    const afterExtract = await repository.extractReviewKnowledge("review-report_missing");

    expect(afterExtract).toEqual(before);
  });

  it("archives a generated platform package in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterArchive = await repository.archiveProject(projectId);

    expect(afterArchive.archiveRecords).toHaveLength(1);
    expect(afterArchive.knowledgeItems).toHaveLength(1);
    expect(afterArchive.projects.find((project) => project.id === projectId)?.status).toBe("archived");
    expect(afterArchive.selectedProjectId).toBe(projectId);
  });

  it("replaces archive records and knowledge items when archiving the same project twice", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    await repository.generatePlatformPackage(projectId, "xiaohongshu");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-19T01:00:00.000Z"));
      const afterFirstArchive = await repository.archiveProject(projectId);

      vi.setSystemTime(new Date("2026-05-19T02:00:00.000Z"));
      const afterSecondArchive = await repository.archiveProject(projectId);

      expect(afterSecondArchive.archiveRecords).toHaveLength(1);
      expect(afterSecondArchive.knowledgeItems).toHaveLength(1);
      expect(afterSecondArchive.archiveRecords[0]?.id).toBe(afterFirstArchive.archiveRecords[0]?.id);
      expect(afterSecondArchive.knowledgeItems[0]?.id).toBe(afterFirstArchive.knowledgeItems[0]?.id);
      expect(afterSecondArchive.archiveRecords[0]?.createdAt).toBe(afterFirstArchive.archiveRecords[0]?.createdAt);
      expect(afterSecondArchive.knowledgeItems[0]?.createdAt).toBe(afterFirstArchive.knowledgeItems[0]?.createdAt);
    } finally {
      vi.useRealTimers();
    }
  });
});

const METRIC_CSV =
  "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
  "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good";

const METRIC_CSV_WITH_INVALID_ROW =
  `${METRIC_CSV}\n` +
  "https://www.xiaohongshu.com/explore/missing,,xiaohongshu,1,1,1,1,1,2026-05-20T09:00:00.000Z,bad";

async function publishXiaohongshuDemo(repository: InMemoryContentLoopRepository) {
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
