# Creation Assistant V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic draft-package generation workflow so a promoted content project can create a richer assistant draft version from Creation Studio.

**Architecture:** Add a mock creation assistant in `@robert-station/core`, extend `ContentLoopRepository` with `generateDraftPackage(projectId)`, expose the workflow through Electron IPC/preload, and add a Creation Studio action that refreshes the selected draft from persisted state.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- Deterministic mock creation assistant.
- New draft version generation for existing content projects.
- SQLite persistence for generated `DraftVersion` rows.
- IPC and preload API for draft package generation.
- Creation Studio UI action with loading and error states.

Deferred:

- Real cloud model calls.
- API key storage.
- prompt history tables.
- fact-review system.
- separate platform publish package entities.
- image generation and asset storage.

## Target File Structure

```text
packages/
  core/
    src/
      creation-assistant.test.ts
      creation-assistant.ts
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
        test-setup.ts
        styles.css
```

## Task 1: Core Mock Creation Assistant

**Files:**

- Create: `packages/core/src/creation-assistant.test.ts`
- Create: `packages/core/src/creation-assistant.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing creation assistant tests**

Create `packages/core/src/creation-assistant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateMockDraftPackage } from "./creation-assistant";
import type { ContentProject, SourceReference, Topic } from "./types";

const topic: Topic = {
  id: "topic_ai_local-workstation",
  workspaceId: "workspace_robert-station",
  columnSlug: "ai",
  title: "How to build a personal AI workstation for daily content work",
  hook: "Turn scattered AI tools into one repeatable daily workflow.",
  audience: "Creators who want practical AI productivity gains.",
  targetPlatforms: ["xiaohongshu", "bilibili"],
  status: "promoted",
  score: { heat: 86, fit: 92, difficulty: 48, personaConsistency: 90 },
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: topic.id,
  title: topic.title,
  status: "drafting",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const sourceReferences: SourceReference[] = [
  {
    id: "source_topic-ai-local-workstation",
    workspaceId: "workspace_robert-station",
    topicId: topic.id,
    kind: "note",
    title: "Research note",
    note: "Verify tool availability and pricing before publishing.",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z"
  }
];

describe("generateMockDraftPackage", () => {
  it("generates a deterministic draft version with creation package sections", () => {
    const draft = generateMockDraftPackage({
      project,
      topic,
      sourceReferences,
      nextVersion: 2,
      now: new Date("2026-05-19T12:00:00.000Z")
    });

    expect(draft.id).toBe("draft_project-topic-ai-local-workstation-2");
    expect(draft.version).toBe(2);
    expect(draft.createdBy).toBe("assistant");
    expect(draft.body).toContain("Brief");
    expect(draft.body).toContain("Title Options");
    expect(draft.body).toContain("Body Draft");
    expect(draft.body).toContain("Cover Copy");
    expect(draft.body).toContain("Tag Suggestions");
    expect(draft.body).toContain("Visual Direction");
    expect(draft.body).toContain("Pending Verification");
  });

  it("carries source notes into pending verification", () => {
    const draft = generateMockDraftPackage({
      project,
      topic,
      sourceReferences,
      nextVersion: 2,
      now: new Date("2026-05-19T12:00:00.000Z")
    });

    expect(draft.body).toContain("Verify tool availability and pricing before publishing.");
    expect(draft.body).toContain("Turn scattered AI tools into one repeatable daily workflow.");
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./creation-assistant` does not exist.

- [ ] **Step 3: Implement deterministic mock creation assistant**

Create `packages/core/src/creation-assistant.ts`:

```ts
import { createEntityId } from "./ids";
import type { ContentProject, DraftVersion, SourceReference, Topic } from "./types";

interface GenerateMockDraftPackageRequest {
  project: ContentProject;
  topic?: Topic | null;
  sourceReferences: SourceReference[];
  nextVersion: number;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function generateMockDraftPackage(request: GenerateMockDraftPackageRequest): DraftVersion {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const sourceNotes = request.sourceReferences.map((source) => source.note).filter((note) => note.length > 0);
  const hook = request.topic?.hook ?? "Clarify the core problem and show one repeatable solution.";
  const audience = request.topic?.audience ?? "Readers who want practical, repeatable improvements.";
  const columnLabel = request.topic?.columnSlug ?? request.project.primaryColumnId.replace(/^column_/, "");
  const verificationLines = sourceNotes.length > 0 ? sourceNotes : ["Verify the examples, claims, and platform rules before publishing."];

  return {
    id: createEntityId("draft", `${request.project.id}-${request.nextVersion}`),
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    version: request.nextVersion,
    title: request.project.title,
    body: [
      "Brief",
      `Audience: ${audience}`,
      `Angle: ${hook}`,
      `Column: ${columnLabel}`,
      "",
      "Title Options",
      `1. ${request.project.title}`,
      `2. ${request.project.title}: a practical workflow`,
      `3. What changed after I rebuilt this as a repeatable system`,
      "",
      "Body Draft",
      `Open with the concrete problem: ${hook}`,
      "Explain the repeatable workflow in three steps: capture the input, process it with a clear assistant role, and archive the output for reuse.",
      "Add a personal operating note so the draft feels grounded instead of generic.",
      "Close with one action the reader can try today.",
      "",
      "Cover Copy",
      "Make the workflow visible",
      "",
      "Tag Suggestions",
      `#${columnLabel}`,
      "#workflow",
      "#creator-system",
      "#content-ops",
      "",
      "Visual Direction",
      "Use a clean checklist or before-after workflow diagram. Keep the cover text short and readable.",
      "",
      "Pending Verification",
      ...verificationLines.map((line, index) => `${index + 1}. ${line}`)
    ].join("\n"),
    createdBy: "assistant",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
```

- [ ] **Step 4: Export creation assistant API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./columns";
export * from "./content-loop";
export * from "./creation-assistant";
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

- [ ] **Step 6: Commit core creation assistant**

Run:

```bash
git add packages/core/src/creation-assistant.ts packages/core/src/creation-assistant.test.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add mock creation assistant"
```

## Task 2: Repository Draft Package Generation

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add to `packages/local-store/src/content-loop-repository.test.ts`:

```ts
  it("generates the next draft package in memory for a promoted project", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterGenerate = await repository.generateDraftPackage(projectId);

    expect(afterGenerate.drafts.filter((draft) => draft.contentProjectId === projectId)).toHaveLength(2);
    expect(afterGenerate.drafts[0]?.version).toBe(2);
    expect(afterGenerate.drafts[0]?.body).toContain("Title Options");
    expect(afterGenerate.selectedProjectId).toBe(projectId);
  });
```

Add to `packages/local-store/src/sqlite-content-loop-repository.test.ts`:

```ts
  it("persists generated draft packages across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
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

    expect(afterGenerate.drafts.filter((draft) => draft.contentProjectId === projectId)).toHaveLength(2);
    expect(afterReload).toEqual(afterGenerate);
  });

  it("does not insert a draft package for a missing project", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterGenerate = await repository.generateDraftPackage("project_missing");
    repository.close();

    expect(afterGenerate).toEqual(before);
  });
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `generateDraftPackage` is not on `ContentLoopRepository`.

- [ ] **Step 3: Extend repository contract and in-memory implementation**

Modify imports in `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  generateMockDraftPackage,
  generateMockTopics
} from "@robert-station/core";
```

Add to `ContentLoopRepository`:

```ts
generateDraftPackage(projectId: string): Promise<PersistedContentLoopState>;
```

Add to `InMemoryContentLoopRepository`:

```ts
async generateDraftPackage(projectId: string): Promise<PersistedContentLoopState> {
  const project = this.state.projects.find((candidate) => candidate.id === projectId);

  if (!project) {
    return cloneState(this.state);
  }

  const topic = project.sourceTopicId
    ? this.state.topics.find((candidate) => candidate.id === project.sourceTopicId) ?? null
    : null;
  const sourceReferences = this.state.sourceReferences.filter(
    (source) => source.topicId === project.sourceTopicId || source.contentProjectId === project.id
  );
  const nextVersion =
    Math.max(0, ...this.state.drafts.filter((draft) => draft.contentProjectId === project.id).map((draft) => draft.version)) + 1;
  const draft = generateMockDraftPackage({
    project,
    topic,
    sourceReferences,
    nextVersion,
    now: new Date()
  });

  this.state = {
    ...this.state,
    drafts: [draft, ...this.state.drafts],
    selectedProjectId: project.id
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
  generateMockDraftPackage,
  generateMockTopics
} from "@robert-station/core";
```

Add method to `SqliteContentLoopRepository`:

```ts
async generateDraftPackage(projectId: string): Promise<PersistedContentLoopState> {
  const project = this.getContentProject(projectId);

  if (!project) {
    return this.loadState();
  }

  const topic = project.sourceTopicId ? this.getTopic(project.sourceTopicId) : null;
  const sourceReferences = this.getSourceReferencesForProject(project);
  const draft = generateMockDraftPackage({
    project,
    topic,
    sourceReferences,
    nextVersion: this.getNextDraftVersion(project.id),
    now: this.createPromotionDate()
  });

  this.runTransaction(() => {
    this.upsertDraftVersion(draft);
  });

  return this.loadState(project.id);
}
```

Change `loadState()` signature and selected project logic:

```ts
private loadState(selectedProjectId?: string): PersistedContentLoopState {
  // keep existing queries
  const selectedProject = selectedProjectId
    ? { id: selectedProjectId }
    : (this.database
        .prepare("SELECT id FROM content_projects ORDER BY updated_at DESC, created_at DESC, id ASC LIMIT 1;")
        .get() as { id: string } | undefined);

  return {
    topics: topics.map(mapTopicRow),
    sourceReferences: sourceReferences.map(mapSourceReferenceRow),
    projects: projects.map(mapContentProjectRow),
    drafts: drafts.map(mapDraftVersionRow),
    selectedProjectId: selectedProject?.id ?? null
  };
}
```

Add helper methods:

```ts
private getContentProject(projectId: string): ContentProject | null {
  const row = this.database
    .prepare("SELECT * FROM content_projects WHERE id = ?;")
    .get(projectId) as ContentProjectRow | undefined;
  return row ? mapContentProjectRow(row) : null;
}

private getSourceReferencesForProject(project: ContentProject): SourceReference[] {
  const rows = this.database
    .prepare(
      `SELECT * FROM source_references
       WHERE topic_id = ? OR content_project_id = ?
       ORDER BY created_at ASC, id ASC;`
    )
    .all(project.sourceTopicId ?? null, project.id) as unknown as SourceReferenceRow[];

  return rows.map(mapSourceReferenceRow);
}

private getNextDraftVersion(projectId: string): number {
  const row = this.database
    .prepare("SELECT MAX(version) AS version FROM draft_versions WHERE content_project_id = ?;")
    .get(projectId) as { version: number | null };

  return (row.version ?? 0) + 1;
}
```

- [ ] **Step 5: Run local-store tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit repository draft generation**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist generated draft packages"
```

## Task 3: IPC And Preload Draft Package API

**Files:**

- Modify: `apps/desktop/src/main/ipc-channels.ts`
- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.ts`
- Modify: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Write failing loader test**

Add to `apps/desktop/src/renderer/content-loop-loader.test.ts`:

```ts
  it("generates draft packages through preload API", async () => {
    await generatePersistedDraftPackage("project_topic-ai-local-workstation");

    expect(window.robertStation.contentLoop.generateDraftPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });
```

Update import:

```ts
import {
  generatePersistedDraftPackage,
  generatePersistedTopics,
  loadPersistedContentLoop,
  promotePersistedTopic
} from "./content-loop-loader";
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because `generatePersistedDraftPackage` is missing.

- [ ] **Step 3: Add IPC channel**

Modify `apps/desktop/src/main/ipc-channels.ts`:

```ts
export const CONTENT_LOOP_LOAD_CHANNEL = "content-loop:load";
export const CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL = "content-loop:promote-topic";
export const CONTENT_LOOP_GENERATE_TOPICS_CHANNEL = "content-loop:generate-topics";
export const CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL = "content-loop:generate-draft-package";
```

- [ ] **Step 4: Register IPC handler with input validation**

Modify `apps/desktop/src/main/content-loop-service.ts` channel imports:

```ts
import {
  CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL,
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";
```

Add handler:

```ts
ipcMain.handle(CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL, async (_event, projectId: unknown) => {
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new Error("Invalid content project id.");
  }

  return repository.generateDraftPackage(projectId);
});
```

- [ ] **Step 5: Expose preload API**

Modify `apps/desktop/src/preload/preload.ts` channel imports:

```ts
CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL,
```

Add API method:

```ts
generateDraftPackage: (projectId: string) =>
  ipcRenderer.invoke(CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL, projectId) as Promise<PersistedContentLoopState>,
```

- [ ] **Step 6: Update renderer global type and loader**

Modify `apps/desktop/src/renderer/global.d.ts` and add:

```ts
generateDraftPackage: (projectId: string) => Promise<PersistedContentLoopState>;
```

Modify `apps/desktop/src/renderer/content-loop-loader.ts` and add:

```ts
export async function generatePersistedDraftPackage(projectId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generateDraftPackage(projectId);
}
```

- [ ] **Step 7: Update test setup mock**

Modify `apps/desktop/src/renderer/test-setup.ts` and add:

```ts
generateDraftPackage: vi.fn(async (projectId: string) => repository.generateDraftPackage(projectId)),
```

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
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose draft package ipc"
```

## Task 4: Creation Studio Draft Package UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add to `apps/desktop/src/renderer/App.test.tsx`:

```ts
  it("generates a draft package for the selected project", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft package" }));

    expect(await screen.findByText("Draft v2")).toBeInTheDocument();
    expect(screen.getByText("Title Options")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateDraftPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("shows an inline error and keeps the current draft when draft package generation fails", async () => {
    window.robertStation.contentLoop.generateDraftPackage = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft package" }));

    expect(await screen.findByText("Could not generate draft package. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Draft v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate draft package" })).toBeEnabled();
  });
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because Creation Studio has no draft package generation control.

- [ ] **Step 3: Add UI state and handler**

Modify imports in `apps/desktop/src/renderer/App.tsx`:

```ts
import {
  generatePersistedDraftPackage,
  generatePersistedTopics,
  loadPersistedContentLoop,
  promotePersistedTopic
} from "./content-loop-loader";
```

Add state:

```ts
const [isGeneratingDraftPackage, setIsGeneratingDraftPackage] = useState(false);
const [draftPackageError, setDraftPackageError] = useState<string | null>(null);
```

Add handler:

```ts
async function handleGenerateDraftPackage(projectId: string): Promise<void> {
  if (!isMountedRef.current) {
    return;
  }

  setIsGeneratingDraftPackage(true);
  setDraftPackageError(null);

  try {
    const nextState = await generatePersistedDraftPackage(projectId);
    if (isMountedRef.current) {
      setContentLoop(nextState);
    }
  } catch {
    if (isMountedRef.current) {
      setDraftPackageError("Could not generate draft package. Try again.");
    }
  } finally {
    if (isMountedRef.current) {
      setIsGeneratingDraftPackage(false);
    }
  }
}
```

- [ ] **Step 4: Render action bar in Creation Studio**

Inside the `selectedProject && selectedDraft` branch, before `<div className="draft-panel">`, add:

```tsx
<div className="creation-actions">
  <button
    disabled={isGeneratingDraftPackage}
    onClick={() => void handleGenerateDraftPackage(selectedProject.id)}
    type="button"
  >
    {isGeneratingDraftPackage ? "Generating..." : "Generate draft package"}
  </button>
  {draftPackageError ? (
    <p className="inline-error" role="alert">
      {draftPackageError}
    </p>
  ) : null}
</div>
```

Wrap the action bar plus draft/source panels in a fragment. Keep existing source rendering.

- [ ] **Step 5: Render draft body section labels cleanly**

Replace the current draft body paragraph mapping with a small block renderer:

```tsx
{selectedDraft.body.split("\n\n").map((block) => {
  const [firstLine, ...rest] = block.split("\n");
  const isSection = rest.length > 0 && /^[A-Z][A-Za-z ]+$/.test(firstLine);

  if (isSection) {
    return (
      <section className="draft-section" key={block}>
        <h3>{firstLine}</h3>
        {rest.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
    );
  }

  return <p key={block}>{block}</p>;
})}
```

- [ ] **Step 6: Include project-level sources**

Modify source filtering in `App.tsx`:

```ts
.filter((source) => source.topicId === selectedProject.sourceTopicId || source.contentProjectId === selectedProject.id)
```

- [ ] **Step 7: Add styles**

Add to `apps/desktop/src/renderer/styles.css`:

```css
.creation-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  grid-column: 1 / -1;
}

.draft-section {
  border-top: 1px solid #e2e8f0;
  margin-top: 16px;
  padding-top: 14px;
}

.draft-section h3 {
  font-size: 15px;
  margin: 0 0 8px;
}
```

- [ ] **Step 8: Run desktop tests, typecheck, build**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: all pass.

- [ ] **Step 9: Commit UI draft package generation**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/styles.css
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add draft package generation ui"
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

- Spec coverage: this plan implements deterministic draft package generation, draft version persistence, IPC/preload exposure, and Creation Studio UI.
- Out of scope: real model calls, prompt history, fact-review, publish packages, and image assets remain deferred.
- Type consistency: `generateDraftPackage(projectId)` returns `PersistedContentLoopState`; `DraftVersion` remains the persistence unit for generated material.
