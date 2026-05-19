import { createEntityId } from "./ids";
import type {
  ArchiveRecord,
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  KnowledgeItem,
  Platform,
  PlatformPackage,
  SourceReference,
  Topic
} from "./types";

interface GenerateMockArchivePackageRequest {
  project: ContentProject;
  topic?: Topic | null;
  draft?: DraftVersion | null;
  platformPackage?: PlatformPackage | null;
  sourceReferences: SourceReference[];
  now?: Date;
}

interface MockArchivePackage {
  archiveRecord: ArchiveRecord;
  knowledgeItem: KnowledgeItem;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function generateMockArchivePackage(request: GenerateMockArchivePackageRequest): MockArchivePackage {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const archiveRecordId = createEntityId("archive-record", request.project.id);
  const knowledgeItemId = createEntityId("knowledge-item", request.project.id);
  const columnSlug = resolveColumnSlug(request.project, request.topic);
  const packageCount = request.platformPackage ? 1 : 0;
  const title = request.draft?.title || request.project.title;

  const archiveRecord: ArchiveRecord = {
    id: archiveRecordId,
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    title,
    summary: buildSummary(request),
    sourceCount: request.sourceReferences.length,
    packageCount,
    status: "archived",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(request.draft ? { draftVersionId: request.draft.id } : {}),
    ...(request.platformPackage ? { platformPackageId: request.platformPackage.id } : {})
  };

  const knowledgeItem: KnowledgeItem = {
    id: knowledgeItemId,
    workspaceId: request.project.workspaceId,
    archiveRecordId,
    contentProjectId: request.project.id,
    columnSlug,
    title,
    lesson: `Reusable lesson: ${request.topic?.hook || request.draft?.body || request.project.title}`,
    evidence: buildEvidence(request.sourceReferences.length, packageCount),
    tags: [columnSlug, request.platformPackage?.platform ?? "local", "archive"],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return { archiveRecord, knowledgeItem };
}

function resolveColumnSlug(project: ContentProject, topic?: Topic | null): ContentColumnSlug {
  return topic?.columnSlug ?? (project.primaryColumnId.replace(/^column_/, "") as ContentColumnSlug);
}

function buildSummary(request: GenerateMockArchivePackageRequest): string {
  const lead = request.topic?.hook || request.draft?.body || request.project.title;
  const parts = [lead];

  if (request.draft?.title) {
    parts.push(`Latest draft: ${request.draft.title}.`);
  }

  if (request.platformPackage) {
    parts.push(`${formatPlatformName(request.platformPackage.platform)} package: ${request.platformPackage.title}.`);
  }

  parts.push(`${formatCount(request.sourceReferences.length, "source reference")} archived.`);

  return parts.join(" ");
}

function buildEvidence(sourceCount: number, packageCount: number): string {
  return `${formatCount(sourceCount, "source reference")} and ${formatCount(packageCount, "platform package")} archived.`;
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    xiaohongshu: "Xiaohongshu",
    douyin: "Douyin",
    wechat_channels: "Wechat Channels",
    bilibili: "Bilibili"
  };

  return names[platform];
}
