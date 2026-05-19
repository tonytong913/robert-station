import { describe, expect, it } from "vitest";
import { generateMockArchivePackage } from "./archive-assistant";
import type { ContentProject, DraftVersion, PlatformPackage, SourceReference, Topic } from "./types";

const topic: Topic = {
  id: "topic_ai_local-workstation",
  workspaceId: "workspace_robert-station",
  columnSlug: "ai",
  title: "Personal AI workstation",
  hook: "Turn scattered AI tools into one repeatable daily workflow.",
  audience: "Creators who want practical AI productivity gains.",
  targetPlatforms: ["xiaohongshu"],
  status: "promoted",
  score: {
    heat: 8,
    fit: 9,
    difficulty: 4,
    personaConsistency: 9
  },
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: topic.id,
  title: "How to build a personal AI workstation for daily content work",
  status: "published",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const draft: DraftVersion = {
  id: "draft_project-topic-ai-local-workstation-2",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  version: 2,
  title: "How to build a personal AI workstation for daily content work",
  body: "AI workstation flow for repeatable local content production.",
  createdBy: "assistant",
  createdAt: "2026-05-19T12:00:00.000Z",
  updatedAt: "2026-05-19T12:00:00.000Z"
};

const platformPackage: PlatformPackage = {
  id: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  draftVersionId: draft.id,
  platform: "xiaohongshu",
  title: "AI workstation flow",
  body: "Turn the daily AI content workflow into a publishable Xiaohongshu post.",
  tags: ["#ai", "#workflow"],
  coverText: "Make the workflow visible",
  requiredAssets: ["Cover image"],
  checks: [
    {
      name: "Title length",
      status: "pass",
      message: "Title fits the v0 Xiaohongshu length target."
    }
  ],
  createdAt: "2026-05-19T13:00:00.000Z",
  updatedAt: "2026-05-19T13:00:00.000Z"
};

const sourceReference: SourceReference = {
  id: "source-reference_ai-workstation-note",
  workspaceId: "workspace_robert-station",
  topicId: topic.id,
  contentProjectId: project.id,
  kind: "note",
  title: "AI workstation operating note",
  note: "The strongest hook is making the local workstation workflow visible.",
  createdAt: "2026-05-19T08:00:00.000Z",
  updatedAt: "2026-05-19T08:00:00.000Z"
};

describe("generateMockArchivePackage", () => {
  it("generates deterministic archive and knowledge records", () => {
    const archivePackage = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences: [sourceReference]
    });

    expect(archivePackage.archiveRecord.id).toBe("archive-record_project-topic-ai-local-workstation");
    expect(archivePackage.archiveRecord.contentProjectId).toBe(project.id);
    expect(archivePackage.archiveRecord.draftVersionId).toBe(draft.id);
    expect(archivePackage.archiveRecord.platformPackageId).toBe(platformPackage.id);
    expect(archivePackage.archiveRecord.sourceCount).toBe(1);
    expect(archivePackage.archiveRecord.packageCount).toBe(1);
    expect(archivePackage.archiveRecord.status).toBe("archived");
    expect(archivePackage.knowledgeItem.id).toBe("knowledge-item_project-topic-ai-local-workstation");
    expect(archivePackage.knowledgeItem.archiveRecordId).toBe(archivePackage.archiveRecord.id);
    expect(archivePackage.knowledgeItem.columnSlug).toBe("ai");
    expect(archivePackage.knowledgeItem.tags).toEqual(["ai", "xiaohongshu", "archive"]);
  });

  it("uses source and package evidence in the knowledge item", () => {
    const archivePackage = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences: [sourceReference]
    });

    expect(archivePackage.archiveRecord.summary).toContain(topic.hook);
    expect(archivePackage.archiveRecord.summary).toContain("Xiaohongshu package: AI workstation flow.");
    expect(archivePackage.knowledgeItem.lesson).toContain("Reusable lesson:");
    expect(archivePackage.knowledgeItem.evidence).toContain("1 source reference");
    expect(archivePackage.knowledgeItem.evidence).toContain("1 platform package");
  });

  it("archives a project without topic draft or platform package records", () => {
    const archivePackage = generateMockArchivePackage({
      project,
      sourceReferences: [],
      now: new Date("2026-05-19T14:00:00.000Z")
    });
    const nullableArchivePackage = generateMockArchivePackage({
      project,
      topic: null,
      draft: null,
      platformPackage: null,
      sourceReferences: [],
      now: new Date("2026-05-19T14:00:00.000Z")
    });

    expect(archivePackage.archiveRecord).not.toHaveProperty("draftVersionId");
    expect(archivePackage.archiveRecord).not.toHaveProperty("platformPackageId");
    expect(archivePackage.archiveRecord.sourceCount).toBe(0);
    expect(archivePackage.archiveRecord.packageCount).toBe(0);
    expect(archivePackage.knowledgeItem.columnSlug).toBe("ai");
    expect(archivePackage.knowledgeItem.tags).toEqual(["ai", "local", "archive"]);
    expect(archivePackage.knowledgeItem.evidence).toContain("0 source references");
    expect(archivePackage.knowledgeItem.evidence).toContain("0 platform packages");
    expect(nullableArchivePackage.knowledgeItem.tags).toEqual(["ai", "local", "archive"]);
  });
});
