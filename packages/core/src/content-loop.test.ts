import { describe, expect, it } from "vitest";
import { createContentProjectFromTopic, createSampleContentLoopSeed } from "./content-loop";

describe("content loop domain", () => {
  it("creates sample topic cards across all four columns", () => {
    const seed = createSampleContentLoopSeed("workspace_robert-station");

    expect(seed.topics.map((topic) => topic.columnSlug)).toEqual([
      "ai",
      "finance",
      "parenting",
      "fitness"
    ]);
    expect(seed.topics.every((topic) => topic.status === "candidate")).toBe(true);
    expect(seed.sourceReferences).toHaveLength(4);
  });

  it("promotes a topic into a draftable content project", () => {
    const seed = createSampleContentLoopSeed("workspace_robert-station");
    const topic = seed.topics[0];
    expect(topic).toBeDefined();

    if (!topic) {
      throw new Error("Expected the sample seed to include at least one topic.");
    }

    const result = createContentProjectFromTopic(topic, "column_ai");

    expect(result.project.title).toBe(topic.title);
    expect(result.project.status).toBe("drafting");
    expect(result.draft.title).toBe(topic.title);
    expect(result.draft.body).toContain(topic.hook);
    expect(result.updatedTopic.status).toBe("promoted");
  });
});
