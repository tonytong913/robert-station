import { readFile } from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import { DEFAULT_COLUMNS, type ContentColumnSlug, type ManualPublishInput, type Platform } from "@robert-station/core";
import type { ContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL,
  CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL,
  CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL,
  CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL
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
  ipcMain.handle(CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL, async (_event, projectId: unknown) => {
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new Error("Invalid content project id.");
    }

    return repository.archiveProject(projectId);
  });
  ipcMain.handle(CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL, async (_event, input: unknown) => {
    if (!isManualPublishInput(input)) {
      throw new Error("Invalid manual publish input.");
    }

    return repository.recordManualPublish(input);
  });
  ipcMain.handle(CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: "CSV files", extensions: ["csv"] }],
      properties: ["openFile"]
    });

    const [filePath] = result.filePaths;

    if (result.canceled || !filePath) {
      return repository.loadContentLoop();
    }

    if (!filePath.toLowerCase().endsWith(".csv")) {
      throw new Error("Could not import metrics CSV.");
    }

    try {
      const csvText = await readFile(filePath, "utf8");
      return repository.previewMetricCsvImport({
        sourceFileName: path.basename(filePath),
        csvText
      });
    } catch {
      throw new Error("Could not import metrics CSV.");
    }
  });
  ipcMain.handle(CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL, async () => repository.saveMetricImport());
  ipcMain.handle(CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL, async (_event, publishRecordId: unknown) => {
    if (typeof publishRecordId !== "string" || publishRecordId.length === 0) {
      throw new Error("Invalid publish record id.");
    }

    return repository.generateReviewReport(publishRecordId);
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

function isManualPublishInput(value: unknown): value is ManualPublishInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Partial<ManualPublishInput>;
  return (
    typeof input.platformPackageId === "string" &&
    input.platformPackageId.length > 0 &&
    typeof input.publishedAt === "string" &&
    input.publishedAt.length > 0 &&
    (input.url === undefined || typeof input.url === "string") &&
    (input.note === undefined || typeof input.note === "string")
  );
}
