import { createEntityId } from "./ids";
import type {
  ContentLoopSeed,
  ContentProject,
  DraftVersion,
  SourceReference,
  Topic
} from "./types";

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function createSampleContentLoopSeed(workspaceId: string, now = DEFAULT_NOW): ContentLoopSeed {
  const timestamp = now.toISOString();
  const topics: Topic[] = [
    {
      id: "topic_ai_local-workstation",
      workspaceId,
      columnSlug: "ai",
      title: "How to build a personal AI workstation for daily content work",
      hook: "Turn scattered AI tools into one repeatable daily workflow.",
      audience: "Creators who want practical AI productivity gains.",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      status: "candidate",
      score: { heat: 86, fit: 92, difficulty: 48, personaConsistency: 90 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "topic_finance-family-dashboard",
      workspaceId,
      columnSlug: "finance",
      title: "A simple family finance dashboard for monthly decisions",
      hook: "A lightweight review habit beats complicated spreadsheets.",
      audience: "Families who want calmer monthly money decisions.",
      targetPlatforms: ["xiaohongshu"],
      status: "candidate",
      score: { heat: 72, fit: 84, difficulty: 42, personaConsistency: 82 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "topic_parenting-evening-routine",
      workspaceId,
      columnSlug: "parenting",
      title: "An evening routine that reduces parent-child friction",
      hook: "Make the next morning easier by designing the previous night.",
      audience: "Parents looking for practical daily routines.",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      status: "candidate",
      score: { heat: 78, fit: 80, difficulty: 35, personaConsistency: 78 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "topic_fitness-swim-gym-week",
      workspaceId,
      columnSlug: "fitness",
      title: "How to combine swimming and gym training in one week",
      hook: "Balance cardio, strength, and recovery without over-planning.",
      audience: "Busy adults building a sustainable fitness routine.",
      targetPlatforms: ["xiaohongshu", "douyin"],
      status: "candidate",
      score: { heat: 68, fit: 76, difficulty: 38, personaConsistency: 80 },
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  const sourceReferences: SourceReference[] = topics.map((topic) => ({
    id: createEntityId("source", topic.id),
    workspaceId,
    topicId: topic.id,
    kind: "note",
    title: `Research note for ${topic.title}`,
    note: topic.hook,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  return { topics, sourceReferences };
}

export function createContentProjectFromTopic(
  topic: Topic,
  primaryColumnId: string,
  now = DEFAULT_NOW
): { project: ContentProject; draft: DraftVersion; updatedTopic: Topic } {
  const timestamp = now.toISOString();
  const projectId = createEntityId("project", topic.id);

  return {
    project: {
      id: projectId,
      workspaceId: topic.workspaceId,
      primaryColumnId,
      sourceTopicId: topic.id,
      title: topic.title,
      status: "drafting",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    draft: {
      id: createEntityId("draft", `${projectId}-1`),
      workspaceId: topic.workspaceId,
      contentProjectId: projectId,
      version: 1,
      title: topic.title,
      body: `Brief hook: ${topic.hook}\n\nAudience: ${topic.audience}\n\nDraft outline:\n1. Open with the concrete problem.\n2. Explain the repeatable workflow.\n3. Close with one practical next step.`,
      createdBy: "assistant",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    updatedTopic: {
      ...topic,
      status: "promoted",
      updatedAt: timestamp
    }
  };
}
