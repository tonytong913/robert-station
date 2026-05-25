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
    this.workflows = createMastraContentWorkflows(options.workflowHandlers ?? createUnconfiguredWorkflowHandlers());
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

function createUnconfiguredWorkflowHandlers(): MastraContentWorkflowHandlers {
  return {
    async generateTopics() {
      throw new Error("Mastra topic workflow handler is not configured.");
    },
    async generateDraft() {
      throw new Error("Mastra draft workflow handler is not configured.");
    }
  };
}
