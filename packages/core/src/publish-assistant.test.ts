import { describe, expect, it } from "vitest";
import { generateMockXiaohongshuPackage } from "./publish-assistant";
import type { ContentProject, DraftVersion } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "如何搭建个人 AI 工作站处理日常内容",
  status: "drafting",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const draft: DraftVersion = {
  id: "draft_project-topic-ai-local-workstation-2",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  version: 2,
  title: "如何搭建个人 AI 工作站处理日常内容",
  body: [
    "简报",
    "受众： 希望获得实用 AI 提效的创作者。",
    "",
    "正文草稿",
    "把分散的 AI 工具变成可复用的每日工作流。",
    "",
    "封面文案",
    "让工作流可视化",
    "",
    "标签建议",
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
    expect(platformPackage.body).toContain("把分散的 AI 工具变成可复用的每日工作流。");
    expect(platformPackage.tags).toEqual(["#ai", "#workflow", "#content-ops"]);
    expect(platformPackage.coverText).toBe("让工作流可视化");
    expect(platformPackage.requiredAssets).toEqual(["封面图", "1-3 张辅助截图或工作流视觉图"]);
    expect(platformPackage.checks.map((check) => check.name)).toEqual(["标题长度", "正文", "标签", "素材"]);
    expect(platformPackage.createdAt).toBe("2026-05-19T13:00:00.000Z");
  });

  it("adds warning checks when v0 constraints are exceeded", () => {
    const noisyDraft: DraftVersion = {
      ...draft,
      title: "A very long title that needs trimming before Xiaohongshu publishing",
      body: [
        "正文草稿",
        "Short body.",
        "",
        "标签建议",
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
      name: "标签",
      status: "warning",
      message: "v0 小红书发布包请使用 8 个以内标签。"
    });
  });
});
