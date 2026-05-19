import "@testing-library/jest-dom/vitest";
import { InMemoryContentLoopRepository } from "@robert-station/local-store";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

  window.robertStation = {
    appName: "Robert Station",
    contentLoop: {
      load: vi.fn(async () => repository.loadContentLoop()),
      promoteTopic: vi.fn(async (topicId: string) => repository.promoteTopic(topicId))
    }
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
