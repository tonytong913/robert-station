import { contextBridge, ipcRenderer } from "electron";
import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import {
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
    promoteTopic: (topicId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, topicId) as Promise<PersistedContentLoopState>
  }
});
