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

export interface ContentLoopSeed {
  topics: Topic[];
  sourceReferences: SourceReference[];
}
