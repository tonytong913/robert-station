import { describe, expect, it } from "vitest";
import { generatePersistedTopics, loadPersistedContentLoop, promotePersistedTopic } from "./content-loop-loader";

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
});
