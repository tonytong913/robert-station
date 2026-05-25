import { describe, expect, it, vi } from "vitest";
import { MastraContentAgentRuntime } from "./index";
import type { GenerateDraftOutput, GenerateTopicsOutput } from "./types";

describe("MastraContentAgentRuntime", () => {
  it("uses default structured topic workflow handlers when none are injected", async () => {
    const runtime = new MastraContentAgentRuntime({ providerApiKey: "test-key" });

    const result = await runtime.generateTopics({
      columnSlug: "finance",
      workspaceId: "workspace_robert-station",
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      title: "理财内容工作流：把一个选题拆成可验证的行动清单",
      targetPlatforms: ["xiaohongshu", "wechat_channels"]
    });
  });

  it("uses default structured draft workflow handlers when none are injected", async () => {
    const runtime = new MastraContentAgentRuntime({ providerApiKey: "test-key" });

    const result = await runtime.generateDraft({
      project: {
        id: "project_default_workflow",
        workspaceId: "workspace_robert-station",
        primaryColumnId: "column_parenting",
        title: "晨间准备板",
        status: "drafting",
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      topic: {
        id: "topic_parenting_board",
        workspaceId: "workspace_robert-station",
        columnSlug: "parenting",
        title: "晨间准备板",
        hook: "把下一步动作变得可见，催促就会少一点。",
        audience: "学龄儿童家长。",
        targetPlatforms: ["xiaohongshu"],
        status: "promoted",
        score: { heat: 76, fit: 82, difficulty: 32, personaConsistency: 79 },
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      sourceReferences: [],
      nextVersion: 2,
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(result.package.brief).toContain("学龄儿童家长");
    expect(result.package.bodyDraft).toContain("把下一步动作变得可见");
    expect(result.package.pendingVerification).toContain("核实案例、数据、平台规则和敏感建议边界。");
  });

  it("runs topic generation through a Mastra workflow handler", async () => {
    const generateTopics = vi.fn(async () => ({
      candidates: [
        {
          title: "Workflow topic",
          hook: "Workflow hook",
          audience: "Workflow audience",
          targetPlatforms: ["xiaohongshu" as const],
          score: { heat: 90, fit: 91, difficulty: 35, personaConsistency: 88 },
          sourceNotes: ["Workflow source"],
          riskNotes: ["Workflow risk"],
          verificationNotes: ["Workflow verification"]
        }
      ]
    }));
    const runtime = new MastraContentAgentRuntime({
      providerApiKey: "test-key",
      workflowHandlers: {
        generateTopics,
        generateDraft: vi.fn()
      }
    });

    const result = await runtime.generateTopics({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(generateTopics).toHaveBeenCalledWith({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: new Date("2026-05-25T00:00:00.000Z")
    });
    expect(result.candidates[0]?.title).toBe("Workflow topic");
  });

  it("runs draft generation through a Mastra workflow handler", async () => {
    const generateDraft = vi.fn(async () => ({
      package: {
        brief: "Workflow brief",
        titleOptions: ["Workflow title"],
        bodyDraft: "Workflow body",
        coverCopy: "Workflow cover",
        tags: ["#workflow"],
        visualDirection: "Workflow visual",
        pendingVerification: ["Workflow verification"]
      }
    }));
    const runtime = new MastraContentAgentRuntime({
      providerApiKey: "test-key",
      workflowHandlers: {
        generateTopics: vi.fn(),
        generateDraft
      }
    });
    const project = {
      id: "project_workflow",
      workspaceId: "workspace_robert-station",
      primaryColumnId: "column_ai",
      title: "Workflow project",
      status: "drafting" as const,
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z"
    };

    const result = await runtime.generateDraft({
      project,
      topic: null,
      sourceReferences: [],
      nextVersion: 2,
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(generateDraft).toHaveBeenCalledOnce();
    expect(result.package.bodyDraft).toBe("Workflow body");
  });

  it("rejects invalid topic workflow output", async () => {
    const runtime = new MastraContentAgentRuntime({
      providerApiKey: "test-key",
      workflowHandlers: {
        generateTopics: vi.fn(async () => ({ candidates: [{ title: "Invalid" }] } as unknown as GenerateTopicsOutput)),
        generateDraft: vi.fn()
      }
    });

    await expect(
      runtime.generateTopics({
        columnSlug: "ai",
        workspaceId: "workspace_robert-station"
      })
    ).rejects.toThrow("Invalid Mastra topic workflow output.");
  });

  it("rejects invalid draft workflow output", async () => {
    const runtime = new MastraContentAgentRuntime({
      providerApiKey: "test-key",
      workflowHandlers: {
        generateTopics: vi.fn(),
        generateDraft: vi.fn(async () => ({ package: { brief: "Invalid" } } as unknown as GenerateDraftOutput))
      }
    });

    await expect(
      runtime.generateDraft({
        project: {
          id: "project_workflow",
          workspaceId: "workspace_robert-station",
          primaryColumnId: "column_ai",
          title: "Workflow project",
          status: "drafting",
          createdAt: "2026-05-25T00:00:00.000Z",
          updatedAt: "2026-05-25T00:00:00.000Z"
        },
        topic: null,
        sourceReferences: [],
        nextVersion: 2
      })
    ).rejects.toThrow("Invalid Mastra draft workflow output.");
  });
});
