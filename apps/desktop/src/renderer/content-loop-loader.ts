import type { ContentColumnSlug, ManualPublishInput, Platform } from "@robert-station/core";
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
