import "@testing-library/jest-dom/vitest";
import type { ContentColumnSlug } from "@robert-station/core";
import { InMemoryContentLoopRepository } from "@robert-station/local-store";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

  window.robertStation = {
    appName: "Robert Station",
    contentLoop: {
      load: vi.fn(async () => repository.loadContentLoop()),
      generateTopics: vi.fn(async (columnSlug: ContentColumnSlug) => repository.generateTopics(columnSlug)),
      promoteTopic: vi.fn(async (topicId: string) => repository.promoteTopic(topicId))
    }
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
