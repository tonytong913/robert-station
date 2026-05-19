import { ipcMain } from "electron";
import { InMemoryContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";

const WORKSPACE_ID = "workspace_robert-station";

export function registerContentLoopIpc(): void {
  const repository = InMemoryContentLoopRepository.createSeeded(WORKSPACE_ID);

  ipcMain.handle(CONTENT_LOOP_LOAD_CHANNEL, async () => repository.loadContentLoop());
  ipcMain.handle(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, async (_event, topicId: string) =>
    repository.promoteTopic(topicId)
  );
}
