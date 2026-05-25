import { Mastra } from "@mastra/core/mastra";
import { isAgentDraftPackage, isGenerateTopicsOutput } from "./validation";
import type {
  ContentAgentRuntime,
  GenerateDraftInput,
  GenerateDraftOutput,
  GenerateTopicsInput,
  GenerateTopicsOutput
} from "./types";

export interface MastraContentWorkflowHandlers {
  generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput>;
  generateDraft(input: GenerateDraftInput): Promise<GenerateDraftOutput>;
}

export interface MastraContentAgentRuntimeOptions {
  providerApiKey: string;
  workflowHandlers?: MastraContentWorkflowHandlers;
}

export class MastraContentAgentRuntime implements ContentAgentRuntime {
  private readonly mastra: Mastra;
  private readonly workflows: MastraContentWorkflows;

  constructor(private readonly options: MastraContentAgentRuntimeOptions) {
    this.mastra = new Mastra({});
    this.workflows = createMastraContentWorkflows(options.workflowHandlers ?? createDefaultWorkflowHandlers());
  }

  async generateTopics(_input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
    const run = await this.workflows.topicDiscoveryWorkflow.createRun();
    const result = await run.start({ inputData: _input });

    if (result.status !== "success") {
      throw new Error("Mastra topic workflow failed.");
    }

    if (!isGenerateTopicsOutput(result.result)) {
      throw new Error("Invalid Mastra topic workflow output.");
    }

    return result.result;
  }

  async generateDraft(_input: GenerateDraftInput): Promise<GenerateDraftOutput> {
    const run = await this.workflows.draftPackageWorkflow.createRun();
    const result = await run.start({ inputData: _input });

    if (result.status !== "success") {
      throw new Error("Mastra draft workflow failed.");
    }

    if (!isAgentDraftPackage(result.result.package)) {
      throw new Error("Invalid Mastra draft workflow output.");
    }

    return result.result;
  }
}

export function createMastraContentWorkflows(handlers: MastraContentWorkflowHandlers) {
  return new MastraContentWorkflows(handlers);
}

class MastraContentWorkflows {
  readonly topicDiscoveryWorkflow: ExecutableWorkflow<GenerateTopicsInput, GenerateTopicsOutput>;
  readonly draftPackageWorkflow: ExecutableWorkflow<GenerateDraftInput, GenerateDraftOutput>;

  constructor(handlers: MastraContentWorkflowHandlers) {
    this.topicDiscoveryWorkflow = new ExecutableWorkflow((input) => handlers.generateTopics(input));
    this.draftPackageWorkflow = new ExecutableWorkflow((input) => handlers.generateDraft(input));
  }
}

class ExecutableWorkflow<TInput, TOutput> {
  constructor(private readonly execute: (input: TInput) => Promise<TOutput>) {}

  async createRun(): Promise<{
    start(args: { inputData: TInput }): Promise<{ status: "success"; result: TOutput }>;
  }> {
    return {
      start: async ({ inputData }) => ({
        status: "success",
        result: await this.execute(inputData)
      })
    };
  }
}

function createDefaultWorkflowHandlers(): MastraContentWorkflowHandlers {
  return {
    async generateTopics(input) {
      const profile = COLUMN_PROFILES[input.columnSlug];

      return {
        candidates: [
          {
            title: `${profile.label}内容工作流：把一个选题拆成可验证的行动清单`,
            hook: profile.hook,
            audience: profile.audience,
            targetPlatforms: [...profile.targetPlatforms],
            score: { heat: profile.heat, fit: 88, difficulty: profile.difficulty, personaConsistency: 86 },
            sourceNotes: [`围绕${profile.label}栏目收集一个真实案例、一个反例和一个平台样本。`],
            riskNotes: [profile.riskNote],
            verificationNotes: ["核实案例、数据、平台规则和敏感建议边界。"]
          },
          {
            title: `${profile.label}内容复盘：从一次发布结果提炼下一轮选题`,
            hook: "把表现结果拆成标题、封面、选题和发布时间四个可复用判断。",
            audience: profile.audience,
            targetPlatforms: [...profile.targetPlatforms],
            score: { heat: profile.heat - 5, fit: 84, difficulty: profile.difficulty - 2, personaConsistency: 84 },
            sourceNotes: ["选取最近一条发布记录和一条同平台样本做对照。"],
            riskNotes: ["不要把单次表现归因为唯一原因。"],
            verificationNotes: ["确认指标口径、发布时间和平台展示规则。"]
          }
        ]
      };
    },
    async generateDraft(input) {
      const audience = input.topic?.audience ?? "希望获得实用方法的读者";
      const hook = input.topic?.hook ?? "先讲清楚问题，再给出可以复用的动作。";
      const sourceNotes = input.sourceReferences.map((source) => source.note).filter((note) => note.length > 0);

      return {
        package: {
          brief: `面向${audience}，围绕「${input.project.title}」生成一个可验证、可发布的内容草稿。`,
          titleOptions: [
            input.project.title,
            `${input.project.title}：一个可复用流程`,
            `我如何把${input.project.title}拆成行动清单`
          ],
          bodyDraft: [
            `开场：${hook}`,
            "",
            "第一步，说明这个问题为什么会反复出现。",
            "第二步，把解决动作拆成 3 个可执行环节。",
            "第三步，提醒读者发布或实践前需要核实的边界。",
            "",
            sourceNotes.length > 0 ? `可引用资料：${sourceNotes.join("；")}` : "可引用资料：补充一个真实案例或操作截图。"
          ].join("\n"),
          coverCopy: "拆成行动清单",
          tags: ["#workflow", "#content-ops", "#robert-station"],
          visualDirection: "用三段式流程图呈现：问题、动作、核实。",
          pendingVerification: ["核实案例、数据、平台规则和敏感建议边界。"]
        }
      };
    }
  };
}

const COLUMN_PROFILES = {
  ai: {
    label: "AI",
    hook: "从一个真实工作场景出发，把工具使用沉淀成可复用系统。",
    audience: "希望搭建 AI 工作流的创作者。",
    targetPlatforms: ["xiaohongshu", "wechat_channels"] as const,
    heat: 84,
    difficulty: 42,
    riskNote: "核实工具版本、价格、功能限制和平台规则。"
  },
  finance: {
    label: "理财",
    hook: "先把判断依据讲清楚，再给出低风险的复盘动作。",
    audience: "正在建立个人或家庭财务习惯的读者。",
    targetPlatforms: ["xiaohongshu", "wechat_channels"] as const,
    heat: 78,
    difficulty: 46,
    riskNote: "避免个性化投资建议，保留风险提示。"
  },
  parenting: {
    label: "育儿",
    hook: "先处理家庭协作流程，再讨论具体行为。",
    audience: "希望降低日常摩擦的家长。",
    targetPlatforms: ["xiaohongshu", "wechat_channels"] as const,
    heat: 80,
    difficulty: 38,
    riskNote: "避免绝对化建议，保留家庭差异和专业帮助边界。"
  },
  fitness: {
    label: "健身",
    hook: "把训练动作放进恢复和安全边界里解释。",
    audience: "希望建立稳定训练习惯的成年人。",
    targetPlatforms: ["xiaohongshu", "douyin"] as const,
    heat: 76,
    difficulty: 44,
    riskNote: "避免医疗化承诺，提示身体不适时寻求专业意见。"
  }
};
