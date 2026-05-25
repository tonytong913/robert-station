import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import {
  DEFAULT_COLUMNS,
  type AdvanceTaskRunInput,
  type ContentColumnSlug,
  type ContentLoopExportFormat,
  type CreateTaskRunInput,
  type ManualPublishInput,
  type ManualSourceReferenceInput,
  type Platform
} from "@robert-station/core";
import type { ContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_ADD_SOURCE_REFERENCE_CHANNEL,
  CONTENT_LOOP_ADVANCE_TASK_RUN_CHANNEL,
  CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL,
  CONTENT_LOOP_CREATE_EXPORT_CHANNEL,
  CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL,
  CONTENT_LOOP_FILTER_SOURCE_REFERENCES_CHANNEL,
  CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL,
  CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL,
  CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL,
  CONTENT_LOOP_START_TASK_RUN_CHANNEL
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
  ipcMain.handle(CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL, async (_event, reviewReportId: unknown) => {
    if (typeof reviewReportId !== "string" || reviewReportId.length === 0) {
      throw new Error("Invalid review report id.");
    }

    return repository.extractReviewKnowledge(reviewReportId);
  });
  ipcMain.handle(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, async (_event, topicId: string) =>
    repository.promoteTopic(topicId)
  );
  ipcMain.handle(CONTENT_LOOP_ADD_SOURCE_REFERENCE_CHANNEL, async (_event, input: unknown) => {
    if (!isManualSourceReferenceInput(input)) {
      throw new Error("Invalid source reference input.");
    }

    return repository.addSourceReference(input);
  });
  ipcMain.handle(CONTENT_LOOP_FILTER_SOURCE_REFERENCES_CHANNEL, async (_event, filter: unknown) => {
    if (!isSourceReferenceFilter(filter)) {
      throw new Error("Invalid source reference filter.");
    }

    return repository.filterSourceReferences(filter);
  });
  ipcMain.handle(CONTENT_LOOP_CREATE_EXPORT_CHANNEL, async (_event, format: unknown) => {
    if (!isContentLoopExportFormat(format)) {
      throw new Error("Unsupported export format.");
    }

    await repository.startTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "export",
      label: `Export ${format}`,
      totalCount: 1
    });
    const exportFile = await repository.createContentLoopExport(format);
    const result = await dialog.showSaveDialog({
      defaultPath: exportFile.fileName,
      filters: [createExportFileFilter(format)]
    });

    if (result.canceled || !result.filePath) {
      await repository.advanceTaskRun("task_export-robert-station-export", {
        phase: "completed",
        completedCount: 1,
        message: `Prepared ${exportFile.fileName}`
      });
      return exportFile;
    }

    await writeFile(result.filePath, exportFile.content, "utf8");
    await repository.advanceTaskRun("task_export-robert-station-export", {
      phase: "completed",
      completedCount: 1,
      message: `Saved ${exportFile.fileName}`
    });

    return {
      ...exportFile,
      filePath: result.filePath
    };
  });
  ipcMain.handle(CONTENT_LOOP_START_TASK_RUN_CHANNEL, async (_event, input: unknown) => {
    if (!isCreateTaskRunInput(input)) {
      throw new Error("Invalid task run input.");
    }

    return repository.startTaskRun(input);
  });
  ipcMain.handle(CONTENT_LOOP_ADVANCE_TASK_RUN_CHANNEL, async (_event, taskRunId: unknown, input: unknown) => {
    if (typeof taskRunId !== "string" || taskRunId.length === 0 || !isAdvanceTaskRunInput(input)) {
      throw new Error("Invalid task run input.");
    }

    return repository.advanceTaskRun(taskRunId, input);
  });
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

function isManualSourceReferenceInput(value: unknown): value is ManualSourceReferenceInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Partial<ManualSourceReferenceInput>;
  return (
    typeof input.workspaceId === "string" &&
    input.workspaceId.length > 0 &&
    typeof input.title === "string" &&
    input.title.length > 0 &&
    (input.columnSlug === undefined || isContentColumnSlug(input.columnSlug)) &&
    (input.url === undefined || typeof input.url === "string") &&
    (input.platform === undefined || isSupportedSourcePlatform(input.platform)) &&
    (input.author === undefined || typeof input.author === "string") &&
    (input.excerpt === undefined || typeof input.excerpt === "string") &&
    (input.note === undefined || typeof input.note === "string") &&
    (input.tags === undefined || (Array.isArray(input.tags) && input.tags.every((tag) => typeof tag === "string")))
  );
}

function isSupportedSourcePlatform(value: unknown): value is Platform {
  return value === "xiaohongshu" || value === "douyin" || value === "wechat_channels" || value === "bilibili";
}

function isContentLoopExportFormat(value: unknown): value is ContentLoopExportFormat {
  return value === "markdown" || value === "json" || value === "csv";
}

function createExportFileFilter(format: ContentLoopExportFormat): Electron.FileFilter {
  if (format === "markdown") {
    return { name: "Markdown", extensions: ["md"] };
  }

  if (format === "json") {
    return { name: "JSON", extensions: ["json"] };
  }

  return { name: "CSV", extensions: ["csv"] };
}

function isSourceReferenceFilter(value: unknown): value is Parameters<ContentLoopRepository["filterSourceReferences"]>[0] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const filter = value as Record<string, unknown>;
  return (
    (filter.columnSlug === undefined || isContentColumnSlug(filter.columnSlug)) &&
    (filter.platform === undefined || isSupportedSourcePlatform(filter.platform)) &&
    (filter.extractionStatus === undefined ||
      filter.extractionStatus === "manual" ||
      filter.extractionStatus === "pending" ||
      filter.extractionStatus === "extracted" ||
      filter.extractionStatus === "failed") &&
    (filter.usageStatus === undefined || filter.usageStatus === "unused" || filter.usageStatus === "used") &&
    (filter.tag === undefined || typeof filter.tag === "string") &&
    (filter.query === undefined || typeof filter.query === "string")
  );
}

function isCreateTaskRunInput(value: unknown): value is CreateTaskRunInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Partial<CreateTaskRunInput>;
  return (
    typeof input.workspaceId === "string" &&
    input.workspaceId.length > 0 &&
    (input.kind === "source_import" || input.kind === "export" || input.kind === "generation") &&
    typeof input.label === "string" &&
    input.label.length > 0 &&
    typeof input.totalCount === "number" &&
    input.totalCount >= 0
  );
}

function isAdvanceTaskRunInput(value: unknown): value is AdvanceTaskRunInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Partial<AdvanceTaskRunInput>;
  return (
    (input.phase === "queued" ||
      input.phase === "parsing" ||
      input.phase === "fetching" ||
      input.phase === "generating" ||
      input.phase === "writing" ||
      input.phase === "completed" ||
      input.phase === "failed") &&
    (input.completedCount === undefined || (typeof input.completedCount === "number" && input.completedCount >= 0)) &&
    (input.totalCount === undefined || (typeof input.totalCount === "number" && input.totalCount >= 0)) &&
    (input.message === undefined || typeof input.message === "string")
  );
}
