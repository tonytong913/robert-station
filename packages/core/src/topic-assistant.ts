import { createEntityId } from "./ids";
import type { ContentColumnSlug, ContentLoopSeed, Platform, TopicScore } from "./types";

interface TopicAssistantRequest {
  columnSlug: ContentColumnSlug;
  workspaceId: string;
  now?: Date;
}

interface MockTopicTemplate {
  suffix: string;
  title: string;
  hook: string;
  audience: string;
  targetPlatforms: Platform[];
  score: TopicScore;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

const MOCK_TOPIC_TEMPLATES: Record<ContentColumnSlug, MockTopicTemplate[]> = {
  ai: [
    {
      suffix: "workflow-automations",
      title: "3 AI workflow automations a solo creator can build this week",
      hook: "Start with repeatable handoffs instead of chasing every new tool.",
      audience: "Creators who want practical AI productivity gains.",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      score: { heat: 84, fit: 92, difficulty: 44, personaConsistency: 91 }
    },
    {
      suffix: "knowledge-base-routine",
      title: "How to turn AI chats into a reusable personal knowledge base",
      hook: "The real leverage comes after the conversation is archived and searchable.",
      audience: "Knowledge workers building repeatable AI workflows.",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      score: { heat: 79, fit: 90, difficulty: 50, personaConsistency: 88 }
    }
  ],
  finance: [
    {
      suffix: "monthly-money-review",
      title: "A 30-minute monthly money review for busy families",
      hook: "Make one calm decision before the next month starts.",
      audience: "Families building a lightweight personal finance habit.",
      targetPlatforms: ["xiaohongshu"],
      score: { heat: 74, fit: 86, difficulty: 36, personaConsistency: 82 }
    },
    {
      suffix: "expense-label-system",
      title: "A simple expense label system that makes spending patterns visible",
      hook: "Better labels make your existing spreadsheet more useful.",
      audience: "Beginners who want clearer household spending decisions.",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      score: { heat: 70, fit: 83, difficulty: 34, personaConsistency: 80 }
    }
  ],
  parenting: [
    {
      suffix: "homework-reset",
      title: "A homework reset routine that lowers parent-child conflict",
      hook: "Change the handoff before trying to change the child.",
      audience: "Parents looking for practical evening routines.",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      score: { heat: 80, fit: 84, difficulty: 40, personaConsistency: 82 }
    },
    {
      suffix: "morning-prep-board",
      title: "A morning prep board that helps children move with less nagging",
      hook: "Make the next action visible before the rush starts.",
      audience: "Parents of school-age children.",
      targetPlatforms: ["xiaohongshu"],
      score: { heat: 76, fit: 82, difficulty: 32, personaConsistency: 79 }
    }
  ],
  fitness: [
    {
      suffix: "swim-gym-recovery",
      title: "How to balance swimming, gym training, and recovery in one week",
      hook: "Progress comes from spacing hard sessions, not stacking them.",
      audience: "Busy adults combining pool and gym training.",
      targetPlatforms: ["xiaohongshu", "douyin"],
      score: { heat: 73, fit: 80, difficulty: 39, personaConsistency: 81 }
    },
    {
      suffix: "beginner-pool-plan",
      title: "A beginner swim plan for people who also lift weights",
      hook: "Keep technique work easy enough that strength training still recovers.",
      audience: "Fitness beginners adding swimming to a gym habit.",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      score: { heat: 69, fit: 78, difficulty: 42, personaConsistency: 77 }
    }
  ]
};

export function generateMockTopics(request: TopicAssistantRequest): ContentLoopSeed {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const templates = MOCK_TOPIC_TEMPLATES[request.columnSlug];
  const topics = templates.map((template) => ({
    id: `topic_${request.columnSlug}_mock-${template.suffix}`,
    workspaceId: request.workspaceId,
    columnSlug: request.columnSlug,
    title: template.title,
    hook: template.hook,
    audience: template.audience,
    targetPlatforms: template.targetPlatforms,
    status: "candidate" as const,
    score: template.score,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const sourceReferences = topics.map((topic) => ({
    id: createEntityId("source", topic.id),
    workspaceId: request.workspaceId,
    topicId: topic.id,
    kind: "note" as const,
    title: `Mock assistant note for ${topic.title}`,
    note: `Mock assistant seed. Verify facts, platform rules, current pricing, and real examples before publishing. ${topic.hook}`,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  return { topics, sourceReferences };
}
