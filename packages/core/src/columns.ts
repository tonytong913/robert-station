import { createEntityId } from "./ids";
import type { Column, ContentColumnSlug, WorkspaceSeed } from "./types";

export const DEFAULT_COLUMNS: Array<Pick<Column, "slug" | "name" | "description" | "priority">> = [
  {
    slug: "ai",
    name: "AI",
    description: "AI tools, workflows, workstations, productivity, and AI knowledge explainers.",
    priority: 1
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Personal finance, tools, methods, and learning notes.",
    priority: 1
  },
  {
    slug: "parenting",
    name: "Parenting",
    description: "Child raising, family workflows, and daily problem solving.",
    priority: 1
  },
  {
    slug: "fitness",
    name: "Fitness",
    description: "Swimming, gym training, habit building, equipment, and plans.",
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
        description: "Default creator persona.",
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
