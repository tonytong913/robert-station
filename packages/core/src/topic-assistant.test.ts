import { describe, expect, it } from "vitest";
import { generateMockTopics } from "./topic-assistant";

describe("generateMockTopics", () => {
  it("generates two stable AI topics with source references", () => {
    const result = generateMockTopics({ columnSlug: "ai", workspaceId: "workspace_robert-station" });

    expect(result.topics).toHaveLength(2);
    expect(result.sourceReferences).toHaveLength(2);
    expect(result.topics[0]?.id).toBe("topic_ai_mock-workflow-automations");
    expect(result.topics[0]?.columnSlug).toBe("ai");
    expect(result.topics[0]?.status).toBe("candidate");
    expect(result.sourceReferences[0]?.topicId).toBe("topic_ai_mock-workflow-automations");
    expect(result.sourceReferences[0]?.note).toContain("Verify");
  });

  it("generates column-specific topics for each supported column", () => {
    const columns = ["ai", "finance", "parenting", "fitness"] as const;

    for (const columnSlug of columns) {
      const result = generateMockTopics({ columnSlug, workspaceId: "workspace_robert-station" });

      expect(result.topics).toHaveLength(2);
      expect(result.topics.every((topic) => topic.columnSlug === columnSlug)).toBe(true);
      expect(result.sourceReferences.every((source) => source.topicId?.startsWith(`topic_${columnSlug}_`))).toBe(true);
    }
  });

  it("isolates generated topic data from shared templates", () => {
    const firstResult = generateMockTopics({ columnSlug: "ai", workspaceId: "workspace_robert-station" });

    firstResult.topics[0]?.targetPlatforms.push("douyin");
    if (firstResult.topics[0]) {
      firstResult.topics[0].score.heat = 1;
    }

    const secondResult = generateMockTopics({ columnSlug: "ai", workspaceId: "workspace_robert-station" });

    expect(secondResult.topics[0]?.targetPlatforms).toEqual(["xiaohongshu", "bilibili"]);
    expect(secondResult.topics[0]?.score).toEqual({ heat: 84, fit: 92, difficulty: 44, personaConsistency: 91 });
  });
});
