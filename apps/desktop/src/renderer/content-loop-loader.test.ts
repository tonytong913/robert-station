import { describe, expect, it } from "vitest";
import {
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedTopics,
  loadPersistedContentLoop,
  promotePersistedTopic
} from "./content-loop-loader";

describe("content loop loader", () => {
  it("loads content loop state from preload API", async () => {
    const state = await loadPersistedContentLoop();

    expect(window.robertStation.contentLoop.load).toHaveBeenCalledOnce();
    expect(state.topics).toHaveLength(4);
  });

  it("promotes topics through preload API", async () => {
    await promotePersistedTopic("topic_ai_local-workstation");

    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });

  it("generates topics through preload API", async () => {
    await generatePersistedTopics("ai");

    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("ai");
  });

  it("generates draft packages through preload API", async () => {
    await generatePersistedDraftPackage("project_topic-ai-local-workstation");

    expect(window.robertStation.contentLoop.generateDraftPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("generates platform packages through preload API", async () => {
    await generatePersistedPlatformPackage("project_topic-ai-local-workstation", "xiaohongshu");

    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    );
  });
});
