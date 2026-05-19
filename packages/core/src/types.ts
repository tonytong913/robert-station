export type EntityId = string;

export type Platform = "xiaohongshu" | "douyin" | "wechat_channels" | "bilibili";

export type ContentColumnSlug = "ai" | "finance" | "parenting" | "fitness";

export interface Workspace {
  id: EntityId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Persona {
  id: EntityId;
  workspaceId: EntityId;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAccount {
  id: EntityId;
  workspaceId: EntityId;
  personaId: EntityId;
  platform: Platform;
  handle: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: EntityId;
  workspaceId: EntityId;
  slug: ContentColumnSlug;
  name: string;
  description: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSeed {
  workspace: Workspace;
  personas: Persona[];
  platformAccounts: PlatformAccount[];
  columns: Column[];
}

export type TopicStatus = "candidate" | "kept" | "discarded" | "promoted";

export type ContentProjectStatus = "topic" | "drafting" | "ready_to_publish" | "published" | "reviewed" | "archived";

export type SourceReferenceKind = "link" | "note" | "claim" | "risk";

export interface TopicScore {
  heat: number;
  fit: number;
  difficulty: number;
  personaConsistency: number;
}

export interface Topic {
  id: EntityId;
  workspaceId: EntityId;
  columnSlug: ContentColumnSlug;
  title: string;
  hook: string;
  audience: string;
  targetPlatforms: Platform[];
  status: TopicStatus;
  score: TopicScore;
  createdAt: string;
  updatedAt: string;
}

export interface SourceReference {
  id: EntityId;
  workspaceId: EntityId;
  topicId?: EntityId;
  contentProjectId?: EntityId;
  kind: SourceReferenceKind;
  title: string;
  url?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentProject {
  id: EntityId;
  workspaceId: EntityId;
  primaryColumnId: EntityId;
  sourceTopicId?: EntityId;
  title: string;
  status: ContentProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersion {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  version: number;
  title: string;
  body: string;
  createdBy: "assistant" | "human";
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPackageCheck {
  name: string;
  status: "pass" | "warning";
  message: string;
}

export interface PlatformPackage {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  draftVersionId: EntityId;
  platform: Platform;
  title: string;
  body: string;
  tags: string[];
  coverText: string;
  requiredAssets: string[];
  checks: PlatformPackageCheck[];
  createdAt: string;
  updatedAt: string;
}

export interface PublishRecord {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  platformPackageId: EntityId;
  platform: Platform;
  status: "published";
  publishedAt: string;
  url: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPublishInput {
  platformPackageId: EntityId;
  publishedAt: string;
  url?: string;
  note?: string;
}

export interface MetricValues {
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
}

export interface MetricSnapshot extends MetricValues {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  publishRecordId: EntityId;
  platform: Platform;
  sourceFileName: string;
  snapshotAt: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricCsvImportInput {
  sourceFileName: string;
  csvText: string;
}

export interface MetricImportPreview {
  id: EntityId;
  sourceFileName: string;
  rows: MetricImportPreviewRow[];
  createdAt: string;
}

export interface MetricImportPreviewRow {
  rowNumber: number;
  status: "matched" | "invalid";
  publishRecordId?: EntityId;
  url: string;
  platform: Platform;
  publishedAt: string;
  snapshotAt: string;
  metrics: MetricValues;
  note: string;
  error?: string;
}

export interface ArchiveRecord {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  draftVersionId?: EntityId;
  platformPackageId?: EntityId;
  title: string;
  summary: string;
  sourceCount: number;
  packageCount: number;
  status: "archived";
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: EntityId;
  workspaceId: EntityId;
  archiveRecordId: EntityId;
  contentProjectId: EntityId;
  columnSlug: ContentColumnSlug;
  title: string;
  lesson: string;
  evidence: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentLoopSeed {
  topics: Topic[];
  sourceReferences: SourceReference[];
}
