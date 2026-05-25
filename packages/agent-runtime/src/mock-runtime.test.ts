import { describe, expect, it } from "vitest";
import { MockContentAgentRuntime, isAgentDraftPackage, isGenerateTopicsOutput } from "./index";

describe("MockContentAgentRuntime", () => {
  it("returns deterministic structured topic candidates", async () => {
    const runtime = new MockContentAgentRuntime();
    const result = await runtime.generateTopics({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      title: "AI 工作流选题：把一次性对话沉淀成内容资产",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      score: { heat: 82, fit: 90, difficulty: 42, personaConsistency: 88 }
    });
    expect(isGenerateTopicsOutput(result)).toBe(true);
  });

  it("returns deterministic structured draft sections", async () => {
    const runtime = new MockContentAgentRuntime();
    const result = await runtime.generateDraft({
      project: {
        id: "project_ai_runtime",
        workspaceId: "workspace_robert-station",
        primaryColumnId: "column_ai",
        sourceTopicId: "topic_ai_runtime",
        title: "把 AI 对话沉淀成内容资产",
        status: "drafting",
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      topic: {
        id: "topic_ai_runtime",
        workspaceId: "workspace_robert-station",
        columnSlug: "ai",
        title: "把 AI 对话沉淀成内容资产",
        hook: "复用来自沉淀，而不是一次次重新问。",
        audience: "正在搭建个人 AI 工作流的创作者。",
        targetPlatforms: ["xiaohongshu"],
        status: "promoted",
        score: { heat: 80, fit: 90, difficulty: 40, personaConsistency: 88 },
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      sourceReferences: [],
      nextVersion: 2,
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(result.package).toMatchObject({
      brief: "面向正在搭建个人 AI 工作流的创作者。，说明把 AI 对话沉淀成内容资产。",
      coverCopy: "把对话变资产"
    });
    expect(result.package.titleOptions).toHaveLength(3);
    expect(result.package.pendingVerification).toContain("核实示例、工具名称和平台规则是否仍然有效。");
    expect(isAgentDraftPackage(result.package)).toBe(true);
  });

  it("rejects invalid structured output", () => {
    expect(isGenerateTopicsOutput({ candidates: [{ title: "missing fields" }] })).toBe(false);
    expect(isAgentDraftPackage({ brief: "missing arrays" })).toBe(false);
  });
});
