import { MastraContentAgentRuntime } from "./mastra-runtime";
import { MockContentAgentRuntime } from "./mock-runtime";
import type { ContentAgentRuntime } from "./types";

export interface CreateContentAgentRuntimeOptions {
  runtime?: string;
  providerApiKey?: string;
}

export function createContentAgentRuntime(options: CreateContentAgentRuntimeOptions): ContentAgentRuntime | undefined {
  if (options.runtime === "mock") {
    return new MockContentAgentRuntime();
  }

  if (options.runtime === "mastra" && options.providerApiKey) {
    return new MastraContentAgentRuntime({ providerApiKey: options.providerApiKey });
  }

  return undefined;
}
