# Local Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a local persistence boundary for the content loop so the desktop app loads its initial state through a repository API instead of hard-coded renderer state.

**Architecture:** Add a repository interface and an in-memory repository implementation in `@robert-station/local-store`, then expose it through Electron main/preload IPC. The first version keeps data in memory but uses repository and IPC contracts that can later be backed by SQLite without rewriting React screens.

**Tech Stack:** Electron IPC, React, TypeScript, Vitest, React Testing Library, npm workspaces.

---

## Scope

This plan implements the persistence boundary, not durable disk writes yet.

Included:

- `ContentLoopRepository` interface.
- `InMemoryContentLoopRepository` implementation.
- repository tests for load and promote behavior.
- Electron IPC channel definitions.
- preload API types and bridge.
- renderer loader that fetches content loop state through `window.robertStation.contentLoop.load()`.
- desktop UI loading state.

Deferred:

- real SQLite driver selection and migration runner.
- writing to disk.
- server sync.
- encrypted secrets.
- AI-generated topics.
- publish package persistence.

## Target File Structure

```text
packages/
  local-store/
    src/
      content-loop-repository.test.ts
      content-loop-repository.ts
      index.ts
apps/
  desktop/
    src/
      main/
        content-loop-service.ts
        ipc-channels.ts
        main.ts
      preload/
        preload.ts
      renderer/
        App.test.tsx
        App.tsx
        content-loop-loader.test.ts
        content-loop-loader.ts
        global.d.ts
        test-setup.ts
```

## Task 1: Local Store Repository Contract

**Files:**

- Create: `packages/local-store/src/content-loop-repository.ts`
- Create: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/index.ts`

- [ ] **Step 1: Write failing repository tests**

Create `packages/local-store/src/content-loop-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryContentLoopRepository } from "./content-loop-repository";

describe("InMemoryContentLoopRepository", () => {
  it("loads the seeded content loop state", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const state = await repository.loadContentLoop();

    expect(state.topics).toHaveLength(4);
    expect(state.projects).toHaveLength(0);
    expect(state.drafts).toHaveLength(0);
    expect(state.selectedProjectId).toBeNull();
  });

  it("promotes a topic and persists the updated state in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const topicId = before.topics[0]?.id;

    if (!topicId) {
      throw new Error("Expected seeded repository to include a first topic.");
    }

    const afterPromote = await repository.promoteTopic(topicId);
    const afterReload = await repository.loadContentLoop();

    expect(afterPromote.projects).toHaveLength(1);
    expect(afterPromote.drafts).toHaveLength(1);
    expect(afterPromote.topics.find((topic) => topic.id === topicId)?.status).toBe("promoted");
    expect(afterReload).toEqual(afterPromote);
  });
});
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `./content-loop-repository` does not exist.

- [ ] **Step 3: Implement repository interface and in-memory repository**

Create `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed
} from "@robert-station/core";
import type { ContentProject, DraftVersion, SourceReference, Topic } from "@robert-station/core";

export interface PersistedContentLoopState {
  topics: Topic[];
  sourceReferences: SourceReference[];
  projects: ContentProject[];
  drafts: DraftVersion[];
  selectedProjectId: string | null;
}

export interface ContentLoopRepository {
  loadContentLoop(): Promise<PersistedContentLoopState>;
  promoteTopic(topicId: string): Promise<PersistedContentLoopState>;
}

export class InMemoryContentLoopRepository implements ContentLoopRepository {
  private state: PersistedContentLoopState;

  private constructor(initialState: PersistedContentLoopState) {
    this.state = cloneState(initialState);
  }

  static createSeeded(workspaceId: string): InMemoryContentLoopRepository {
    const seed = createSampleContentLoopSeed(workspaceId);

    return new InMemoryContentLoopRepository({
      topics: seed.topics,
      sourceReferences: seed.sourceReferences,
      projects: [],
      drafts: [],
      selectedProjectId: null
    });
  }

  async loadContentLoop(): Promise<PersistedContentLoopState> {
    return cloneState(this.state);
  }

  async promoteTopic(topicId: string): Promise<PersistedContentLoopState> {
    const topic = this.state.topics.find((candidate) => candidate.id === topicId);

    if (!topic || topic.status === "promoted") {
      return cloneState(this.state);
    }

    const result = createContentProjectFromTopic(topic, `column_${topic.columnSlug}`);
    this.state = {
      ...this.state,
      topics: this.state.topics.map((candidate) => (candidate.id === topicId ? result.updatedTopic : candidate)),
      projects: [result.project, ...this.state.projects],
      drafts: [result.draft, ...this.state.drafts],
      selectedProjectId: result.project.id
    };

    return cloneState(this.state);
  }
}

function cloneState(state: PersistedContentLoopState): PersistedContentLoopState {
  return structuredClone(state);
}
```

- [ ] **Step 4: Export repository APIs**

Modify `packages/local-store/src/index.ts`:

```ts
export * from "./content-loop-repository";
export * from "./file-repository";
export * from "./schema";
```

- [ ] **Step 5: Run local-store tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit repository contract**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/index.ts
git commit -m "feat: add content loop repository"
```

Expected: commit succeeds.

## Task 2: Electron IPC Boundary

**Files:**

- Create: `apps/desktop/src/main/ipc-channels.ts`
- Create: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/main/main.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Create: `apps/desktop/src/renderer/global.d.ts`

- [ ] **Step 1: Create IPC channel constants**

Create `apps/desktop/src/main/ipc-channels.ts`:

```ts
export const CONTENT_LOOP_LOAD_CHANNEL = "content-loop:load";
export const CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL = "content-loop:promote-topic";
```

- [ ] **Step 2: Create main-process content loop service**

Create `apps/desktop/src/main/content-loop-service.ts`:

```ts
import { ipcMain } from "electron";
import { InMemoryContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";

const WORKSPACE_ID = "workspace_robert-station";

export function registerContentLoopIpc(): void {
  const repository = InMemoryContentLoopRepository.createSeeded(WORKSPACE_ID);

  ipcMain.handle(CONTENT_LOOP_LOAD_CHANNEL, async () => repository.loadContentLoop());
  ipcMain.handle(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, async (_event, topicId: string) =>
    repository.promoteTopic(topicId)
  );
}
```

- [ ] **Step 3: Register IPC in main process**

Modify `apps/desktop/src/main/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { registerContentLoopIpc } from "./content-loop-service";

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "Robert Station",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  registerContentLoopIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

- [ ] **Step 4: Expose preload API**

Modify `apps/desktop/src/preload/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import {
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "../main/ipc-channels";

contextBridge.exposeInMainWorld("robertStation", {
  appName: "Robert Station",
  contentLoop: {
    load: () => ipcRenderer.invoke(CONTENT_LOOP_LOAD_CHANNEL) as Promise<PersistedContentLoopState>,
    promoteTopic: (topicId: string) =>
      ipcRenderer.invoke(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, topicId) as Promise<PersistedContentLoopState>
  }
});
```

- [ ] **Step 5: Add renderer global types**

Create `apps/desktop/src/renderer/global.d.ts`:

```ts
import type { PersistedContentLoopState } from "@robert-station/local-store";

declare global {
  interface Window {
    robertStation: {
      appName: string;
      contentLoop: {
        load: () => Promise<PersistedContentLoopState>;
        promoteTopic: (topicId: string) => Promise<PersistedContentLoopState>;
      };
    };
  }
}

export {};
```

- [ ] **Step 6: Run desktop typecheck and build**

Run:

```bash
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: both commands pass.

- [ ] **Step 7: Commit IPC boundary**

Run:

```bash
git add apps/desktop/src/main apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts
git commit -m "feat: expose content loop IPC"
```

Expected: commit succeeds.

## Task 3: Renderer Loader

**Files:**

- Create: `apps/desktop/src/renderer/content-loop-loader.ts`
- Create: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Modify: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Write failing loader tests**

Create `apps/desktop/src/renderer/content-loop-loader.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { loadPersistedContentLoop, promotePersistedTopic } from "./content-loop-loader";

describe("content loop loader", () => {
  it("loads content loop state from preload API", async () => {
    const state = await loadPersistedContentLoop();

    expect(window.robertStation.contentLoop.load).toHaveBeenCalledOnce();
    expect(state.topics).toHaveLength(4);
  });

  it("promotes topics through preload API", async () => {
    await promotePersistedTopic("topic_ai_local-workstation");

    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });
});
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because `content-loop-loader` does not exist.

- [ ] **Step 3: Add preload API mock to test setup**

Modify `apps/desktop/src/renderer/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { createSampleContentLoopSeed } from "@robert-station/core";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

function createMockState() {
  const seed = createSampleContentLoopSeed("workspace_robert-station");

  return {
    topics: seed.topics,
    sourceReferences: seed.sourceReferences,
    projects: [],
    drafts: [],
    selectedProjectId: null
  };
}

beforeEach(() => {
  const state = createMockState();

  window.robertStation = {
    appName: "Robert Station",
    contentLoop: {
      load: vi.fn(async () => state),
      promoteTopic: vi.fn(async () => state)
    }
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
```

- [ ] **Step 4: Implement loader**

Create `apps/desktop/src/renderer/content-loop-loader.ts`:

```ts
import type { PersistedContentLoopState } from "@robert-station/local-store";

export async function loadPersistedContentLoop(): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.load();
}

export async function promotePersistedTopic(topicId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.promoteTopic(topicId);
}
```

- [ ] **Step 5: Run desktop tests and typecheck**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit renderer loader**

Run:

```bash
git add apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/test-setup.ts
git commit -m "feat: load content loop through preload API"
```

Expected: commit succeeds.

## Task 4: App Uses Persisted Loader

**Files:**

- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Update App test for async load**

Modify `apps/desktop/src/renderer/App.test.tsx` to use async queries:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders dashboard counts and equal-priority columns after loading persisted state", async () => {
    render(<App />);

    expect(screen.getByText("Loading content loop...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("4 candidate topics")).toBeInTheDocument();
    expect(screen.getByText("0 active projects")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("promotes a topic through persistence API and shows its draft", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    expect(await screen.findByRole("heading", { name: "Creation Studio" })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });
});
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because App does not show loading state or call the preload API.

- [ ] **Step 3: Update App to use loader**

Modify `apps/desktop/src/renderer/App.tsx`:

```tsx
import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { loadPersistedContentLoop, promotePersistedTopic } from "./content-loop-loader";

const workflowStages = ["Dashboard", "Topic Pool", "Projects", "Creation Studio"] as const;

type Screen = (typeof workflowStages)[number];

export function App(): ReactElement {
  const [screen, setScreen] = useState<Screen>("Dashboard");
  const [contentLoop, setContentLoop] = useState<PersistedContentLoopState | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadPersistedContentLoop().then((state) => {
      if (!cancelled) {
        setContentLoop(state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const screenTitle = useMemo(() => {
    if (screen === "Dashboard") {
      return "Robert Station";
    }

    return screen;
  }, [screen]);

  async function handlePromote(topicId: string): Promise<void> {
    const nextState = await promotePersistedTopic(topicId);
    setContentLoop(nextState);
    setScreen("Creation Studio");
  }

  if (!contentLoop) {
    return (
      <main className="loading-shell">
        <p>Loading content loop...</p>
      </main>
    );
  }

  const selectedProject = contentLoop.projects.find((project) => project.id === contentLoop.selectedProjectId) ?? null;
  const selectedDraft = selectedProject
    ? contentLoop.drafts.find((draft) => draft.contentProjectId === selectedProject.id) ?? null
    : null;
  const candidateTopicCount = contentLoop.topics.filter((topic) => topic.status === "candidate").length;
  const activeProjectCount = contentLoop.projects.length;

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">RS</div>
        <nav>
          {workflowStages.map((stage) => (
            <button
              className={screen === stage ? "nav-button nav-button--active" : "nav-button"}
              key={stage}
              onClick={() => setScreen(stage)}
              type="button"
            >
              {stage}
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Content operations workbench</p>
            <h1>{screenTitle}</h1>
          </div>
          <div className="metric-strip" aria-label="Content loop metrics">
            <span>{candidateTopicCount} candidate topics</span>
            <span>
              {activeProjectCount} active {activeProjectCount === 1 ? "project" : "projects"}
            </span>
          </div>
        </header>

        {screen === "Dashboard" ? (
          <section className="summary-grid" aria-label="Content columns">
            {DEFAULT_COLUMNS.map((column) => (
              <article className="column-card" key={column.slug}>
                <div className="column-card__header">
                  <h2>{column.name}</h2>
                  <span>Priority {column.priority}</span>
                </div>
                <p>{column.description}</p>
                <dl>
                  <div>
                    <dt>Topics</dt>
                    <dd>{contentLoop.topics.filter((topic) => topic.columnSlug === column.slug).length}</dd>
                  </div>
                  <div>
                    <dt>Drafts</dt>
                    <dd>{contentLoop.drafts.length}</dd>
                  </div>
                  <div>
                    <dt>Published</dt>
                    <dd>0</dd>
                  </div>
                </dl>
              </article>
            ))}
          </section>
        ) : null}

        {screen === "Topic Pool" ? (
          <section className="topic-grid" aria-label="Topic candidates">
            {contentLoop.topics.map((topic) => (
              <article aria-label={topic.title} className="topic-card" key={topic.id}>
                <div className="topic-card__meta">
                  <span>{topic.columnSlug}</span>
                  <span>{topic.status}</span>
                </div>
                <h2>{topic.title}</h2>
                <p>{topic.hook}</p>
                <dl className="score-grid">
                  <div>
                    <dt>Heat</dt>
                    <dd>{topic.score.heat}</dd>
                  </div>
                  <div>
                    <dt>Fit</dt>
                    <dd>{topic.score.fit}</dd>
                  </div>
                  <div>
                    <dt>Difficulty</dt>
                    <dd>{topic.score.difficulty}</dd>
                  </div>
                </dl>
                <button disabled={topic.status === "promoted"} onClick={() => void handlePromote(topic.id)} type="button">
                  {topic.status === "promoted" ? "Promoted" : "Promote to project"}
                </button>
              </article>
            ))}
          </section>
        ) : null}

        {screen === "Projects" ? (
          <section className="project-list" aria-label="Content projects">
            {contentLoop.projects.length === 0 ? (
              <p className="empty-state">No content projects yet. Promote a topic to start drafting.</p>
            ) : (
              contentLoop.projects.map((project) => (
                <button
                  className="project-row"
                  key={project.id}
                  onClick={() => {
                    setContentLoop((current) => (current ? { ...current, selectedProjectId: project.id } : current));
                    setScreen("Creation Studio");
                  }}
                  type="button"
                >
                  <span>{project.title}</span>
                  <strong>{project.status}</strong>
                </button>
              ))
            )}
          </section>
        ) : null}

        {screen === "Creation Studio" ? (
          <section className="creation-studio" aria-label="Selected project draft">
            {selectedProject && selectedDraft ? (
              <>
                <div className="draft-panel">
                  <p className="eyebrow">Draft v{selectedDraft.version}</p>
                  <h2>{selectedDraft.title}</h2>
                  {selectedDraft.body.split("\n\n").map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <aside className="source-panel">
                  <h2>Sources</h2>
                  {contentLoop.sourceReferences
                    .filter((source) => source.topicId === selectedProject.sourceTopicId)
                    .map((source) => (
                      <article key={source.id}>
                        <h3>{source.title}</h3>
                        <p>{source.note}</p>
                      </article>
                    ))}
                </aside>
              </>
            ) : (
              <p className="empty-state">Select or promote a topic to open the first draft.</p>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add loading style**

Append to `apps/desktop/src/renderer/styles.css`:

```css
.loading-shell {
  align-items: center;
  color: #64748b;
  display: flex;
  min-height: 100vh;
  justify-content: center;
}
```

- [ ] **Step 5: Run desktop tests, typecheck, and build**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: all three commands pass.

- [ ] **Step 6: Commit persisted loader integration**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/styles.css
git commit -m "feat: load content loop through repository boundary"
```

Expected: commit succeeds.

## Task 5: Whole-Repo Verification

**Files:**

- Modify: none unless verification reveals a defect.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: all workspace tests pass.

- [ ] **Step 2: Run all typechecks**

Run:

```bash
npm run typecheck
```

Expected: all workspace typechecks pass.

- [ ] **Step 3: Run all builds**

Run:

```bash
npm run build
```

Expected: all workspace builds pass.

- [ ] **Step 4: Run production dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: exits 0 and reports `found 0 vulnerabilities`.

- [ ] **Step 5: Check Git diff cleanliness**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` shows no uncommitted files after commits are complete.

## Self-Review

Spec coverage:

- Covered: local-first repository boundary, preload IPC API, renderer loading state, and promotion through the persistence boundary.
- Deferred by design: real SQLite driver and disk persistence. This plan creates the seam needed for a later SQLite-backed repository without changing the renderer again.

Unresolved-marker scan:

- No unresolved markers or unspecified implementation steps are intentionally present.
- Every code-changing step includes exact file content.

Type consistency:

- `PersistedContentLoopState` is exported from `@robert-station/local-store`.
- `window.robertStation.contentLoop.load()` and `promoteTopic()` both return `Promise<PersistedContentLoopState>`.
- `App.tsx` depends on `content-loop-loader.ts`, not direct in-memory helpers.

