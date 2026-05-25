import { createEntityId } from "./ids";
import type {
  ContentColumnSlug,
  Platform,
  SourceExtractionStatus,
  SourceReference,
  SourceUsageStatus,
  Topic
} from "./types";

export interface ManualSourceReferenceInput {
  workspaceId: string;
  columnSlug?: ContentColumnSlug;
  topicId?: string;
  contentProjectId?: string;
  title: string;
  url?: string;
  platform?: Platform;
  author?: string;
  publishedAt?: string;
  extractionStatus?: SourceExtractionStatus;
  usageStatus?: SourceUsageStatus;
  excerpt?: string;
  note?: string;
  tags?: string[];
  now?: Date;
}

export interface SourceReferenceFilter {
  columnSlug?: ContentColumnSlug;
  platform?: Platform;
  extractionStatus?: SourceExtractionStatus;
  usageStatus?: SourceUsageStatus;
  tag?: string;
  query?: string;
}

export function createManualSourceReference(input: ManualSourceReferenceInput): SourceReference {
  const timestamp = (input.now ?? new Date()).toISOString();
  const identity = input.url ? sourceIdentityFromUrl(input.url) : input.title;

  return {
    id: createEntityId("source", identity),
    workspaceId: input.workspaceId,
    ...(input.columnSlug ? { columnSlug: input.columnSlug } : {}),
    ...(input.topicId ? { topicId: input.topicId } : {}),
    ...(input.contentProjectId ? { contentProjectId: input.contentProjectId } : {}),
    kind: input.url ? "link" : "note",
    title: input.title.trim(),
    ...(input.url ? { url: input.url.trim() } : {}),
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.author ? { author: input.author.trim() } : {}),
    ...(input.publishedAt ? { publishedAt: input.publishedAt } : {}),
    extractionStatus: input.extractionStatus ?? "manual",
    usageStatus: input.usageStatus ?? (input.contentProjectId ? "used" : "unused"),
    ...(input.excerpt ? { excerpt: input.excerpt.trim() } : {}),
    note: input.note?.trim() ?? "",
    tags: normalizeTags(input.tags ?? []),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function filterSourceReferences(
  sources: SourceReference[],
  filter: SourceReferenceFilter
): SourceReference[] {
  const query = filter.query?.trim().toLowerCase();
  const tag = filter.tag?.trim().toLowerCase();

  return sources.filter((source) => {
    if (filter.columnSlug && source.columnSlug !== filter.columnSlug) {
      return false;
    }

    if (filter.platform && source.platform !== filter.platform) {
      return false;
    }

    if (filter.extractionStatus && source.extractionStatus !== filter.extractionStatus) {
      return false;
    }

    if (filter.usageStatus && source.usageStatus !== filter.usageStatus) {
      return false;
    }

    if (tag && !(source.tags ?? []).some((candidate) => candidate.toLowerCase() === tag)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [source.title, source.url, source.author, source.excerpt, source.note]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query));
  });
}

export function markSourceReferenceUsed(
  source: SourceReference,
  contentProjectId: string,
  now = new Date()
): SourceReference {
  return {
    ...source,
    contentProjectId,
    usageStatus: "used",
    updatedAt: now.toISOString()
  };
}

export function createTopicFromSourceReference(
  source: SourceReference,
  now = new Date()
): { topic: Topic; sourceReference: SourceReference } {
  const timestamp = now.toISOString();
  const topicId = createEntityId("topic", source.id);
  const topic: Topic = {
    id: topicId,
    workspaceId: source.workspaceId,
    columnSlug: source.columnSlug ?? "ai",
    title: source.title,
    hook: source.excerpt?.trim() || source.note.trim() || "从资料库沉淀一个可展开的内容选题。",
    audience: "关注该主题的目标读者。",
    targetPlatforms: source.platform ? [source.platform] : ["xiaohongshu"],
    status: "candidate",
    score: { heat: 60, fit: 75, difficulty: 35, personaConsistency: 70 },
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    topic,
    sourceReference: {
      ...source,
      topicId,
      usageStatus: "used",
      updatedAt: timestamp
    }
  };
}

function sourceIdentityFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? parsed.hostname;
  } catch {
    return url;
  }
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}
