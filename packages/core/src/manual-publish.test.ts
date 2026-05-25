import { describe, expect, it } from "vitest";
import { createManualPublishRecord } from "./manual-publish";
import type { ManualPublishInput, PlatformPackage } from "./types";

const platformPackage: PlatformPackage = {
  id: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: "project_topic-ai-local-workstation",
  draftVersionId: "draft_project-topic-ai-local-workstation-2",
  platform: "xiaohongshu",
  title: "AI workstation flow",
  body: "把分散的 AI 工具变成可复用的每日工作流。",
  tags: ["#ai", "#workflow"],
  coverText: "让工作流可视化",
  requiredAssets: ["封面图"],
  checks: [{ name: "正文", status: "pass", message: "正文内容已准备好。" }],
  createdAt: "2026-05-19T13:00:00.000Z",
  updatedAt: "2026-05-19T13:00:00.000Z"
};

describe("createManualPublishRecord", () => {
  it("creates a deterministic publish record from a platform package and manual input", () => {
    const input: ManualPublishInput = {
      platformPackageId: platformPackage.id,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "Published after final title edit."
    };

    const publishRecord = createManualPublishRecord({
      platformPackage,
      input,
      now: new Date("2026-05-19T15:01:00.000Z")
    });

    expect(publishRecord.id).toBe(
      "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu"
    );
    expect(publishRecord.workspaceId).toBe(platformPackage.workspaceId);
    expect(publishRecord.contentProjectId).toBe(platformPackage.contentProjectId);
    expect(publishRecord.platformPackageId).toBe(platformPackage.id);
    expect(publishRecord.platform).toBe("xiaohongshu");
    expect(publishRecord.status).toBe("published");
    expect(publishRecord.publishedAt).toBe(input.publishedAt);
    expect(publishRecord.url).toBe(input.url);
    expect(publishRecord.note).toBe(input.note);
    expect(publishRecord.createdAt).toBe("2026-05-19T15:01:00.000Z");
    expect(publishRecord.updatedAt).toBe("2026-05-19T15:01:00.000Z");
  });

  it("defaults optional url and note to empty strings", () => {
    const publishRecord = createManualPublishRecord({
      platformPackage,
      input: {
        platformPackageId: platformPackage.id,
        publishedAt: "2026-05-19T15:00:00.000Z"
      },
      now: new Date("2026-05-19T15:01:00.000Z")
    });

    expect(publishRecord.url).toBe("");
    expect(publishRecord.note).toBe("");
  });
});
