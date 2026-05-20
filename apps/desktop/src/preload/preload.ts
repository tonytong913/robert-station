import { contextBridge, ipcRenderer } from "electron";
import type { ContentColumnSlug, ManualPublishInput, Platform } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import {
  CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL,
  CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL,
  CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL,
  CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL,
  CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL
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
    recordManualPublish: (input: ManualPublishInput) =>
      ipcRenderer.invoke(CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL, input) as Promise<PersistedContentLoopState>,
    importMetricCsv: () =>
      ipcRenderer.invoke(CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL) as Promise<PersistedContentLoopState>,
    saveMetricImport: () =>
      ipcRenderer.invoke(CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL) as Promise<PersistedContentLoopState>,
    generateReviewReport: (publishRecordId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL, publishRecordId) as Promise<PersistedContentLoopState>,
    extractReviewKnowledge: (reviewReportId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL, reviewReportId) as Promise<PersistedContentLoopState>,
    promoteTopic: (topicId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, topicId) as Promise<PersistedContentLoopState>
  }
});
