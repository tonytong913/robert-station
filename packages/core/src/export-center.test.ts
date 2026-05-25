import { describe, expect, it } from "vitest";
import { createContentLoopExport } from "./export-center";
import type { ContentLoopExportInput } from "./types";

const input: ContentLoopExportInput = {
  sources: [
    {
      id: "source_wechat-exporter",
      workspaceId: "workspace_robert-station",
      columnSlug: "ai",
      kind: "link",
      title: "微信公众号文章导出器",
      url: "https://example.com/wechat-exporter",
      platform: "wechat_channels",
      author: "wechat-article",
      extractionStatus: "manual",
      usageStatus: "unused",
      excerpt: "支持 HTML、Markdown、Excel 等格式导出。",
      note: "适合作为资料库和导出中心参考。",
      tags: ["采集", "导出"],
      createdAt: "2026-05-25T08:00:00.000Z",
      updatedAt: "2026-05-25T08:00:00.000Z"
    }
  ],
  projects: [
    {
      id: "project_ai_workflow",
      workspaceId: "workspace_robert-station",
      primaryColumnId: "column_ai",
      title: "AI 工作流文章",
      status: "drafting",
      createdAt: "2026-05-25T08:00:00.000Z",
      updatedAt: "2026-05-25T08:00:00.000Z"
    }
  ],
  reviewReports: [],
  knowledgeItems: []
};

describe("export center", () => {
  it("exports source and project material as markdown", () => {
    const result = createContentLoopExport(input, "markdown");

    expect(result.fileName).toBe("robert-station-export.md");
    expect(result.mimeType).toBe("text/markdown;charset=utf-8");
    expect(result.content).toContain("# Robert Station Export");
    expect(result.content).toContain("## Sources");
    expect(result.content).toContain("- [微信公众号文章导出器](https://example.com/wechat-exporter)");
    expect(result.content).toContain("## Projects");
    expect(result.content).toContain("- AI 工作流文章: drafting");
  });

  it("exports structured material as json", () => {
    const result = createContentLoopExport(input, "json");

    expect(result.fileName).toBe("robert-station-export.json");
    expect(result.mimeType).toBe("application/json;charset=utf-8");
    expect(JSON.parse(result.content)).toMatchObject({
      sources: [{ title: "微信公众号文章导出器" }],
      projects: [{ id: "project_ai_workflow" }]
    });
  });

  it("exports source rows as csv", () => {
    const result = createContentLoopExport(input, "csv");

    expect(result.fileName).toBe("robert-station-sources.csv");
    expect(result.mimeType).toBe("text/csv;charset=utf-8");
    expect(result.content.split("\n")[0]).toBe("title,url,columnSlug,platform,author,usageStatus,tags,note");
    expect(result.content).toContain(
      "\"微信公众号文章导出器\",\"https://example.com/wechat-exporter\",\"ai\",\"wechat_channels\",\"wechat-article\",\"unused\",\"采集;导出\",\"适合作为资料库和导出中心参考。\""
    );
  });
});
