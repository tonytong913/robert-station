import { describe, expect, it } from "vitest";
import {
  createManualSourceReference,
  filterSourceReferences,
  markSourceReferenceUsed
} from "./source-library";
import type { SourceReference } from "./types";

const now = new Date("2026-05-25T08:00:00.000Z");

describe("source library", () => {
  it("creates a manual source reference with searchable library metadata", () => {
    const source = createManualSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter",
      platform: "wechat_channels",
      author: "wechat-article",
      publishedAt: "2026-05-20T00:00:00.000Z",
      excerpt: "支持 HTML、Markdown、Excel 等格式导出。",
      note: "适合作为资料库和导出中心参考。",
      tags: ["采集", "导出"],
      now
    });

    expect(source).toMatchObject({
      id: "source_wechat-exporter",
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      kind: "link",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter",
      platform: "wechat_channels",
      author: "wechat-article",
      publishedAt: "2026-05-20T00:00:00.000Z",
      extractionStatus: "manual",
      usageStatus: "unused",
      excerpt: "支持 HTML、Markdown、Excel 等格式导出。",
      note: "适合作为资料库和导出中心参考。",
      tags: ["采集", "导出"],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
  });

  it("filters sources by column platform status tags and search text", () => {
    const sources: SourceReference[] = [
      createManualSourceReference({
        workspaceId: "workspace_robert-station",
        columnSlug: "ai",
        title: "AI 工作流文章",
        url: "https://example.com/ai-workflow",
        platform: "wechat_channels",
        excerpt: "资料库导入案例",
        tags: ["导入"],
        now
      }),
      createManualSourceReference({
        workspaceId: "workspace_robert-station",
        columnSlug: "finance",
        title: "家庭财务看板",
        url: "https://example.com/finance-dashboard",
        platform: "xiaohongshu",
        extractionStatus: "extracted",
        usageStatus: "used",
        tags: ["复盘"],
        now
      })
    ];

    const filtered = filterSourceReferences(sources, {
      columnSlug: "ai",
      platform: "wechat_channels",
      extractionStatus: "manual",
      usageStatus: "unused",
      tag: "导入",
      query: "资料库"
    });

    expect(filtered.map((source) => source.title)).toEqual(["AI 工作流文章"]);
  });

  it("marks a source as used by a content project without mutating the original", () => {
    const source = createManualSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "AI 工作流文章",
      url: "https://example.com/ai-workflow",
      now
    });

    const used = markSourceReferenceUsed(source, "project_ai_workflow", now);

    expect(source.usageStatus).toBe("unused");
    expect(source.contentProjectId).toBeUndefined();
    expect(used).toMatchObject({
      usageStatus: "used",
      contentProjectId: "project_ai_workflow",
      updatedAt: now.toISOString()
    });
  });
});
