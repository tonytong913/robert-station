import { readFile } from "node:fs/promises";
import type { IpcMainInvokeEvent } from "electron";
import { dialog, ipcMain } from "electron";
import type { ContentLoopRepository, PersistedContentLoopState } from "@robert-station/local-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerContentLoopIpc } from "../main/content-loop-service";
import {
  CONTENT_LOOP_ADD_SOURCE_REFERENCE_CHANNEL,
  CONTENT_LOOP_ADVANCE_TASK_RUN_CHANNEL,
  CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL,
  CONTENT_LOOP_CREATE_EXPORT_CHANNEL,
  CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL,
  CONTENT_LOOP_FILTER_SOURCE_REFERENCES_CHANNEL,
  CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL,
  CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL,
  CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL,
  CONTENT_LOOP_START_TASK_RUN_CHANNEL
} from "../main/ipc-channels";

const fsPromisesMocks = vi.hoisted(() => ({
  readFile: vi.fn()
}));

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: vi.fn()
  },
  ipcMain: {
    handle: vi.fn()
  }
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: fsPromisesMocks.readFile
  },
  readFile: fsPromisesMocks.readFile
}));

const emptyState: PersistedContentLoopState = {
  topics: [],
  sourceReferences: [],
  projects: [],
  drafts: [],
  platformPackages: [],
  archiveRecords: [],
  publishRecords: [],
  metricSnapshots: [],
  metricImportPreview: null,
  reviewReports: [],
  knowledgeItems: [],
  taskRuns: [],
  selectedProjectId: null
};

describe("registerContentLoopIpc", () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear();
    vi.mocked(dialog.showOpenDialog).mockReset();
    vi.mocked(readFile).mockReset();
  });

  it("rejects invalid topic generation column slugs before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGenerateTopicsHandler();

    await expect(handler({} as IpcMainInvokeEvent, "unknown-column")).rejects.toThrow(
      "Invalid content column slug."
    );
    expect(repository.generateTopics).not.toHaveBeenCalled();
  });

  it("rejects invalid platform package project ids before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGeneratePlatformPackageHandler();

    await expect(handler({} as IpcMainInvokeEvent, "", "xiaohongshu")).rejects.toThrow(
      "Invalid content project id."
    );
    expect(repository.generatePlatformPackage).not.toHaveBeenCalled();
  });

  it("rejects unsupported platform package platforms before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGeneratePlatformPackageHandler();

    await expect(handler({} as IpcMainInvokeEvent, "project_topic-ai-local-workstation", "douyin")).rejects.toThrow(
      "Unsupported publish platform."
    );
    expect(repository.generatePlatformPackage).not.toHaveBeenCalled();
  });

  it("rejects invalid archive project ids before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getArchiveProjectHandler();

    await expect(handler({} as IpcMainInvokeEvent, "")).rejects.toThrow("Invalid content project id.");
    expect(repository.archiveProject).not.toHaveBeenCalled();
  });

  it("rejects invalid manual publish inputs before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getRecordManualPublishHandler();

    await expect(handler({} as IpcMainInvokeEvent, { platformPackageId: "", publishedAt: "" })).rejects.toThrow(
      "Invalid manual publish input."
    );
    expect(repository.recordManualPublish).not.toHaveBeenCalled();
  });

  it("imports a selected metrics CSV file before calling the repository", async () => {
    const repository = createRepository();
    const csvText = "url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note\n";
    registerContentLoopIpc(repository);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/metrics.csv"]
    });
    vi.mocked(readFile).mockResolvedValue(csvText);

    const handler = getImportMetricCsvHandler();
    await handler({} as IpcMainInvokeEvent);

    expect(repository.previewMetricCsvImport).toHaveBeenCalledWith({
      sourceFileName: "metrics.csv",
      csvText
    });
  });

  it("returns current state when metrics CSV file selection is canceled", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });

    const handler = getImportMetricCsvHandler();
    const state = await handler({} as IpcMainInvokeEvent);

    expect(state).toEqual(emptyState);
    expect(repository.previewMetricCsvImport).not.toHaveBeenCalled();
  });

  it("saves the metric import through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getSaveMetricImportHandler();
    await handler({} as IpcMainInvokeEvent);

    expect(repository.saveMetricImport).toHaveBeenCalledOnce();
  });

  it("rejects invalid review report publish record ids before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGenerateReviewReportHandler();

    await expect(handler({} as IpcMainInvokeEvent, "")).rejects.toThrow("Invalid publish record id.");
    expect(repository.generateReviewReport).not.toHaveBeenCalled();
  });

  it("generates a review report through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGenerateReviewReportHandler();
    await handler({} as IpcMainInvokeEvent, "publish-record_demo");

    expect(repository.generateReviewReport).toHaveBeenCalledWith("publish-record_demo");
  });

  it("rejects invalid review knowledge ids before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getExtractReviewKnowledgeHandler();

    await expect(handler({} as IpcMainInvokeEvent, "")).rejects.toThrow("Invalid review report id.");
    expect(repository.extractReviewKnowledge).not.toHaveBeenCalled();
  });

  it("extracts review knowledge through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getExtractReviewKnowledgeHandler();
    await handler({} as IpcMainInvokeEvent, "review-report_demo");

    expect(repository.extractReviewKnowledge).toHaveBeenCalledWith("review-report_demo");
  });

  it("rejects unsupported metric CSV file extensions before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/metrics.txt"]
    });

    const handler = getImportMetricCsvHandler();

    await expect(handler({} as IpcMainInvokeEvent)).rejects.toThrow("Could not import metrics CSV.");
    expect(repository.previewMetricCsvImport).not.toHaveBeenCalled();
  });

  it("rejects invalid source reference input before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getAddSourceReferenceHandler();

    await expect(handler({} as IpcMainInvokeEvent, { workspaceId: "", title: "" })).rejects.toThrow(
      "Invalid source reference input."
    );
    expect(repository.addSourceReference).not.toHaveBeenCalled();
  });

  it("adds source references through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);
    const input = {
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter"
    };

    const handler = getAddSourceReferenceHandler();
    await handler({} as IpcMainInvokeEvent, input);

    expect(repository.addSourceReference).toHaveBeenCalledWith(input);
  });

  it("rejects unsupported export formats before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getCreateExportHandler();

    await expect(handler({} as IpcMainInvokeEvent, "pdf")).rejects.toThrow("Unsupported export format.");
    expect(repository.createContentLoopExport).not.toHaveBeenCalled();
  });

  it("creates content loop exports through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getCreateExportHandler();
    await handler({} as IpcMainInvokeEvent, "markdown");

    expect(repository.createContentLoopExport).toHaveBeenCalledWith("markdown");
  });

  it("filters source references through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getFilterSourceReferencesHandler();
    await handler({} as IpcMainInvokeEvent, { columnSlug: "ai", query: "资料库" });

    expect(repository.filterSourceReferences).toHaveBeenCalledWith({ columnSlug: "ai", query: "资料库" });
  });

  it("starts and advances task runs through the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const startHandler = getStartTaskRunHandler();
    await startHandler({} as IpcMainInvokeEvent, {
      workspaceId: "workspace_robert-station",
      kind: "export",
      label: "导出资料库",
      totalCount: 1
    });

    const advanceHandler = getAdvanceTaskRunHandler();
    await advanceHandler({} as IpcMainInvokeEvent, "task_export-robert-station-export", {
      phase: "writing",
      completedCount: 1
    });

    expect(repository.startTaskRun).toHaveBeenCalledOnce();
    expect(repository.advanceTaskRun).toHaveBeenCalledWith("task_export-robert-station-export", {
      phase: "writing",
      completedCount: 1
    });
  });
});

function createRepository(): ContentLoopRepository {
  return {
    loadContentLoop: vi.fn(async () => emptyState),
    generateTopics: vi.fn(async () => emptyState),
    generateDraftPackage: vi.fn(async () => emptyState),
    generatePlatformPackage: vi.fn(async () => emptyState),
    archiveProject: vi.fn(async () => emptyState),
    recordManualPublish: vi.fn(async () => emptyState),
    previewMetricCsvImport: vi.fn(async () => emptyState),
    saveMetricImport: vi.fn(async () => emptyState),
    generateReviewReport: vi.fn(async () => emptyState),
    extractReviewKnowledge: vi.fn(async () => emptyState),
    promoteTopic: vi.fn(async () => emptyState),
    addSourceReference: vi.fn(async () => emptyState),
    filterSourceReferences: vi.fn(async () => emptyState),
    markSourceReferenceUsed: vi.fn(async () => emptyState),
    createContentLoopExport: vi.fn(async () => ({
      fileName: "robert-station-export.md",
      mimeType: "text/markdown;charset=utf-8",
      content: "# Export\n"
    })),
    startTaskRun: vi.fn(async () => emptyState),
    advanceTaskRun: vi.fn(async () => emptyState)
  };
}

function getGenerateTopicsHandler(): (event: IpcMainInvokeEvent, columnSlug: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_GENERATE_TOPICS_CHANNEL);

  if (!handleCall) {
    throw new Error("Generate topics IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, columnSlug: unknown) => Promise<unknown>;
}

function getGeneratePlatformPackageHandler(): (
  event: IpcMainInvokeEvent,
  projectId: unknown,
  platform: unknown
) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL);

  if (!handleCall) {
    throw new Error("Generate platform package IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, projectId: unknown, platform: unknown) => Promise<unknown>;
}

function getArchiveProjectHandler(): (event: IpcMainInvokeEvent, projectId: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL);

  if (!handleCall) {
    throw new Error("Archive project IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, projectId: unknown) => Promise<unknown>;
}

function getRecordManualPublishHandler(): (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL);

  if (!handleCall) {
    throw new Error("Record manual publish IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>;
}

function getImportMetricCsvHandler(): (event: IpcMainInvokeEvent) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_IMPORT_METRIC_CSV_CHANNEL);

  if (!handleCall) {
    throw new Error("Import metric CSV IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent) => Promise<unknown>;
}

function getSaveMetricImportHandler(): (event: IpcMainInvokeEvent) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_SAVE_METRIC_IMPORT_CHANNEL);

  if (!handleCall) {
    throw new Error("Save metric import IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent) => Promise<unknown>;
}

function getGenerateReviewReportHandler(): (
  event: IpcMainInvokeEvent,
  publishRecordId: unknown
) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_GENERATE_REVIEW_REPORT_CHANNEL);

  if (!handleCall) {
    throw new Error("Generate review report IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, publishRecordId: unknown) => Promise<unknown>;
}

function getExtractReviewKnowledgeHandler(): (
  event: IpcMainInvokeEvent,
  reviewReportId: unknown
) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_EXTRACT_REVIEW_KNOWLEDGE_CHANNEL);

  if (!handleCall) {
    throw new Error("Extract review knowledge IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, reviewReportId: unknown) => Promise<unknown>;
}

function getAddSourceReferenceHandler(): (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_ADD_SOURCE_REFERENCE_CHANNEL);

  if (!handleCall) {
    throw new Error("Add source reference IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>;
}

function getCreateExportHandler(): (event: IpcMainInvokeEvent, format: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_CREATE_EXPORT_CHANNEL);

  if (!handleCall) {
    throw new Error("Create export IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, format: unknown) => Promise<unknown>;
}

function getFilterSourceReferencesHandler(): (event: IpcMainInvokeEvent, filter: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_FILTER_SOURCE_REFERENCES_CHANNEL);

  if (!handleCall) {
    throw new Error("Filter source references IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, filter: unknown) => Promise<unknown>;
}

function getStartTaskRunHandler(): (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_START_TASK_RUN_CHANNEL);

  if (!handleCall) {
    throw new Error("Start task run IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>;
}

function getAdvanceTaskRunHandler(): (
  event: IpcMainInvokeEvent,
  taskRunId: unknown,
  input: unknown
) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_ADVANCE_TASK_RUN_CHANNEL);

  if (!handleCall) {
    throw new Error("Advance task run IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, taskRunId: unknown, input: unknown) => Promise<unknown>;
}
