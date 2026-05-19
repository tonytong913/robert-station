import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import type { ContentLoopRepository, PersistedContentLoopState } from "@robert-station/local-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerContentLoopIpc } from "../main/content-loop-service";
import {
  CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL,
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL
} from "../main/ipc-channels";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn()
  }
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
  knowledgeItems: [],
  selectedProjectId: null
};

describe("registerContentLoopIpc", () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear();
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
    promoteTopic: vi.fn(async () => emptyState)
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
