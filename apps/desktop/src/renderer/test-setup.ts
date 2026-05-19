import "@testing-library/jest-dom/vitest";
import { createSampleContentLoopSeed } from "@robert-station/core";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

function createMockState() {
  const seed = createSampleContentLoopSeed("workspace_robert-station");

  return {
    topics: seed.topics,
    sourceReferences: seed.sourceReferences,
    projects: [],
    drafts: [],
    selectedProjectId: null
  };
}

beforeEach(() => {
  const state = createMockState();

  window.robertStation = {
    appName: "Robert Station",
    contentLoop: {
      load: vi.fn(async () => state),
      promoteTopic: vi.fn(async () => state)
    }
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
