import { createEntityId } from "./ids";
import type { Column, ContentColumnSlug, WorkspaceSeed } from "./types";

export const DEFAULT_COLUMNS: Array<Pick<Column, "slug" | "name" | "description" | "priority">> = [
  {
    slug: "ai",
    name: "AI",
    description: "AI 工具、工作流、工作站、生产力和 AI 知识科普。",
    priority: 1
  },
  {
    slug: "finance",
    name: "财务",
    description: "个人财务、工具、方法和学习笔记。",
    priority: 1
  },
  {
    slug: "parenting",
    name: "育儿",
    description: "育儿、家庭工作流和日常问题解决。",
    priority: 1
  },
  {
    slug: "fitness",
    name: "健身",
    description: "游泳、健身训练、习惯养成、装备和计划。",
    priority: 1
  }
];

export function createDefaultWorkspaceSeed(name: string, now = new Date("2026-05-19T00:00:00.000Z")): WorkspaceSeed {
  const timestamp = now.toISOString();
  const workspaceId = createEntityId("workspace", name);
  const personaId = createEntityId("persona", `${name}-default`);

  return {
    workspace: {
      id: workspaceId,
      name,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    personas: [
      {
        id: personaId,
        workspaceId,
        name,
        description: "默认创作者画像。",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    platformAccounts: [],
    columns: DEFAULT_COLUMNS.map((column) => ({
      id: createEntityId("column", column.slug satisfies ContentColumnSlug),
      workspaceId,
      slug: column.slug,
      name: column.name,
      description: column.description,
      priority: column.priority,
      createdAt: timestamp,
      updatedAt: timestamp
    }))
  };
}
