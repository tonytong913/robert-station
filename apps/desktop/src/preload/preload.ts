import { contextBridge, ipcRenderer } from "electron";
import type { ContentColumnSlug, Platform } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import {
  CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL,
  CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "../main/ipc-channels";

contextBridge.exposeInMainWorld("robertStation", {
  appName: "Robert Station",
  contentLoop: {
    load: () => ipcRenderer.invoke(CONTENT_LOOP_LOAD_CHANNEL) as Promise<PersistedContentLoopState>,
    generateTopics: (columnSlug: ContentColumnSlug) =>
      ipcRenderer.invoke(CONTENT_LOOP_GENERATE_TOPICS_CHANNEL, columnSlug) as Promise<PersistedContentLoopState>,
    generateDraftPackage: (projectId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL, projectId) as Promise<PersistedContentLoopState>,
    generatePlatformPackage: (projectId: string, platform: Platform) =>
      ipcRenderer.invoke(CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL, projectId, platform) as Promise<PersistedContentLoopState>,
    archiveProject: (projectId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL, projectId) as Promise<PersistedContentLoopState>,
    promoteTopic: (topicId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, topicId) as Promise<PersistedContentLoopState>
  }
});
