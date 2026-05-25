import { describe, expect, it } from "vitest";
import {
  createManualSourceReference,
  createTopicFromSourceReference,
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

  it("creates a candidate topic from a source reference and marks the source as used", () => {
    const source = createManualSourceReference({
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信长文导出案例",
      url: "https://example.com/wechat-case",
      platform: "wechat_channels",
      excerpt: "多格式导出和资源缓存值得参考。",
      note: "适合作为资料库能力参考。",
      now
    });

    const result = createTopicFromSourceReference(source, now);

    expect(result.topic).toMatchObject({
      id: "topic_source-wechat-case",
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      title: "微信长文导出案例",
      hook: "多格式导出和资源缓存值得参考。",
      audience: "关注该主题的目标读者。",
      targetPlatforms: ["wechat_channels"],
      status: "candidate",
      score: { heat: 60, fit: 75, difficulty: 35, personaConsistency: 70 },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
    expect(result.sourceReference).toMatchObject({
      topicId: "topic_source-wechat-case",
      usageStatus: "used",
      updatedAt: now.toISOString()
    });
    expect(source.topicId).toBeUndefined();
  });
});
