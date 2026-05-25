import { describe, expect, it } from "vitest";
import { MastraContentAgentRuntime, MockContentAgentRuntime, createContentAgentRuntime } from "./index";

describe("createContentAgentRuntime", () => {
  it("returns mock runtime when explicitly configured", () => {
    const runtime = createContentAgentRuntime({ runtime: "mock" });

    expect(runtime).toBeInstanceOf(MockContentAgentRuntime);
  });

  it("returns undefined when runtime is not configured", () => {
    const runtime = createContentAgentRuntime({});

    expect(runtime).toBeUndefined();
  });

  it("returns undefined for Mastra runtime without a provider API key", () => {
    const runtime = createContentAgentRuntime({ runtime: "mastra" });

    expect(runtime).toBeUndefined();
  });

  it("returns Mastra runtime when provider API key is configured", () => {
    const runtime = createContentAgentRuntime({ runtime: "mastra", providerApiKey: "test-key" });

    expect(runtime).toBeInstanceOf(MastraContentAgentRuntime);
  });
});
