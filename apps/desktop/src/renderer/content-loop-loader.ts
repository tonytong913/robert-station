import type { PersistedContentLoopState } from "@robert-station/local-store";

export async function loadPersistedContentLoop(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.load();
}

export async function promotePersistedTopic(topicId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.promoteTopic(topicId);
}
