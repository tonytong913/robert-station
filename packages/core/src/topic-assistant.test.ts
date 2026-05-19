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
});
