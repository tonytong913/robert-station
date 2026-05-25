import { describe, expect, it } from "vitest";
import {
  archivePersistedProject,
  extractPersistedReviewKnowledge,
  addPersistedSourceReference,
  createPersistedContentLoopExport,
  createPersistedTopicFromSourceReference,
  filterPersistedSourceReferences,
  startPersistedTaskRun,
  advancePersistedTaskRun,
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedReviewReport,
  generatePersistedTopics,
  importPersistedMetricCsv,
  loadPersistedContentLoop,
  promotePersistedTopic,
  recordPersistedManualPublish,
  savePersistedMetricImport
} from "./content-loop-loader";

describe("content loop loader", () => {
  it("loads content loop state from preload API", async () => {
    const state = await loadPersistedContentLoop();

    expect(window.robertStation.contentLoop.load).toHaveBeenCalledOnce();
    expect(state.topics).toHaveLength(4);
  });

  it("promotes topics through preload API", async () => {
    await promotePersistedTopic("topic_ai_local-workstation");

    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });

  it("generates topics through preload API", async () => {
    await generatePersistedTopics("ai");

    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("ai");
  });

  it("generates draft packages through preload API", async () => {
    await generatePersistedDraftPackage("project_topic-ai-local-workstation");

    expect(window.robertStation.contentLoop.generateDraftPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("generates platform packages through preload API", async () => {
    await generatePersistedPlatformPackage("project_topic-ai-local-workstation", "xiaohongshu");

    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    );
  });

  it("archives projects through preload API", async () => {
    await archivePersistedProject("project_topic-ai-local-workstation");

    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith("project_topic-ai-local-workstation");
  });

  it("records manual publishes through preload API", async () => {
    const input = {
      platformPackageId:
        "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo"
    };

    await recordPersistedManualPublish(input);

    expect(window.robertStation.contentLoop.recordManualPublish).toHaveBeenCalledWith(input);
  });

  it("imports metric CSV through preload API", async () => {
    await importPersistedMetricCsv();

    expect(window.robertStation.contentLoop.importMetricCsv).toHaveBeenCalledOnce();
  });

  it("saves metric import through preload API", async () => {
    await savePersistedMetricImport();

    expect(window.robertStation.contentLoop.saveMetricImport).toHaveBeenCalledOnce();
  });

  it("generates review reports through preload API", async () => {
    await generatePersistedReviewReport("publish-record_demo");

    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledWith("publish-record_demo");
  });

  it("extracts review knowledge through preload API", async () => {
    await extractPersistedReviewKnowledge("review-report_demo");

    expect(window.robertStation.contentLoop.extractReviewKnowledge).toHaveBeenCalledWith("review-report_demo");
  });

  it("adds source references through preload API", async () => {
    const input = {
      workspaceId: "workspace_robert-station",
      columnSlug: "ai" as const,
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter"
    };

    await addPersistedSourceReference(input);

    expect(window.robertStation.contentLoop.addSourceReference).toHaveBeenCalledWith(input);
  });

  it("creates content loop exports through preload API", async () => {
    await createPersistedContentLoopExport("markdown");

    expect(window.robertStation.contentLoop.createContentLoopExport).toHaveBeenCalledWith("markdown");
  });

  it("filters source references through preload API", async () => {
    await filterPersistedSourceReferences({ columnSlug: "ai", query: "资料库" });

    expect(window.robertStation.contentLoop.filterSourceReferences).toHaveBeenCalledWith({
      columnSlug: "ai",
      query: "资料库"
    });
  });

  it("creates topics from source references through preload API", async () => {
    await createPersistedTopicFromSourceReference("source_wechat-case");

    expect(window.robertStation.contentLoop.createTopicFromSourceReference).toHaveBeenCalledWith("source_wechat-case");
  });

  it("starts and advances task runs through preload API", async () => {
    const input = {
      workspaceId: "workspace_robert-station",
      kind: "export" as const,
      label: "导出资料库",
      totalCount: 1
    };

    await startPersistedTaskRun(input);
    await advancePersistedTaskRun("task_export-robert-station-export", {
      phase: "writing",
      completedCount: 1
    });

    expect(window.robertStation.contentLoop.startTaskRun).toHaveBeenCalledWith(input);
    expect(window.robertStation.contentLoop.advanceTaskRun).toHaveBeenCalledWith(
      "task_export-robert-station-export",
      {
        phase: "writing",
        completedCount: 1
      }
    );
  });
});
