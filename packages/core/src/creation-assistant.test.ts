import { describe, expect, it } from "vitest";
import { generateMockDraftPackage } from "./creation-assistant";
import type { ContentProject, SourceReference, Topic } from "./types";

const topic: Topic = {
  id: "topic_ai_local-workstation",
  workspaceId: "workspace_robert-station",
  columnSlug: "ai",
  title: "如何搭建个人 AI 工作站处理日常内容",
  hook: "把分散的 AI 工具变成可复用的每日工作流。",
  audience: "希望获得实用 AI 提效的创作者。",
  targetPlatforms: ["xiaohongshu", "bilibili"],
  status: "promoted",
  score: { heat: 86, fit: 92, difficulty: 48, personaConsistency: 90 },
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: topic.id,
  title: topic.title,
  status: "drafting",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const sourceReferences: SourceReference[] = [
  {
    id: "source_topic-ai-local-workstation",
    workspaceId: "workspace_robert-station",
    topicId: topic.id,
    kind: "note",
    title: "Research note",
    note: "Verify tool availability and pricing before publishing.",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z"
  }
];

describe("generateMockDraftPackage", () => {
  it("generates a deterministic draft version with creation package sections", () => {
    const draft = generateMockDraftPackage({
      project,
      topic,
      sourceReferences,
      nextVersion: 2,
      now: new Date("2026-05-19T12:00:00.000Z")
    });

    expect(draft.id).toBe("draft_project-topic-ai-local-workstation-2");
    expect(draft.version).toBe(2);
    expect(draft.createdBy).toBe("assistant");
    expect(draft.body).toContain("简报");
    expect(draft.body).toContain("标题选项");
    expect(draft.body).toContain("正文草稿");
    expect(draft.body).toContain("封面文案");
    expect(draft.body).toContain("标签建议");
    expect(draft.body).toContain("视觉方向");
    expect(draft.body).toContain("待核实");
  });

  it("carries source notes into pending verification", () => {
    const draft = generateMockDraftPackage({
      project,
      topic,
      sourceReferences,
      nextVersion: 2,
      now: new Date("2026-05-19T12:00:00.000Z")
    });

    expect(draft.body).toContain("Verify tool availability and pricing before publishing.");
    expect(draft.body).toContain("把分散的 AI 工具变成可复用的每日工作流。");
  });
});
