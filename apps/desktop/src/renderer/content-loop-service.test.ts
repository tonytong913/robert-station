import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import type { ContentLoopRepository, PersistedContentLoopState } from "@robert-station/local-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerContentLoopIpc } from "../main/content-loop-service";
import { CONTENT_LOOP_GENERATE_TOPICS_CHANNEL } from "../main/ipc-channels";

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
});

function createRepository(): ContentLoopRepository {
  return {
    loadContentLoop: vi.fn(async () => emptyState),
    generateTopics: vi.fn(async () => emptyState),
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
