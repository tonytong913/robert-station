import { describe, expect, it } from "vitest";
import { generateMockDraftPackage } from "./creation-assistant";
import type { ContentProject, SourceReference, Topic } from "./types";

const topic: Topic = {
  id: "topic_ai_local-workstation",
  workspaceId: "workspace_robert-station",
  columnSlug: "ai",
  title: "How to build a personal AI workstation for daily content work",
  hook: "Turn scattered AI tools into one repeatable daily workflow.",
  audience: "Creators who want practical AI productivity gains.",
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
    expect(draft.body).toContain("Brief");
    expect(draft.body).toContain("Title Options");
    expect(draft.body).toContain("Body Draft");
    expect(draft.body).toContain("Cover Copy");
    expect(draft.body).toContain("Tag Suggestions");
    expect(draft.body).toContain("Visual Direction");
    expect(draft.body).toContain("Pending Verification");
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
    expect(draft.body).toContain("Turn scattered AI tools into one repeatable daily workflow.");
  });
});
