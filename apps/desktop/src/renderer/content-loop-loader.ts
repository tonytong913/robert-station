import type { ContentColumnSlug, Platform } from "@robert-station/core";
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
