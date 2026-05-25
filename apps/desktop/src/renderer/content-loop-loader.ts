import type {
  AdvanceTaskRunInput,
  ContentColumnSlug,
  ContentLoopExportFile,
  ContentLoopExportFormat,
  CreateTaskRunInput,
  ManualPublishInput,
  ManualSourceReferenceInput,
  Platform,
  SourceReferenceFilter
} from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";

export async function loadPersistedContentLoop(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.load();
}

export async function promotePersistedTopic(topicId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.promoteTopic(topicId);
}

export async function generatePersistedTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generateTopics(columnSlug);
}

export async function generatePersistedDraftPackage(projectId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generateDraftPackage(projectId);
}

export async function generatePersistedPlatformPackage(
  projectId: string,
  platform: Platform
): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generatePlatformPackage(projectId, platform);
}

export async function archivePersistedProject(projectId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.archiveProject(projectId);
}

export async function recordPersistedManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.recordManualPublish(input);
}

export async function importPersistedMetricCsv(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.importMetricCsv();
}

export async function savePersistedMetricImport(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.saveMetricImport();
}

export async function generatePersistedReviewReport(publishRecordId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generateReviewReport(publishRecordId);
}

export async function extractPersistedReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.extractReviewKnowledge(reviewReportId);
}

export async function addPersistedSourceReference(
  input: ManualSourceReferenceInput
): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.addSourceReference(input);
}

export async function filterPersistedSourceReferences(
  filter: SourceReferenceFilter
): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.filterSourceReferences(filter);
}

export async function createPersistedTopicFromSourceReference(
  sourceReferenceId: string
): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.createTopicFromSourceReference(sourceReferenceId);
}

export async function createPersistedContentLoopExport(
  format: ContentLoopExportFormat
): Promise<ContentLoopExportFile> {
  return window.robertStation.contentLoop.createContentLoopExport(format);
}

export async function startPersistedTaskRun(input: CreateTaskRunInput): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.startTaskRun(input);
}

export async function advancePersistedTaskRun(
  taskRunId: string,
  input: AdvanceTaskRunInput
): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.advanceTaskRun(taskRunId, input);
}
