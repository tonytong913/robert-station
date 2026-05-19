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
