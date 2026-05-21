import "@testing-library/jest-dom/vitest";
import type { ContentColumnSlug, ManualPublishInput, Platform } from "@robert-station/core";
import { InMemoryContentLoopRepository } from "@robert-station/local-store";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useContentLoopStore } from "./stores/content-loop-store";
import { useUiStore } from "./stores/ui-store";

beforeEach(() => {
  const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

  window.robertStation = {
    appName: "Robert Station",
    contentLoop: {
      load: vi.fn(async () => repository.loadContentLoop()),
      generateTopics: vi.fn(async (columnSlug: ContentColumnSlug) => repository.generateTopics(columnSlug)),
      generateDraftPackage: vi.fn(async (projectId: string) => repository.generateDraftPackage(projectId)),
      generatePlatformPackage: vi.fn(async (projectId: string, platform: Platform) =>
        repository.generatePlatformPackage(projectId, platform)
      ),
      archiveProject: vi.fn(async (projectId: string) => repository.archiveProject(projectId)),
      recordManualPublish: vi.fn(async (input: ManualPublishInput) => repository.recordManualPublish(input)),
      importMetricCsv: vi.fn(async () =>
        repository.previewMetricCsvImport({
          sourceFileName: "metrics.csv",
          csvText:
            "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n" +
            "https://www.xiaohongshu.com/explore/demo,,xiaohongshu,100,10,8,3,2,2026-05-20T08:00:00.000Z,good"
        })
      ),
      saveMetricImport: vi.fn(async () => repository.saveMetricImport()),
      generateReviewReport: vi.fn(async (publishRecordId: string) => repository.generateReviewReport(publishRecordId)),
      extractReviewKnowledge: vi.fn(async (reviewReportId: string) => repository.extractReviewKnowledge(reviewReportId)),
      promoteTopic: vi.fn(async (topicId: string) => repository.promoteTopic(topicId))
    }
  };
});

afterEach(() => {
  cleanup();
  useContentLoopStore.getState().reset();
  useUiStore.getState().reset();
  vi.restoreAllMocks();
});
