# Agent Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a framework-neutral agent runtime boundary and wire topic/draft generation through it with deterministic fallback.

**Architecture:** Create `packages/agent-runtime` as the only package that knows about runtime implementations. `packages/local-store` accepts a `ContentAgentRuntime` dependency and maps runtime outputs into existing core entities. The first executable slice uses a deterministic mock runtime and runtime fallback; Mastra is added behind the same boundary after the contracts are proven.

**Tech Stack:** TypeScript ES modules, npm workspaces, Vitest, Electron main-process configuration, Mastra in Task 5.

---

## File Structure

- Create `packages/agent-runtime/package.json`: workspace metadata and scripts.
- Create `packages/agent-runtime/tsconfig.json`: package TypeScript config.
- Create `packages/agent-runtime/src/types.ts`: framework-neutral runtime input/output contracts.
- Create `packages/agent-runtime/src/validation.ts`: runtime output validators.
- Create `packages/agent-runtime/src/mock-runtime.ts`: deterministic runtime for tests and fallback.
- Create `packages/agent-runtime/src/index.ts`: public package exports.
- Create `packages/agent-runtime/src/mock-runtime.test.ts`: mock runtime and validation tests.
- Modify `package.json`: add `packages/*` workspace support already exists, no workspace list change expected.
- Modify `packages/local-store/package.json`: depend on `@robert-station/agent-runtime`.
- Modify `packages/local-store/src/content-loop-repository.ts`: accept optional runtime and use it for in-memory topic/draft generation.
- Modify `packages/local-store/src/sqlite-content-loop-repository.ts`: accept optional runtime and use it for SQLite topic/draft generation.
- Modify `packages/local-store/src/content-loop-repository.test.ts`: add in-memory runtime and fallback tests.
- Modify `packages/local-store/src/sqlite-content-loop-repository.test.ts`: add SQLite runtime and fallback tests.
- Modify `apps/desktop/src/main/main.ts`: create runtime in main process and inject it into repository.

## Task 1: Agent Runtime Package Contract

**Files:**
- Create: `packages/agent-runtime/package.json`
- Create: `packages/agent-runtime/tsconfig.json`
- Create: `packages/agent-runtime/src/types.ts`
- Create: `packages/agent-runtime/src/validation.ts`
- Create: `packages/agent-runtime/src/mock-runtime.ts`
- Create: `packages/agent-runtime/src/index.ts`
- Test: `packages/agent-runtime/src/mock-runtime.test.ts`

- [ ] **Step 1: Write failing tests for mock runtime and validation**

Create `packages/agent-runtime/src/mock-runtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockContentAgentRuntime, isAgentDraftPackage, isGenerateTopicsOutput } from "./index";

describe("MockContentAgentRuntime", () => {
  it("returns deterministic structured topic candidates", async () => {
    const runtime = new MockContentAgentRuntime();
    const result = await runtime.generateTopics({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      title: "AI 工作流选题：把一次性对话沉淀成内容资产",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      score: { heat: 82, fit: 90, difficulty: 42, personaConsistency: 88 }
    });
    expect(isGenerateTopicsOutput(result)).toBe(true);
  });

  it("returns deterministic structured draft sections", async () => {
    const runtime = new MockContentAgentRuntime();
    const result = await runtime.generateDraft({
      project: {
        id: "project_ai_runtime",
        workspaceId: "workspace_robert-station",
        primaryColumnId: "column_ai",
        sourceTopicId: "topic_ai_runtime",
        title: "把 AI 对话沉淀成内容资产",
        status: "drafting",
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      topic: {
        id: "topic_ai_runtime",
        workspaceId: "workspace_robert-station",
        columnSlug: "ai",
        title: "把 AI 对话沉淀成内容资产",
        hook: "复用来自沉淀，而不是一次次重新问。",
        audience: "正在搭建个人 AI 工作流的创作者。",
        targetPlatforms: ["xiaohongshu"],
        status: "promoted",
        score: { heat: 80, fit: 90, difficulty: 40, personaConsistency: 88 },
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      sourceReferences: [],
      nextVersion: 2,
      now: new Date("2026-05-25T00:00:00.000Z")
    });

    expect(result.package).toMatchObject({
      brief: "面向正在搭建个人 AI 工作流的创作者。，说明把 AI 对话沉淀成内容资产。",
      coverCopy: "把对话变资产"
    });
    expect(result.package.titleOptions).toHaveLength(3);
    expect(result.package.pendingVerification).toContain("核实示例、工具名称和平台规则是否仍然有效。");
    expect(isAgentDraftPackage(result.package)).toBe(true);
  });

  it("rejects invalid structured output", () => {
    expect(isGenerateTopicsOutput({ candidates: [{ title: "missing fields" }] })).toBe(false);
    expect(isAgentDraftPackage({ brief: "missing arrays" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace @robert-station/agent-runtime test
```

Expected: FAIL because `@robert-station/agent-runtime` does not exist yet.

- [ ] **Step 3: Add package metadata and TypeScript config**

Create `packages/agent-runtime/package.json`:

```json
{
  "name": "@robert-station/agent-runtime",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src"
  },
  "dependencies": {
    "@robert-station/core": "0.1.0"
  },
  "devDependencies": {
    "vitest": "^3.1.0"
  }
}
```

Create `packages/agent-runtime/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Add runtime types**

Create `packages/agent-runtime/src/types.ts`:

```ts
import type {
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  Platform,
  SourceReference,
  Topic,
  TopicScore
} from "@robert-station/core";

export interface GenerateTopicsInput {
  columnSlug: ContentColumnSlug;
  workspaceId: string;
  now?: Date;
}

export interface AgentTopicCandidate {
  title: string;
  hook: string;
  audience: string;
  targetPlatforms: Platform[];
  score: TopicScore;
  sourceNotes: string[];
  riskNotes: string[];
  verificationNotes: string[];
}

export interface GenerateTopicsOutput {
  candidates: AgentTopicCandidate[];
}

export interface GenerateDraftInput {
  project: ContentProject;
  topic: Topic | null;
  sourceReferences: SourceReference[];
  nextVersion: number;
  now?: Date;
}

export interface AgentDraftPackage {
  brief: string;
  titleOptions: string[];
  bodyDraft: string;
  coverCopy: string;
  tags: string[];
  visualDirection: string;
  pendingVerification: string[];
}

export interface GenerateDraftOutput {
  package: AgentDraftPackage;
}

export interface ContentAgentRuntime {
  generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput>;
  generateDraft(input: GenerateDraftInput): Promise<GenerateDraftOutput>;
}

export type AgentDraftMapper = (input: GenerateDraftInput, output: GenerateDraftOutput) => DraftVersion;
```

- [ ] **Step 5: Add validators**

Create `packages/agent-runtime/src/validation.ts`:

```ts
import type { AgentDraftPackage, GenerateTopicsOutput } from "./types";

const SUPPORTED_PLATFORMS = new Set(["xiaohongshu", "douyin", "wechat_channels", "bilibili"]);

export function isGenerateTopicsOutput(value: unknown): value is GenerateTopicsOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const output = value as Partial<GenerateTopicsOutput>;
  return Array.isArray(output.candidates) && output.candidates.every(isAgentTopicCandidate);
}

export function isAgentDraftPackage(value: unknown): value is AgentDraftPackage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draftPackage = value as Partial<AgentDraftPackage>;
  return (
    typeof draftPackage.brief === "string" &&
    draftPackage.brief.length > 0 &&
    isStringArray(draftPackage.titleOptions) &&
    draftPackage.titleOptions.length > 0 &&
    typeof draftPackage.bodyDraft === "string" &&
    draftPackage.bodyDraft.length > 0 &&
    typeof draftPackage.coverCopy === "string" &&
    draftPackage.coverCopy.length > 0 &&
    isStringArray(draftPackage.tags) &&
    isStringArray(draftPackage.pendingVerification) &&
    typeof draftPackage.visualDirection === "string" &&
    draftPackage.visualDirection.length > 0
  );
}

function isAgentTopicCandidate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    candidate.title.length > 0 &&
    typeof candidate.hook === "string" &&
    candidate.hook.length > 0 &&
    typeof candidate.audience === "string" &&
    candidate.audience.length > 0 &&
    Array.isArray(candidate.targetPlatforms) &&
    candidate.targetPlatforms.every((platform) => typeof platform === "string" && SUPPORTED_PLATFORMS.has(platform)) &&
    isTopicScore(candidate.score) &&
    isStringArray(candidate.sourceNotes) &&
    isStringArray(candidate.riskNotes) &&
    isStringArray(candidate.verificationNotes)
  );
}

function isTopicScore(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const score = value as Record<string, unknown>;
  return (
    typeof score.heat === "number" &&
    typeof score.fit === "number" &&
    typeof score.difficulty === "number" &&
    typeof score.personaConsistency === "number"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
```

- [ ] **Step 6: Add deterministic mock runtime**

Create `packages/agent-runtime/src/mock-runtime.ts`:

```ts
import type { ContentAgentRuntime, GenerateDraftInput, GenerateDraftOutput, GenerateTopicsInput, GenerateTopicsOutput } from "./types";

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
          score: { heat: template.score.heat - 4, fit: template.score.fit - 2, difficulty: template.score.difficulty, personaConsistency: template.score.personaConsistency },
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
```

- [ ] **Step 7: Export package API**

Create `packages/agent-runtime/src/index.ts`:

```ts
export { MockContentAgentRuntime } from "./mock-runtime";
export { isAgentDraftPackage, isGenerateTopicsOutput } from "./validation";
export type {
  AgentDraftPackage,
  AgentTopicCandidate,
  ContentAgentRuntime,
  GenerateDraftInput,
  GenerateDraftOutput,
  GenerateTopicsInput,
  GenerateTopicsOutput
} from "./types";
```

- [ ] **Step 8: Run test to verify it passes**

Run:

```bash
npm --workspace @robert-station/agent-runtime test
```

Expected: PASS.

## Task 2: In-Memory Repository Runtime Integration

**Files:**
- Modify: `packages/local-store/package.json`
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Test: `packages/local-store/src/content-loop-repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Append to `packages/local-store/src/content-loop-repository.test.ts`:

```ts
  it("uses a configured runtime for in-memory topic generation", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => ({
        candidates: [
          {
            title: "Runtime topic",
            hook: "Runtime hook",
            audience: "Runtime audience",
            targetPlatforms: ["xiaohongshu" as const],
            score: { heat: 91, fit: 92, difficulty: 30, personaConsistency: 89 },
            sourceNotes: ["Runtime source note"],
            riskNotes: ["Runtime risk note"],
            verificationNotes: ["Runtime verification note"]
          }
        ]
      })),
      generateDraft: vi.fn()
    };
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station", { agentRuntime: runtime });

    const state = await repository.generateTopics("ai");

    expect(runtime.generateTopics).toHaveBeenCalledWith({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: expect.any(Date)
    });
    expect(state.topics.some((topic) => topic.title === "Runtime topic")).toBe(true);
    expect(state.sourceReferences.some((source) => source.note.includes("Runtime source note"))).toBe(true);
  });

  it("falls back to mock in-memory topics when runtime topic generation fails", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => {
        throw new Error("runtime offline");
      }),
      generateDraft: vi.fn()
    };
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station", { agentRuntime: runtime });

    const state = await repository.generateTopics("ai");

    expect(runtime.generateTopics).toHaveBeenCalledOnce();
    expect(state.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
  });

  it("uses a configured runtime for in-memory draft generation", async () => {
    const runtime = {
      generateTopics: vi.fn(),
      generateDraft: vi.fn(async () => ({
        package: {
          brief: "Runtime brief",
          titleOptions: ["Runtime title", "Runtime title 2"],
          bodyDraft: "Runtime body",
          coverCopy: "Runtime cover",
          tags: ["#runtime"],
          visualDirection: "Runtime visual direction",
          pendingVerification: ["Runtime verification"]
        }
      }))
    };
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station", { agentRuntime: runtime });
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const state = await repository.generateDraftPackage(projectId);

    expect(runtime.generateDraft).toHaveBeenCalledOnce();
    expect(state.drafts[0]?.body).toContain("Runtime brief");
    expect(state.drafts[0]?.body).toContain("Runtime body");
    expect(state.drafts[0]?.body).toContain("Runtime verification");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/content-loop-repository.test.ts
```

Expected: FAIL because repository factory does not accept `agentRuntime` and runtime output mapping does not exist.

- [ ] **Step 3: Add local-store dependency**

Modify `packages/local-store/package.json`:

```json
"dependencies": {
  "@robert-station/agent-runtime": "0.1.0",
  "@robert-station/core": "0.1.0"
}
```

- [ ] **Step 4: Add runtime options and mapping helpers**

Modify `packages/local-store/src/content-loop-repository.ts`:

```ts
import { isAgentDraftPackage, isGenerateTopicsOutput, type ContentAgentRuntime, type GenerateDraftInput, type GenerateDraftOutput, type GenerateTopicsOutput } from "@robert-station/agent-runtime";
```

Add:

```ts
export interface ContentLoopRepositoryOptions {
  agentRuntime?: ContentAgentRuntime;
}
```

Update constructor and factory:

```ts
  private constructor(
    initialState: PersistedContentLoopState,
    private readonly options: ContentLoopRepositoryOptions = {}
  ) {
    this.state = cloneState(initialState);
  }

  static createSeeded(workspaceId: string, options: ContentLoopRepositoryOptions = {}): InMemoryContentLoopRepository {
```

Add helpers:

```ts
function createTopicsFromAgentOutput(input: { columnSlug: ContentColumnSlug; workspaceId: string; now: Date; output: GenerateTopicsOutput }): ContentLoopSeed {
  const timestamp = input.now.toISOString();
  const topics = input.output.candidates.map((candidate, index) => ({
    id: createEntityId("topic", `${input.columnSlug}-runtime-${index + 1}-${candidate.title}`),
    workspaceId: input.workspaceId,
    columnSlug: input.columnSlug,
    title: candidate.title,
    hook: candidate.hook,
    audience: candidate.audience,
    targetPlatforms: [...candidate.targetPlatforms],
    status: "candidate" as const,
    score: { ...candidate.score },
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const sourceReferences = input.output.candidates.flatMap((candidate, index) => {
    const topic = topics[index];
    if (!topic) {
      return [];
    }

    return [...candidate.sourceNotes, ...candidate.riskNotes, ...candidate.verificationNotes].map((note, noteIndex) => ({
      id: createEntityId("source", `${topic.id}-${noteIndex + 1}`),
      workspaceId: input.workspaceId,
      topicId: topic.id,
      kind: noteIndex < candidate.sourceNotes.length ? "note" as const : "risk" as const,
      title: `${candidate.title} 的 runtime 资料`,
      note,
      createdAt: timestamp,
      updatedAt: timestamp
    }));
  });

  return { topics, sourceReferences };
}

function createDraftFromAgentOutput(input: GenerateDraftInput, output: GenerateDraftOutput): DraftVersion {
  const timestamp = (input.now ?? new Date()).toISOString();
  const draftPackage = output.package;

  return {
    id: createEntityId("draft", `${input.project.id}-${input.nextVersion}`),
    workspaceId: input.project.workspaceId,
    contentProjectId: input.project.id,
    version: input.nextVersion,
    title: input.project.title,
    body: [
      "简报",
      draftPackage.brief,
      "",
      "标题选项",
      ...draftPackage.titleOptions.map((title, index) => `${index + 1}. ${title}`),
      "",
      "正文草稿",
      draftPackage.bodyDraft,
      "",
      "封面文案",
      draftPackage.coverCopy,
      "",
      "标签建议",
      ...draftPackage.tags,
      "",
      "视觉方向",
      draftPackage.visualDirection,
      "",
      "待核实",
      ...draftPackage.pendingVerification.map((line, index) => `${index + 1}. ${line}`)
    ].join("\n"),
    createdBy: "assistant",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
```

- [ ] **Step 5: Use runtime in `generateTopics` and `generateDraftPackage`**

In `generateTopics`, call runtime first and fallback:

```ts
    const now = new Date();
    let generated: ContentLoopSeed;

    try {
      const runtimeOutput = await this.options.agentRuntime?.generateTopics({
        columnSlug,
        workspaceId: this.state.topics[0]?.workspaceId ?? "workspace_robert-station",
        now
      });
      generated = runtimeOutput && isGenerateTopicsOutput(runtimeOutput)
        ? createTopicsFromAgentOutput({
            columnSlug,
            workspaceId: this.state.topics[0]?.workspaceId ?? "workspace_robert-station",
            now,
            output: runtimeOutput
          })
        : generateMockTopics({
            columnSlug,
            workspaceId: this.state.topics[0]?.workspaceId ?? "workspace_robert-station",
            now
          });
    } catch {
      generated = generateMockTopics({
        columnSlug,
        workspaceId: this.state.topics[0]?.workspaceId ?? "workspace_robert-station",
        now
      });
    }
```

In `generateDraftPackage`, call runtime first and fallback:

```ts
    const now = new Date();
    const draftInput = { project, topic, sourceReferences, nextVersion, now };
    let draft: DraftVersion;

    try {
      const runtimeOutput = await this.options.agentRuntime?.generateDraft(draftInput);
      draft = runtimeOutput && isAgentDraftPackage(runtimeOutput.package)
        ? createDraftFromAgentOutput(draftInput, runtimeOutput)
        : generateMockDraftPackage(draftInput);
    } catch {
      draft = generateMockDraftPackage(draftInput);
    }
```

- [ ] **Step 6: Run local-store tests**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/content-loop-repository.test.ts
```

Expected: PASS.

## Task 3: SQLite Repository Runtime Integration

**Files:**
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`
- Test: `packages/local-store/src/sqlite-content-loop-repository.test.ts`

- [ ] **Step 1: Write failing SQLite tests**

Modify the Vitest import in `packages/local-store/src/sqlite-content-loop-repository.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

Add these tests inside `describe("SqliteContentLoopRepository", () => { ... })`:

```ts
  it("uses a configured runtime for SQLite topic generation", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => ({
        candidates: [
          {
            title: "SQLite runtime topic",
            hook: "SQLite runtime hook",
            audience: "SQLite runtime audience",
            targetPlatforms: ["xiaohongshu" as const],
            score: { heat: 91, fit: 92, difficulty: 30, personaConsistency: 89 },
            sourceNotes: ["SQLite runtime source note"],
            riskNotes: ["SQLite runtime risk note"],
            verificationNotes: ["SQLite runtime verification note"]
          }
        ]
      })),
      generateDraft: vi.fn()
    };
    const firstRepository = SqliteContentLoopRepository.open({ databasePath, agentRuntime: runtime });
    const afterGenerate = await firstRepository.generateTopics("ai");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(runtime.generateTopics).toHaveBeenCalledWith({
      columnSlug: "ai",
      workspaceId: "workspace_robert-station",
      now: expect.any(Date)
    });
    expect(afterGenerate.topics.some((topic) => topic.title === "SQLite runtime topic")).toBe(true);
    expect(afterGenerate.sourceReferences.some((source) => source.note.includes("SQLite runtime source note"))).toBe(true);
    expect(afterReload).toEqual(afterGenerate);
  });

  it("falls back to mock SQLite topics when runtime topic generation fails", async () => {
    const runtime = {
      generateTopics: vi.fn(async () => {
        throw new Error("runtime offline");
      }),
      generateDraft: vi.fn()
    };
    const repository = SqliteContentLoopRepository.open({ databasePath, agentRuntime: runtime });
    const state = await repository.generateTopics("ai");
    repository.close();

    expect(runtime.generateTopics).toHaveBeenCalledOnce();
    expect(state.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
  });

  it("uses a configured runtime for SQLite draft generation", async () => {
    const runtime = {
      generateTopics: vi.fn(),
      generateDraft: vi.fn(async () => ({
        package: {
          brief: "SQLite runtime brief",
          titleOptions: ["SQLite runtime title", "SQLite runtime title 2"],
          bodyDraft: "SQLite runtime body",
          coverCopy: "SQLite runtime cover",
          tags: ["#runtime"],
          visualDirection: "SQLite runtime visual direction",
          pendingVerification: ["SQLite runtime verification"]
        }
      }))
    };
    const firstRepository = SqliteContentLoopRepository.open({ databasePath, agentRuntime: runtime });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterGenerate = await firstRepository.generateDraftPackage(projectId);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(runtime.generateDraft).toHaveBeenCalledOnce();
    expect(afterGenerate.drafts[0]?.body).toContain("SQLite runtime brief");
    expect(afterGenerate.drafts[0]?.body).toContain("SQLite runtime body");
    expect(afterGenerate.drafts[0]?.body).toContain("SQLite runtime verification");
    expect(afterReload).toEqual(afterGenerate);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/sqlite-content-loop-repository.test.ts
```

Expected: FAIL because SQLite options do not accept runtime and methods still use mock generators directly.

- [ ] **Step 3: Add runtime option to SQLite repository**

Update `SqliteContentLoopRepositoryOptions`:

```ts
interface SqliteContentLoopRepositoryOptions {
  databasePath: string;
  agentRuntime?: ContentAgentRuntime;
}
```

Store options:

```ts
  private constructor(
    private readonly database: DatabaseSync,
    private readonly options: Omit<SqliteContentLoopRepositoryOptions, "databasePath"> = {}
  ) {}
```

- [ ] **Step 4: Reuse mapping helpers from content-loop repository**

Export `createTopicsFromAgentOutput` and `createDraftFromAgentOutput` from `content-loop-repository.ts`, then import them into SQLite repository. Keep helpers package-private in `local-store`; do not move them to core yet.

- [ ] **Step 5: Use runtime in SQLite `generateTopics` and `generateDraftPackage`**

Mirror the in-memory fallback behavior with `WORKSPACE_ID` and `this.createPromotionDate()`.

- [ ] **Step 6: Run SQLite tests**

Run:

```bash
npm --workspace @robert-station/local-store test -- src/sqlite-content-loop-repository.test.ts
```

Expected: PASS.

## Task 4: Desktop Runtime Factory

**Files:**
- Create: `packages/agent-runtime/src/factory.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Modify: `apps/desktop/src/main/main.ts`
- Test: existing desktop and package tests.

- [ ] **Step 1: Write failing factory test**

Add test that `createContentAgentRuntime({ runtime: "mock" })` returns `MockContentAgentRuntime` and missing config returns `undefined`.

- [ ] **Step 2: Implement factory**

Create `factory.ts`:

```ts
import { MockContentAgentRuntime } from "./mock-runtime";
import type { ContentAgentRuntime } from "./types";

export interface CreateContentAgentRuntimeOptions {
  runtime?: string;
}

export function createContentAgentRuntime(options: CreateContentAgentRuntimeOptions): ContentAgentRuntime | undefined {
  if (options.runtime === "mock") {
    return new MockContentAgentRuntime();
  }

  return undefined;
}
```

- [ ] **Step 3: Wire desktop main**

In `apps/desktop/src/main/main.ts`, create runtime with:

```ts
const agentRuntime = createContentAgentRuntime({
  runtime: process.env.ROBERT_STATION_AGENT_RUNTIME
});
```

Pass `agentRuntime` to repository creation.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
npm --workspace @robert-station/agent-runtime test
npm --workspace @robert-station/local-store test
npm run typecheck
```

Expected: PASS.

## Task 5: Mastra Dependency And Stub Adapter

**Files:**
- Modify: `packages/agent-runtime/package.json`
- Create: `packages/agent-runtime/src/mastra-runtime.ts`
- Modify: `packages/agent-runtime/src/factory.ts`
- Test: `packages/agent-runtime/src/factory.test.ts`

- [ ] **Step 1: Install Mastra dependency**

Run:

```bash
npm install @mastra/core --workspace @robert-station/agent-runtime
```

Expected: `package.json` and `package-lock.json` update.

- [ ] **Step 2: Write failing factory test for Mastra config without API key**

Expect `createContentAgentRuntime({ runtime: "mastra" })` to return `undefined` when no provider API key is available.

- [ ] **Step 3: Add `MastraContentAgentRuntime` stub**

Implement the class behind the interface. In this phase it can throw a clear constructor error if provider config is missing; factory catches that and returns `undefined`.

- [ ] **Step 4: Run package tests**

Run:

```bash
npm --workspace @robert-station/agent-runtime test
npm run typecheck
```

Expected: PASS.

## Task 6: Final Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff --stat
git diff -- packages/agent-runtime packages/local-store apps/desktop/src/main/main.ts package.json package-lock.json
```

Expected: changes match the plan, with no unrelated source-library/export-center modifications included.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add packages/agent-runtime packages/local-store apps/desktop/src/main/main.ts package.json package-lock.json docs/superpowers/plans/2026-05-25-agent-runtime-integration.md
git commit -m "feat: add agent runtime boundary"
```

Expected: commit succeeds with only agent-runtime integration files staged.

## Self-Review

Spec coverage:

- Runtime package boundary: Task 1.
- Mock runtime and validation: Task 1.
- In-memory repository fallback: Task 2.
- SQLite repository fallback: Task 3.
- Main-process runtime creation: Task 4.
- Mastra behind boundary: Task 5.
- Verification: Task 6.

No placeholder steps remain. Test code is explicit for the agent-runtime package, in-memory repository, and SQLite repository.
