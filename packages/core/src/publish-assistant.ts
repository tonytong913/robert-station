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
  const requiredAssets = ["Cover image", "1-3 supporting screenshots or workflow visuals"];

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
  const bodyStart = lines.findIndex((line) => line === "Body Draft");
  const nextSection =
    bodyStart >= 0 ? lines.findIndex((line, index) => index > bodyStart && /^[A-Z][A-Za-z ]+$/.test(line)) : -1;
  const bodyLines =
    bodyStart >= 0
      ? lines.slice(bodyStart + 1, nextSection > bodyStart ? nextSection : undefined)
      : lines.filter((line) => !line.startsWith("#"));

  return bodyLines.length > 0
    ? bodyLines.join("\n")
    : "Share the practical workflow, key steps, and one action readers can try today.";
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
  const coverIndex = lines.findIndex((line) => line === "Cover Copy");
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
      name: "Title length",
      status: input.title.length <= MAX_TITLE_LENGTH ? "pass" : "warning",
      message:
        input.title.length <= MAX_TITLE_LENGTH
          ? "Title fits the v0 Xiaohongshu length target."
          : "Shorten the title to 20 characters or fewer."
    },
    {
      name: "Body",
      status: input.body.length > 0 ? "pass" : "warning",
      message: input.body.length > 0 ? "Body copy is present." : "Add body copy before publishing."
    },
    {
      name: "Tags",
      status: input.tags.length <= MAX_TAG_COUNT ? "pass" : "warning",
      message:
        input.tags.length <= MAX_TAG_COUNT
          ? "Tag count fits the v0 Xiaohongshu package."
          : "Use 8 or fewer tags for the v0 Xiaohongshu package."
    },
    {
      name: "Assets",
      status: input.requiredAssets.length > 0 ? "pass" : "warning",
      message: input.requiredAssets.length > 0 ? "Asset checklist is present." : "Add at least one required asset."
    }
  ];
}
