import { ipcMain } from "electron";
import { DEFAULT_COLUMNS, type ContentColumnSlug, type Platform } from "@robert-station/core";
import type { ContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";

const CONTENT_COLUMN_SLUGS = new Set<string>(DEFAULT_COLUMNS.map((column) => column.slug));

export function registerContentLoopIpc(repository: ContentLoopRepository): void {
  ipcMain.handle(CONTENT_LOOP_LOAD_CHANNEL, async () => repository.loadContentLoop());
  ipcMain.handle(CONTENT_LOOP_GENERATE_TOPICS_CHANNEL, async (_event, columnSlug: unknown) => {
    if (!isContentColumnSlug(columnSlug)) {
      throw new Error("Invalid content column slug.");
    }

    return repository.generateTopics(columnSlug);
  });
  ipcMain.handle(CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL, async (_event, projectId: unknown) => {
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new Error("Invalid content project id.");
    }

    return repository.generateDraftPackage(projectId);
  });
  ipcMain.handle(CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL, async (_event, projectId: unknown, platform: unknown) => {
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new Error("Invalid content project id.");
    }

    if (!isSupportedPublishPlatform(platform)) {
      throw new Error("Unsupported publish platform.");
    }

    return repository.generatePlatformPackage(projectId, platform);
  });
  ipcMain.handle(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, async (_event, topicId: string) =>
    repository.promoteTopic(topicId)
  );
}

function isContentColumnSlug(value: unknown): value is ContentColumnSlug {
  return typeof value === "string" && CONTENT_COLUMN_SLUGS.has(value);
}

function isSupportedPublishPlatform(value: unknown): value is Platform {
  return value === "xiaohongshu";
}
