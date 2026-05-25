import type {
  ContentAgentRuntime,
  GenerateDraftInput,
  GenerateDraftOutput,
  GenerateTopicsInput,
  GenerateTopicsOutput
} from "./types";

const TOPIC_TEMPLATES = {
  ai: {
    title: "AI 工作流选题：把一次性对话沉淀成内容资产",
    hook: "复用来自沉淀，而不是一次次重新问。",
    audience: "正在搭建个人 AI 工作流的创作者。",
    targetPlatforms: ["xiaohongshu", "wechat_channels"] as const,
    score: { heat: 82, fit: 90, difficulty: 42, personaConsistency: 88 }
  },
  finance: {
    title: "理财选题：用月度复盘看清家庭现金流",
    hook: "先看清模式，再做下个月的决定。",
    audience: "希望建立轻量财务习惯的家庭。",
    targetPlatforms: ["xiaohongshu", "wechat_channels"] as const,
    score: { heat: 76, fit: 86, difficulty: 38, personaConsistency: 82 }
  },
  parenting: {
    title: "育儿选题：把晚间冲突改成可复用流程",
    hook: "先改变交接方式，再讨论执行细节。",
    audience: "想降低日常摩擦的家长。",
    targetPlatforms: ["xiaohongshu", "wechat_channels"] as const,
    score: { heat: 78, fit: 84, difficulty: 40, personaConsistency: 82 }
  },
  fitness: {
    title: "健身选题：让游泳和力量训练互相支持",
    hook: "训练安排要服务恢复，而不是堆满日程。",
    audience: "同时安排游泳和力量训练的成年人。",
    targetPlatforms: ["xiaohongshu", "douyin"] as const,
    score: { heat: 74, fit: 82, difficulty: 44, personaConsistency: 80 }
  }
};

export class MockContentAgentRuntime implements ContentAgentRuntime {
  async generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
    const template = TOPIC_TEMPLATES[input.columnSlug];

    return {
      candidates: [
        {
          title: template.title,
          hook: template.hook,
          audience: template.audience,
          targetPlatforms: [...template.targetPlatforms],
          score: { ...template.score },
          sourceNotes: [`${template.title} 的模拟 runtime 资料线索。`],
          riskNotes: ["发布前检查平台规则、事实陈述和敏感建议边界。"],
          verificationNotes: ["核实示例、工具名称和平台规则是否仍然有效。"]
        },
        {
          title: `${template.title}的复盘版本`,
          hook: "把一次经验改造成下一次可复用的清单。",
          audience: template.audience,
          targetPlatforms: [...template.targetPlatforms],
          score: {
            heat: template.score.heat - 4,
            fit: template.score.fit - 2,
            difficulty: template.score.difficulty,
            personaConsistency: template.score.personaConsistency
          },
          sourceNotes: [`${template.title} 的复盘角度。`],
          riskNotes: ["避免把个人经验写成普遍结论。"],
          verificationNotes: ["补充真实案例或操作截图后再发布。"]
        }
      ]
    };
  }

  async generateDraft(input: GenerateDraftInput): Promise<GenerateDraftOutput> {
    const audience = input.topic?.audience ?? "希望获得可执行方法的读者";
    const hook = input.topic?.hook ?? "讲清楚核心问题，并给出一个可复用的解决方案。";

    return {
      package: {
        brief: `面向${audience}，说明${input.project.title}。`,
        titleOptions: [
          input.project.title,
          `${input.project.title}：可复用工作流`,
          `我如何把${input.project.title}做成清单`
        ],
        bodyDraft: `用具体问题开场：${hook}\n\n解释背景、步骤和可复用动作，最后给出今天就能尝试的一步。`,
        coverCopy: "把对话变资产",
        tags: ["#workflow", "#creator-system", "#content-ops"],
        visualDirection: "使用流程图或前后对比图，突出输入、处理、沉淀三个阶段。",
        pendingVerification: ["核实示例、工具名称和平台规则是否仍然有效。"]
      }
    };
  }
}
