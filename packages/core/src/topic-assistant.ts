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
      title: "本周就能搭建的 3 个个人 AI 工作流自动化",
      hook: "先做可复用交接，而不是追逐每一个新工具。",
      audience: "希望获得实用 AI 提效的创作者。",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      score: { heat: 84, fit: 92, difficulty: 44, personaConsistency: 91 }
    },
    {
      suffix: "knowledge-base-routine",
      title: "如何把 AI 对话沉淀成可复用的个人知识库",
      hook: "真正的杠杆来自对话被归档并可以检索之后。",
      audience: "正在搭建可复用 AI 工作流的知识工作者。",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      score: { heat: 79, fit: 90, difficulty: 50, personaConsistency: 88 }
    }
  ],
  finance: [
    {
      suffix: "monthly-money-review",
      title: "忙碌家庭的 30 分钟月度财务复盘",
      hook: "在下个月开始前，先做一个从容的决定。",
      audience: "正在建立轻量个人财务习惯的家庭。",
      targetPlatforms: ["xiaohongshu"],
      score: { heat: 74, fit: 86, difficulty: 36, personaConsistency: 82 }
    },
    {
      suffix: "expense-label-system",
      title: "让消费模式一眼可见的简单支出标签系统",
      hook: "更好的标签能让现有表格真正有用。",
      audience: "想把家庭支出决策看清楚的新手。",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      score: { heat: 70, fit: 83, difficulty: 34, personaConsistency: 80 }
    }
  ],
  parenting: [
    {
      suffix: "homework-reset",
      title: "降低亲子冲突的作业重启流程",
      hook: "先改变交接方式，再试图改变孩子。",
      audience: "想建立实用晚间流程的家长。",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      score: { heat: 80, fit: 84, difficulty: 40, personaConsistency: 82 }
    },
    {
      suffix: "morning-prep-board",
      title: "让孩子少被催促的晨间准备板",
      hook: "在匆忙开始前，把下一步动作变得可见。",
      audience: "学龄儿童家长。",
      targetPlatforms: ["xiaohongshu"],
      score: { heat: 76, fit: 82, difficulty: 32, personaConsistency: 79 }
    }
  ],
  fitness: [
    {
      suffix: "swim-gym-recovery",
      title: "一周内如何平衡游泳、力量训练和恢复",
      hook: "进步来自错开高强度训练，而不是把它们堆在一起。",
      audience: "同时安排游泳和健身房训练的忙碌成年人。",
      targetPlatforms: ["xiaohongshu", "douyin"],
      score: { heat: 73, fit: 80, difficulty: 39, personaConsistency: 81 }
    },
    {
      suffix: "beginner-pool-plan",
      title: "适合力量训练者的新手游泳计划",
      hook: "技术训练要足够轻，才能让力量训练继续恢复。",
      audience: "想把游泳加入健身习惯的新手。",
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
    targetPlatforms: [...template.targetPlatforms],
    status: "candidate" as const,
    score: { ...template.score },
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const sourceReferences = topics.map((topic) => ({
    id: createEntityId("source", topic.id),
    workspaceId: request.workspaceId,
    topicId: topic.id,
    kind: "note" as const,
    title: `${topic.title} 的模拟助手笔记`,
    note: `模拟助手种子内容。发布前请核实事实、平台规则、当前价格和真实案例。${topic.hook}`,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  return { topics, sourceReferences };
}
