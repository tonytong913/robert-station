import { describe, expect, it } from "vitest";
import { generateMockXiaohongshuPackage } from "./publish-assistant";
import type { ContentProject, DraftVersion } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "How to build a personal AI workstation for daily content work",
  status: "drafting",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const draft: DraftVersion = {
  id: "draft_project-topic-ai-local-workstation-2",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  version: 2,
  title: "How to build a personal AI workstation for daily content work",
  body: [
    "Brief",
    "Audience: Creators who want practical AI productivity gains.",
    "",
    "Body Draft",
    "Turn scattered AI tools into one repeatable daily workflow.",
    "",
    "Cover Copy",
    "Make the workflow visible",
    "",
    "Tag Suggestions",
    "#ai",
    "#workflow",
    "#content-ops"
  ].join("\n"),
  createdBy: "assistant",
  createdAt: "2026-05-19T12:00:00.000Z",
  updatedAt: "2026-05-19T12:00:00.000Z"
};

describe("generateMockXiaohongshuPackage", () => {
  it("generates a deterministic copy-ready package from a project and draft", () => {
    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft,
      now: new Date("2026-05-19T13:00:00.000Z")
    });

    expect(platformPackage.id).toBe(
      "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu"
    );
    expect(platformPackage.platform).toBe("xiaohongshu");
    expect(platformPackage.contentProjectId).toBe(project.id);
    expect(platformPackage.draftVersionId).toBe(draft.id);
    expect(platformPackage.title.length).toBeLessThanOrEqual(20);
    expect(platformPackage.body).toContain("Turn scattered AI tools into one repeatable daily workflow.");
    expect(platformPackage.tags).toEqual(["#ai", "#workflow", "#content-ops"]);
    expect(platformPackage.coverText).toBe("Make the workflow visible");
    expect(platformPackage.requiredAssets).toEqual(["Cover image", "1-3 supporting screenshots or workflow visuals"]);
    expect(platformPackage.checks.map((check) => check.name)).toEqual(["Title length", "Body", "Tags", "Assets"]);
    expect(platformPackage.createdAt).toBe("2026-05-19T13:00:00.000Z");
  });

  it("adds warning checks when v0 constraints are exceeded", () => {
    const noisyDraft: DraftVersion = {
      ...draft,
      title: "A very long title that needs trimming before Xiaohongshu publishing",
      body: [
        "Body Draft",
        "Short body.",
        "",
        "Tag Suggestions",
        "#one",
        "#two",
        "#three",
        "#four",
        "#five",
        "#six",
        "#seven",
        "#eight",
        "#nine"
      ].join("\n")
    };

    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft: noisyDraft,
      now: new Date("2026-05-19T13:00:00.000Z")
    });

    expect(platformPackage.checks).toContainEqual({
      name: "Tags",
      status: "warning",
      message: "Use 8 or fewer tags for the v0 Xiaohongshu package."
    });
  });
});
