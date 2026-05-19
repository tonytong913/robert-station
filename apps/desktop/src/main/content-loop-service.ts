import { ipcMain } from "electron";
import type { ContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";

export function registerContentLoopIpc(repository: ContentLoopRepository): void {
  ipcMain.handle(CONTENT_LOOP_LOAD_CHANNEL, async () => repository.loadContentLoop());
  ipcMain.handle(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, async (_event, topicId: string) =>
    repository.promoteTopic(topicId)
  );
}
