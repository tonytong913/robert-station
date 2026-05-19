# Topic Assistant V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic topic-generation workflow so users can generate mock candidate topics by column and persist them to SQLite.

**Architecture:** Add a mock topic assistant in `@robert-station/core`, extend `ContentLoopRepository` with `generateTopics(columnSlug)`, expose the workflow through Electron IPC/preload, and add Topic Pool UI controls that call the preload API and refresh persisted state.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- Deterministic mock topic generation for AI, finance, parenting, and fitness.
- Repository method for inserting generated topics and source references.
- SQLite persistence for generated topics.
- IPC and preload API for topic generation.
- Topic Pool UI generation controls with loading and error states.

Deferred:

- Real cloud model calls.
- API key storage.
- live trend search.
- fact-review workflow.
- publish package generation.
- metrics and review reports.

## Target File Structure

```text
packages/
  core/
    src/
      topic-assistant.test.ts
      topic-assistant.ts
      index.ts
  local-store/
    src/
      content-loop-repository.test.ts
      content-loop-repository.ts
      sqlite-content-loop-repository.test.ts
      sqlite-content-loop-repository.ts
apps/
  desktop/
    src/
      main/
        content-loop-service.ts
        ipc-channels.ts
      preload/
        preload.ts
      renderer/
        App.test.tsx
        App.tsx
        content-loop-loader.test.ts
        content-loop-loader.ts
        global.d.ts
        styles.css
        test-setup.ts
```

## Task 1: Core Mock Topic Assistant

**Files:**

- Create: `packages/core/src/topic-assistant.test.ts`
- Create: `packages/core/src/topic-assistant.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing assistant tests**

Create `packages/core/src/topic-assistant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateMockTopics } from "./topic-assistant";

describe("generateMockTopics", () => {
  it("generates two stable AI topics with source references", () => {
    const result = generateMockTopics({ columnSlug: "ai", workspaceId: "workspace_robert-station" });

    expect(result.topics).toHaveLength(2);
    expect(result.sourceReferences).toHaveLength(2);
    expect(result.topics[0]?.id).toBe("topic_ai_mock-workflow-automations");
    expect(result.topics[0]?.columnSlug).toBe("ai");
    expect(result.topics[0]?.status).toBe("candidate");
    expect(result.sourceReferences[0]?.topicId).toBe("topic_ai_mock-workflow-automations");
    expect(result.sourceReferences[0]?.note).toContain("Verify");
  });

  it("generates column-specific topics for each supported column", () => {
    const columns = ["ai", "finance", "parenting", "fitness"] as const;

    for (const columnSlug of columns) {
      const result = generateMockTopics({ columnSlug, workspaceId: "workspace_robert-station" });

      expect(result.topics).toHaveLength(2);
      expect(result.topics.every((topic) => topic.columnSlug === columnSlug)).toBe(true);
      expect(result.sourceReferences.every((source) => source.topicId?.startsWith(`topic_${columnSlug}_`))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./topic-assistant` does not exist.

- [ ] **Step 3: Implement deterministic mock assistant**

Create `packages/core/src/topic-assistant.ts`:

```ts
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
```

- [ ] **Step 4: Export assistant API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./columns";
export * from "./content-loop";
export * from "./ids";
export * from "./topic-assistant";
export * from "./types";
```

- [ ] **Step 5: Run core tests and typecheck**

Run:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/core run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit core assistant**

Run:

```bash
git add packages/core/src/topic-assistant.ts packages/core/src/topic-assistant.test.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add mock topic assistant"
```

## Task 2: Repository Topic Generation

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add to `packages/local-store/src/content-loop-repository.test.ts`:

```ts
  it("generates mock topics in memory without duplicating repeated requests", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    const afterGenerate = await repository.generateTopics("ai");
    const afterRepeat = await repository.generateTopics("ai");

    expect(afterGenerate.topics).toHaveLength(6);
    expect(afterGenerate.sourceReferences).toHaveLength(6);
    expect(afterGenerate.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
    expect(afterRepeat.topics).toHaveLength(6);
    expect(afterRepeat.sourceReferences).toHaveLength(6);
  });
```

Add to `packages/local-store/src/sqlite-content-loop-repository.test.ts`:

```ts
  it("persists generated topics across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterGenerate = await firstRepository.generateTopics("finance");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterGenerate.topics.some((topic) => topic.id === "topic_finance_mock-monthly-money-review")).toBe(true);
    expect(afterReload).toEqual(afterGenerate);
  });

  it("does not duplicate generated topics for repeated column requests", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    const afterGenerate = await repository.generateTopics("parenting");
    const afterRepeat = await repository.generateTopics("parenting");

    repository.close();

    expect(afterGenerate.topics.filter((topic) => topic.columnSlug === "parenting")).toHaveLength(4);
    expect(afterRepeat.topics.filter((topic) => topic.columnSlug === "parenting")).toHaveLength(4);
  });
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `generateTopics` is not on `ContentLoopRepository`.

- [ ] **Step 3: Extend repository contract and in-memory implementation**

Modify `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  generateMockTopics
} from "@robert-station/core";
import type { ContentColumnSlug, ContentProject, DraftVersion, SourceReference, Topic } from "@robert-station/core";
```

Add to `ContentLoopRepository`:

```ts
generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState>;
```

Add to `InMemoryContentLoopRepository`:

```ts
async generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
  const generated = generateMockTopics({ columnSlug, workspaceId: this.state.topics[0]?.workspaceId ?? "workspace_robert-station", now: new Date() });
  const existingTopicIds = new Set(this.state.topics.map((topic) => topic.id));
  const existingSourceIds = new Set(this.state.sourceReferences.map((source) => source.id));

  this.state = {
    ...this.state,
    topics: [...this.state.topics, ...generated.topics.filter((topic) => !existingTopicIds.has(topic.id))],
    sourceReferences: [
      ...this.state.sourceReferences,
      ...generated.sourceReferences.filter((source) => !existingSourceIds.has(source.id))
    ]
  };

  return cloneState(this.state);
}
```

- [ ] **Step 4: Extend SQLite implementation**

Modify imports in `packages/local-store/src/sqlite-content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createDefaultWorkspaceSeed,
  createSampleContentLoopSeed,
  generateMockTopics
} from "@robert-station/core";
```

Add `ContentColumnSlug` is already imported. Add method to `SqliteContentLoopRepository`:

```ts
async generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
  const generated = generateMockTopics({ columnSlug, workspaceId: WORKSPACE_ID, now: this.createPromotionDate() });

  this.runTransaction(() => {
    for (const topic of generated.topics) {
      this.insertTopicIfMissing(topic);
    }

    for (const sourceReference of generated.sourceReferences) {
      this.insertSourceReferenceIfMissing(sourceReference);
    }
  });

  return this.loadState();
}
```

Add helper methods:

```ts
private insertTopicIfMissing(topic: Topic): void {
  this.database
    .prepare(
      `INSERT OR IGNORE INTO topics (
        id, workspace_id, column_slug, title, hook, audience, target_platforms_json,
        status, score_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
    )
    .run(
      topic.id,
      topic.workspaceId,
      topic.columnSlug,
      topic.title,
      topic.hook,
      topic.audience,
      JSON.stringify(topic.targetPlatforms),
      topic.status,
      JSON.stringify(topic.score),
      topic.createdAt,
      topic.updatedAt
    );
}

private insertSourceReferenceIfMissing(sourceReference: SourceReference): void {
  this.database
    .prepare(
      `INSERT OR IGNORE INTO source_references (
        id, workspace_id, topic_id, content_project_id, kind, title, url, note, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
    )
    .run(
      sourceReference.id,
      sourceReference.workspaceId,
      sourceReference.topicId ?? null,
      sourceReference.contentProjectId ?? null,
      sourceReference.kind,
      sourceReference.title,
      sourceReference.url ?? null,
      sourceReference.note,
      sourceReference.createdAt,
      sourceReference.updatedAt
    );
}
```

- [ ] **Step 5: Run local-store tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit repository generation**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist generated topics"
```

## Task 3: IPC And Preload Generation API

**Files:**

- Modify: `apps/desktop/src/main/ipc-channels.ts`
- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.ts`

- [ ] **Step 1: Write failing loader test**

Add to `apps/desktop/src/renderer/content-loop-loader.test.ts`:

```ts
  it("generates topics through preload API", async () => {
    await generatePersistedTopics("ai");

    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("ai");
  });
```

Update import:

```ts
import { generatePersistedTopics, loadPersistedContentLoop, promotePersistedTopic } from "./content-loop-loader";
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because `generatePersistedTopics` and preload type are missing.

- [ ] **Step 3: Add IPC channel**

Modify `apps/desktop/src/main/ipc-channels.ts`:

```ts
export const CONTENT_LOOP_LOAD_CHANNEL = "content-loop:load";
export const CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL = "content-loop:promote-topic";
export const CONTENT_LOOP_GENERATE_TOPICS_CHANNEL = "content-loop:generate-topics";
```

- [ ] **Step 4: Register IPC handler**

Modify `apps/desktop/src/main/content-loop-service.ts` imports:

```ts
import type { ContentColumnSlug } from "@robert-station/core";
import {
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";
```

Add handler:

```ts
ipcMain.handle(CONTENT_LOOP_GENERATE_TOPICS_CHANNEL, async (_event, columnSlug: ContentColumnSlug) =>
  repository.generateTopics(columnSlug)
);
```

- [ ] **Step 5: Expose preload API**

Modify `apps/desktop/src/preload/preload.ts` imports:

```ts
import type { ContentColumnSlug } from "@robert-station/core";
```

Add channel import:

```ts
CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
```

Add API method:

```ts
generateTopics: (columnSlug: ContentColumnSlug) =>
  ipcRenderer.invoke(CONTENT_LOOP_GENERATE_TOPICS_CHANNEL, columnSlug) as Promise<PersistedContentLoopState>,
```

- [ ] **Step 6: Update renderer global type and loader**

Modify `apps/desktop/src/renderer/global.d.ts`:

```ts
import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
```

Add to `contentLoop`:

```ts
generateTopics: (columnSlug: ContentColumnSlug) => Promise<PersistedContentLoopState>;
```

Modify `apps/desktop/src/renderer/content-loop-loader.ts`:

```ts
import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";

export async function loadPersistedContentLoop(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.load();
}

export async function promotePersistedTopic(topicId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.promoteTopic(topicId);
}

export async function generatePersistedTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generateTopics(columnSlug);
}
```

- [ ] **Step 7: Update test setup mock**

Modify `apps/desktop/src/renderer/test-setup.ts`:

```ts
generateTopics: vi.fn(async (columnSlug: ContentColumnSlug) => repository.generateTopics(columnSlug)),
```

Add `ContentColumnSlug` type import from `@robert-station/core`.

- [ ] **Step 8: Run desktop tests, typecheck, build**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: all pass.

- [ ] **Step 9: Commit IPC and preload API**

Run:

```bash
git add apps/desktop/src/main/ipc-channels.ts apps/desktop/src/main/content-loop-service.ts apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/test-setup.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose topic generation ipc"
```

## Task 4: Topic Pool Generation UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add to `apps/desktop/src/renderer/App.test.tsx`:

```ts
  it("generates topics for the selected column from Topic Pool", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));

    fireEvent.change(screen.getByLabelText("Topic column"), { target: { value: "finance" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate topics" }));

    expect(await screen.findByRole("article", { name: "A 30-minute monthly money review for busy families" })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("finance");
  });

  it("shows an inline error when topic generation fails", async () => {
    window.robertStation.contentLoop.generateTopics = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate topics" }));

    expect(await screen.findByText("Could not generate topics. Try again.")).toBeInTheDocument();
  });
```

Update import:

```ts
import { describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because Topic Pool has no generation controls.

- [ ] **Step 3: Add generation state and handler**

Modify `apps/desktop/src/renderer/App.tsx` imports:

```ts
import type { ContentColumnSlug } from "@robert-station/core";
import { DEFAULT_COLUMNS } from "@robert-station/core";
import { generatePersistedTopics, loadPersistedContentLoop, promotePersistedTopic } from "./content-loop-loader";
```

Add state inside `App`:

```ts
const [topicGenerationColumn, setTopicGenerationColumn] = useState<ContentColumnSlug>("ai");
const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
const [topicGenerationError, setTopicGenerationError] = useState<string | null>(null);
```

Add handler:

```ts
async function handleGenerateTopics(): Promise<void> {
  setIsGeneratingTopics(true);
  setTopicGenerationError(null);

  try {
    const nextState = await generatePersistedTopics(topicGenerationColumn);
    setContentLoop(nextState);
  } catch {
    setTopicGenerationError("Could not generate topics. Try again.");
  } finally {
    setIsGeneratingTopics(false);
  }
}
```

- [ ] **Step 4: Render generation bar above Topic Pool grid**

In the `screen === "Topic Pool"` branch, wrap the existing grid with a fragment and add:

```tsx
<div className="topic-toolbar">
  <label>
    <span>Column</span>
    <select
      aria-label="Topic column"
      value={topicGenerationColumn}
      onChange={(event) => setTopicGenerationColumn(event.target.value as ContentColumnSlug)}
    >
      {DEFAULT_COLUMNS.map((column) => (
        <option key={column.slug} value={column.slug}>
          {column.name}
        </option>
      ))}
    </select>
  </label>
  <button disabled={isGeneratingTopics} onClick={() => void handleGenerateTopics()} type="button">
    {isGeneratingTopics ? "Generating..." : "Generate topics"}
  </button>
  {topicGenerationError ? <p className="inline-error">{topicGenerationError}</p> : null}
</div>
```

Keep the existing `<section className="topic-grid" aria-label="Topic candidates">...</section>` below the toolbar.

- [ ] **Step 5: Add toolbar styles**

Add to `apps/desktop/src/renderer/styles.css`:

```css
.topic-toolbar {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.topic-toolbar label {
  color: #475569;
  display: grid;
  font-size: 0.82rem;
  font-weight: 700;
  gap: 6px;
}

.topic-toolbar select {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #0f172a;
  min-width: 180px;
  padding: 9px 10px;
}

.inline-error {
  color: #b91c1c;
  font-size: 0.88rem;
  font-weight: 700;
  margin: 0;
}
```

- [ ] **Step 6: Run desktop tests, typecheck, build**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: all pass.

- [ ] **Step 7: Commit UI generation flow**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/styles.css
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add topic generation ui"
```

## Task 5: Final Verification

**Files:**

- No code files expected.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all workspace tests pass.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
npm run typecheck
```

Expected: all workspace typechecks pass.

- [ ] **Step 3: Run full build**

Run:

```bash
npm run build
```

Expected: all workspace builds pass.

- [ ] **Step 4: Confirm main bundle does not externalize workspace packages**

Run:

```bash
rg -n "@robert-station/local-store|packages/local-store/src|@robert-station/core|packages/core/src" apps/desktop/out/main/main.js
```

Expected: no matches.

- [ ] **Step 5: Run production dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: `found 0 vulnerabilities`.

- [ ] **Step 6: Run Git checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and clean working tree.

## Self-Review Notes

- Spec coverage: this plan implements deterministic mock topic generation, persistence, IPC/preload exposure, and Topic Pool UI.
- Out of scope: real AI API calls, API key storage, trend scraping, fact-review, publish packages, and data review remain deferred.
- Type consistency: `ContentColumnSlug` is used from `@robert-station/core`; repository methods continue returning `PersistedContentLoopState`.
