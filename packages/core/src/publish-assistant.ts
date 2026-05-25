import { createEntityId } from "./ids";
import type { ContentProject, DraftVersion, PlatformPackage, PlatformPackageCheck } from "./types";

interface GenerateMockXiaohongshuPackageRequest {
  project: ContentProject;
  draft: DraftVersion;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");
const MAX_TITLE_LENGTH = 20;
const MAX_COVER_TEXT_LENGTH = 28;
const MAX_TAG_COUNT = 8;

export function generateMockXiaohongshuPackage(request: GenerateMockXiaohongshuPackageRequest): PlatformPackage {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const title = shortenTitle(request.draft.title || request.project.title);
  const body = extractBody(request.draft.body);
  const tags = extractTags(request.draft.body, request.project.primaryColumnId);
  const coverText = extractCoverText(request.draft.body, title);
  const requiredAssets = ["封面图", "1-3 张辅助截图或工作流视觉图"];

  return {
    id: createEntityId("platform-package", `${request.project.id}-${request.draft.id}-xiaohongshu`),
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    draftVersionId: request.draft.id,
    platform: "xiaohongshu",
    title,
    body,
    tags,
    coverText,
    requiredAssets,
    checks: buildChecks({ title, body, tags, requiredAssets }),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function shortenTitle(title: string): string {
  const compact = title.trim().replace(/\s+/g, " ");
  return compact.length <= MAX_TITLE_LENGTH ? compact : compact.slice(0, MAX_TITLE_LENGTH);
}

function extractBody(draftBody: string): string {
  const lines = draftBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const bodyStart = lines.findIndex((line) => line === "正文草稿" || line === "Body Draft");
  const nextSection =
    bodyStart >= 0 ? lines.findIndex((line, index) => index > bodyStart && isSectionHeading(line)) : -1;
  const bodyLines =
    bodyStart >= 0
      ? lines.slice(bodyStart + 1, nextSection > bodyStart ? nextSection : undefined)
      : lines.filter((line) => !line.startsWith("#"));

  return bodyLines.length > 0
    ? bodyLines.join("\n")
    : "分享实用工作流、关键步骤，以及读者今天就能尝试的一个动作。";
}

function extractTags(draftBody: string, primaryColumnId: string): string[] {
  const rawTags = draftBody
    .split(/\s+/)
    .map((part) => part.trim().replace(/[,.，。;；]+$/g, ""))
    .filter((part) => /^#[A-Za-z0-9_-]+$/.test(part));
  const fallbackTag = `#${primaryColumnId.replace(/^column_/, "") || "workflow"}`;
  const uniqueTags = Array.from(new Set(rawTags.length > 0 ? rawTags : [fallbackTag, "#workflow", "#content-ops"]));

  return uniqueTags;
}

function extractCoverText(draftBody: string, title: string): string {
  const lines = draftBody.split("\n").map((line) => line.trim());
  const coverIndex = lines.findIndex((line) => line === "封面文案" || line === "Cover Copy");
  const coverLine = coverIndex >= 0 ? lines.slice(coverIndex + 1).find((line) => line.length > 0) : null;
  const coverText = coverLine ?? title;

  return coverText.length <= MAX_COVER_TEXT_LENGTH ? coverText : coverText.slice(0, MAX_COVER_TEXT_LENGTH);
}

function buildChecks(input: {
  title: string;
  body: string;
  tags: string[];
  requiredAssets: string[];
}): PlatformPackageCheck[] {
  return [
    {
      name: "标题长度",
      status: input.title.length <= MAX_TITLE_LENGTH ? "pass" : "warning",
      message:
        input.title.length <= MAX_TITLE_LENGTH
          ? "标题符合 v0 小红书长度目标。"
          : "请将标题压缩到 20 个字符以内。"
    },
    {
      name: "正文",
      status: input.body.length > 0 ? "pass" : "warning",
      message: input.body.length > 0 ? "正文内容已准备好。" : "发布前请补充正文内容。"
    },
    {
      name: "标签",
      status: input.tags.length <= MAX_TAG_COUNT ? "pass" : "warning",
      message:
        input.tags.length <= MAX_TAG_COUNT
          ? "标签数量符合 v0 小红书发布包要求。"
          : "v0 小红书发布包请使用 8 个以内标签。"
    },
    {
      name: "素材",
      status: input.requiredAssets.length > 0 ? "pass" : "warning",
      message: input.requiredAssets.length > 0 ? "素材清单已准备好。" : "请至少补充一个所需素材。"
    }
  ];
}

function isSectionHeading(line: string): boolean {
  return (
    /^[A-Z][A-Za-z ]+$/.test(line) ||
    ["简报", "标题选项", "正文草稿", "封面文案", "标签建议", "视觉方向", "待核实"].includes(line)
  );
}
