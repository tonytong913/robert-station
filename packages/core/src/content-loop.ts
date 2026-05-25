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
      title: "如何搭建个人 AI 工作站处理日常内容",
      hook: "把分散的 AI 工具变成可复用的每日工作流。",
      audience: "希望获得实用 AI 提效的创作者。",
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
      title: "适合家庭月度决策的简易财务看板",
      hook: "轻量复盘习惯比复杂表格更有效。",
      audience: "希望更从容做月度财务决策的家庭。",
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
      title: "减少亲子摩擦的晚间流程",
      hook: "设计好前一晚，让第二天早晨更轻松。",
      audience: "想建立实用日常流程的家长。",
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
      title: "一周内如何兼顾游泳和力量训练",
      hook: "在不过度计划的情况下平衡有氧、力量和恢复。",
      audience: "正在建立可持续健身习惯的忙碌成年人。",
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
    title: `${topic.title} 的调研笔记`,
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
      body: `简要钩子： ${topic.hook}\n\n受众： ${topic.audience}\n\n草稿大纲：\n1. 用具体问题开场。\n2. 解释可复用的工作流。\n3. 用一个可执行的下一步收尾。`,
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
