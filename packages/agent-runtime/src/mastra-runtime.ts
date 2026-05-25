import { Mastra } from "@mastra/core/mastra";
import type {
  ContentAgentRuntime,
  GenerateDraftInput,
  GenerateDraftOutput,
  GenerateTopicsInput,
  GenerateTopicsOutput
} from "./types";

export interface MastraContentAgentRuntimeOptions {
  providerApiKey: string;
}

export class MastraContentAgentRuntime implements ContentAgentRuntime {
  private readonly mastra: Mastra;

  constructor(private readonly options: MastraContentAgentRuntimeOptions) {
    this.mastra = new Mastra({});
  }

  async generateTopics(_input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
    this.assertConfigured();
  }

  async generateDraft(_input: GenerateDraftInput): Promise<GenerateDraftOutput> {
    this.assertConfigured();
  }

  private assertConfigured(): never {
    if (!this.options.providerApiKey) {
      throw new Error("Mastra provider API key is required.");
    }

    void this.mastra;
    throw new Error("Mastra content workflows are not configured yet.");
  }
}
