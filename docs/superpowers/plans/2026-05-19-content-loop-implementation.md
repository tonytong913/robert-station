# Content Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local content loop: topic cards can be promoted into content projects, projects can show draft history, and the desktop UI exposes Topic Pool, Projects, and Creation Studio screens.

**Architecture:** Extend `@robert-station/core` with topic, project, draft, and source-reference domain models plus deterministic seed data. Extend `@robert-station/local-store` schema to persist those entities later. Keep the desktop implementation local and in-memory for this slice, with React state managing topic promotion and draft display; cloud AI, real SQLite writes, server sync, publish packages, and data import remain separate plans.

**Tech Stack:** Electron, React, TypeScript, Vitest, React Testing Library, npm workspaces.

---

## Scope

This plan implements the first usable Content Loop slice:

- topic model;
- content project model;
- draft version model;
- source reference model;
- local schema tables for topics, drafts, and source references;
- desktop navigation between Dashboard, Topic Pool, Projects, and Creation Studio;
- local "Promote to project" interaction;
- selected project detail with draft and source information.

This plan does not implement cloud AI calls, real SQLite writes, server sync, platform publish packages, CSV/Excel import, OCR, review generation, or knowledge extraction.

## Target File Structure

```text
packages/
  core/
    src/
      content-loop.test.ts
      content-loop.ts
      index.ts
      types.ts
  local-store/
    src/
      schema.test.ts
      schema.ts
apps/
  desktop/
    src/
      renderer/
        App.test.tsx
        App.tsx
        content-loop.test.ts
        content-loop.ts
        styles.css
```

## Task 1: Core Content Loop Domain

**Files:**

- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/content-loop.ts`
- Create: `packages/core/src/content-loop.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing core domain tests**

Create `packages/core/src/content-loop.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createContentProjectFromTopic, createSampleContentLoopSeed } from "./content-loop";

describe("content loop domain", () => {
  it("creates sample topic cards across all four columns", () => {
    const seed = createSampleContentLoopSeed("workspace_robert-station");

    expect(seed.topics.map((topic) => topic.columnSlug)).toEqual([
      "ai",
      "finance",
      "parenting",
      "fitness"
    ]);
    expect(seed.topics.every((topic) => topic.status === "candidate")).toBe(true);
    expect(seed.sourceReferences).toHaveLength(4);
  });

  it("promotes a topic into a draftable content project", () => {
    const seed = createSampleContentLoopSeed("workspace_robert-station");
    const topic = seed.topics[0];
    const result = createContentProjectFromTopic(topic, "column_ai");

    expect(result.project.title).toBe(topic.title);
    expect(result.project.status).toBe("drafting");
    expect(result.draft.title).toBe(topic.title);
    expect(result.draft.body).toContain(topic.hook);
    expect(result.updatedTopic.status).toBe("promoted");
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./content-loop` does not exist.

- [ ] **Step 3: Add content loop types**

Modify `packages/core/src/types.ts` by appending:

```ts
export type TopicStatus = "candidate" | "kept" | "discarded" | "promoted";

export type ContentProjectStatus = "topic" | "drafting" | "ready_to_publish" | "published" | "reviewed" | "archived";

export type SourceReferenceKind = "link" | "note" | "claim" | "risk";

export interface TopicScore {
  heat: number;
  fit: number;
  difficulty: number;
  personaConsistency: number;
}

export interface Topic {
  id: EntityId;
  workspaceId: EntityId;
  columnSlug: ContentColumnSlug;
  title: string;
  hook: string;
  audience: string;
  targetPlatforms: Platform[];
  status: TopicStatus;
  score: TopicScore;
  createdAt: string;
  updatedAt: string;
}

export interface SourceReference {
  id: EntityId;
  workspaceId: EntityId;
  topicId?: EntityId;
  contentProjectId?: EntityId;
  kind: SourceReferenceKind;
  title: string;
  url?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentProject {
  id: EntityId;
  workspaceId: EntityId;
  primaryColumnId: EntityId;
  sourceTopicId?: EntityId;
  title: string;
  status: ContentProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersion {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  version: number;
  title: string;
  body: string;
  createdBy: "assistant" | "human";
  createdAt: string;
  updatedAt: string;
}

export interface ContentLoopSeed {
  topics: Topic[];
  sourceReferences: SourceReference[];
}
```

- [ ] **Step 4: Implement content loop helpers**

Create `packages/core/src/content-loop.ts`:

```ts
import { createEntityId } from "./ids";
import type {
  ContentLoopSeed,
  ContentProject,
  DraftVersion,
  SourceReference,
  Topic
} from "./types";

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function createSampleContentLoopSeed(workspaceId: string, now = DEFAULT_NOW): ContentLoopSeed {
  const timestamp = now.toISOString();
  const topics: Topic[] = [
    {
      id: "topic_ai_local-workstation",
      workspaceId,
      columnSlug: "ai",
      title: "How to build a personal AI workstation for daily content work",
      hook: "Turn scattered AI tools into one repeatable daily workflow.",
      audience: "Creators who want practical AI productivity gains.",
      targetPlatforms: ["xiaohongshu", "bilibili"],
      status: "candidate",
      score: { heat: 86, fit: 92, difficulty: 48, personaConsistency: 90 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "topic_finance-family-dashboard",
      workspaceId,
      columnSlug: "finance",
      title: "A simple family finance dashboard for monthly decisions",
      hook: "A lightweight review habit beats complicated spreadsheets.",
      audience: "Families who want calmer monthly money decisions.",
      targetPlatforms: ["xiaohongshu"],
      status: "candidate",
      score: { heat: 72, fit: 84, difficulty: 42, personaConsistency: 82 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "topic_parenting-evening-routine",
      workspaceId,
      columnSlug: "parenting",
      title: "An evening routine that reduces parent-child friction",
      hook: "Make the next morning easier by designing the previous night.",
      audience: "Parents looking for practical daily routines.",
      targetPlatforms: ["xiaohongshu", "wechat_channels"],
      status: "candidate",
      score: { heat: 78, fit: 80, difficulty: 35, personaConsistency: 78 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "topic_fitness-swim-gym-week",
      workspaceId,
      columnSlug: "fitness",
      title: "How to combine swimming and gym training in one week",
      hook: "Balance cardio, strength, and recovery without over-planning.",
      audience: "Busy adults building a sustainable fitness routine.",
      targetPlatforms: ["xiaohongshu", "douyin"],
      status: "candidate",
      score: { heat: 68, fit: 76, difficulty: 38, personaConsistency: 80 },
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  const sourceReferences: SourceReference[] = topics.map((topic) => ({
    id: createEntityId("source", topic.id),
    workspaceId,
    topicId: topic.id,
    kind: "note",
    title: `Research note for ${topic.title}`,
    note: topic.hook,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  return { topics, sourceReferences };
}

export function createContentProjectFromTopic(
  topic: Topic,
  primaryColumnId: string,
  now = DEFAULT_NOW
): { project: ContentProject; draft: DraftVersion; updatedTopic: Topic } {
  const timestamp = now.toISOString();
  const projectId = createEntityId("project", topic.id);

  return {
    project: {
      id: projectId,
      workspaceId: topic.workspaceId,
      primaryColumnId,
      sourceTopicId: topic.id,
      title: topic.title,
      status: "drafting",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    draft: {
      id: createEntityId("draft", `${projectId}-1`),
      workspaceId: topic.workspaceId,
      contentProjectId: projectId,
      version: 1,
      title: topic.title,
      body: `Brief hook: ${topic.hook}\n\nAudience: ${topic.audience}\n\nDraft outline:\n1. Open with the concrete problem.\n2. Explain the repeatable workflow.\n3. Close with one practical next step.`,
      createdBy: "assistant",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    updatedTopic: {
      ...topic,
      status: "promoted",
      updatedAt: timestamp
    }
  };
}
```

- [ ] **Step 5: Export content loop helpers**

Modify `packages/core/src/index.ts`:

```ts
export * from "./columns";
export * from "./content-loop";
export * from "./ids";
export * from "./types";
```

- [ ] **Step 6: Run core tests and typecheck**

Run:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/core run typecheck
```

Expected: both commands pass.

- [ ] **Step 7: Commit core content loop domain**

Run:

```bash
git add packages/core
git commit -m "feat: add content loop domain"
```

Expected: commit succeeds.

## Task 2: Local Store Content Loop Schema

**Files:**

- Modify: `packages/local-store/src/schema.test.ts`
- Modify: `packages/local-store/src/schema.ts`

- [ ] **Step 1: Write failing schema coverage test**

Modify `packages/local-store/src/schema.test.ts` to:

```ts
import { describe, expect, it } from "vitest";
import { SQLITE_SCHEMA, getSqliteSchemaStatements } from "./schema";

describe("SQLite schema", () => {
  it("contains core foundation and content loop tables", () => {
    for (const table of [
      "workspaces",
      "personas",
      "platform_accounts",
      "columns",
      "topics",
      "content_projects",
      "draft_versions",
      "source_references",
      "assets"
    ]) {
      expect(SQLITE_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("tracks sync metadata on local-first entities", () => {
    expect(SQLITE_SCHEMA).toContain("remote_id TEXT");
    expect(SQLITE_SCHEMA).toContain("sync_status TEXT NOT NULL DEFAULT 'local'");
    expect(SQLITE_SCHEMA).toContain("updated_at TEXT NOT NULL");
  });

  it("returns executable statements without empty entries", () => {
    const statements = getSqliteSchemaStatements();

    expect(statements.length).toBeGreaterThan(8);
    expect(statements.every((statement) => statement.endsWith(";"))).toBe(true);
    expect(statements.every((statement) => statement.trim().length > 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `topics`, `draft_versions`, and `source_references` tables are not in the schema.

- [ ] **Step 3: Add content loop tables to schema**

Modify `packages/local-store/src/schema.ts` so `SQLITE_SCHEMA` includes these table definitions between `columns` and `content_projects`:

```sql
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  column_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  audience TEXT NOT NULL,
  target_platforms_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate',
  score_json TEXT NOT NULL DEFAULT '{}',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Modify the existing `content_projects` table so it includes `source_topic_id TEXT REFERENCES topics(id),` after `primary_column_id`.

Add these table definitions after `content_projects`:

```sql
CREATE TABLE IF NOT EXISTS draft_versions (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_references (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  topic_id TEXT REFERENCES topics(id),
  content_project_id TEXT REFERENCES content_projects(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  note TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 4: Run local-store tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit local-store schema extension**

Run:

```bash
git add packages/local-store/src/schema.test.ts packages/local-store/src/schema.ts
git commit -m "feat: add content loop local schema"
```

Expected: commit succeeds.

## Task 3: Desktop Content Loop State Helpers

**Files:**

- Create: `apps/desktop/src/renderer/content-loop.ts`
- Create: `apps/desktop/src/renderer/content-loop.test.ts`

- [ ] **Step 1: Write failing renderer state tests**

Create `apps/desktop/src/renderer/content-loop.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initializeContentLoopState, promoteTopicToProject } from "./content-loop";

describe("renderer content loop state", () => {
  it("starts with candidate topics and no projects", () => {
    const state = initializeContentLoopState();

    expect(state.topics).toHaveLength(4);
    expect(state.projects).toHaveLength(0);
    expect(state.drafts).toHaveLength(0);
    expect(state.selectedProjectId).toBeNull();
  });

  it("promotes a topic into the selected project", () => {
    const state = initializeContentLoopState();
    const topicId = state.topics[0].id;
    const nextState = promoteTopicToProject(state, topicId);

    expect(nextState.topics.find((topic) => topic.id === topicId)?.status).toBe("promoted");
    expect(nextState.projects).toHaveLength(1);
    expect(nextState.drafts).toHaveLength(1);
    expect(nextState.selectedProjectId).toBe(nextState.projects[0].id);
  });
});
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because `./content-loop` does not exist.

- [ ] **Step 3: Implement renderer state helpers**

Create `apps/desktop/src/renderer/content-loop.ts`:

```ts
import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  DEFAULT_COLUMNS
} from "@robert-station/core";
import type { ContentProject, DraftVersion, SourceReference, Topic } from "@robert-station/core";

const WORKSPACE_ID = "workspace_robert-station";

export interface ContentLoopState {
  topics: Topic[];
  sourceReferences: SourceReference[];
  projects: ContentProject[];
  drafts: DraftVersion[];
  selectedProjectId: string | null;
}

export function initializeContentLoopState(): ContentLoopState {
  const seed = createSampleContentLoopSeed(WORKSPACE_ID);

  return {
    topics: seed.topics,
    sourceReferences: seed.sourceReferences,
    projects: [],
    drafts: [],
    selectedProjectId: null
  };
}

export function promoteTopicToProject(state: ContentLoopState, topicId: string): ContentLoopState {
  const topic = state.topics.find((candidate) => candidate.id === topicId);

  if (!topic || topic.status === "promoted") {
    return state;
  }

  const column = DEFAULT_COLUMNS.find((candidate) => candidate.slug === topic.columnSlug);
  const primaryColumnId = column ? `column_${column.slug}` : "column_ai";
  const result = createContentProjectFromTopic(topic, primaryColumnId);

  return {
    ...state,
    topics: state.topics.map((candidate) => (candidate.id === topicId ? result.updatedTopic : candidate)),
    projects: [result.project, ...state.projects],
    drafts: [result.draft, ...state.drafts],
    selectedProjectId: result.project.id
  };
}
```

- [ ] **Step 4: Run desktop tests and typecheck**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit renderer state helpers**

Run:

```bash
git add apps/desktop/src/renderer/content-loop.ts apps/desktop/src/renderer/content-loop.test.ts
git commit -m "feat: add desktop content loop state"
```

Expected: commit succeeds.

## Task 4: Desktop Content Loop UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Replace dashboard tests with content loop tests**

Modify `apps/desktop/src/renderer/App.test.tsx` to:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders dashboard counts and equal-priority columns", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("4 candidate topics")).toBeInTheDocument();
    expect(screen.getByText("0 active projects")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("promotes a topic into a project and shows its draft", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    expect(screen.getByText("1 active project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Creation Studio" })).toBeInTheDocument();
    expect(screen.getByText("Brief hook: Turn scattered AI tools into one repeatable daily workflow.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because the current app has no screen state, topic promotion, or draft view.

- [ ] **Step 3: Implement content loop UI**

Modify `apps/desktop/src/renderer/App.tsx` to:

```tsx
import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { initializeContentLoopState, promoteTopicToProject } from "./content-loop";

const workflowStages = ["Dashboard", "Topic Pool", "Projects", "Creation Studio"];

type Screen = (typeof workflowStages)[number];

export function App(): ReactElement {
  const [screen, setScreen] = useState<Screen>("Dashboard");
  const [contentLoop, setContentLoop] = useState(() => initializeContentLoopState());

  const selectedProject = contentLoop.projects.find((project) => project.id === contentLoop.selectedProjectId) ?? null;
  const selectedDraft = selectedProject
    ? contentLoop.drafts.find((draft) => draft.contentProjectId === selectedProject.id) ?? null
    : null;

  const candidateTopicCount = contentLoop.topics.filter((topic) => topic.status === "candidate").length;
  const activeProjectCount = contentLoop.projects.length;

  const screenTitle = useMemo(() => {
    if (screen === "Dashboard") return "Robert Station";
    return screen;
  }, [screen]);

  function handlePromote(topicId: string): void {
    setContentLoop((current) => promoteTopicToProject(current, topicId));
    setScreen("Creation Studio");
  }

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
            <span>{activeProjectCount} active {activeProjectCount === 1 ? "project" : "projects"}</span>
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
                <button disabled={topic.status === "promoted"} onClick={() => handlePromote(topic.id)} type="button">
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
                    setContentLoop((current) => ({ ...current, selectedProjectId: project.id }));
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

- [ ] **Step 4: Add content loop styles**

Append to `apps/desktop/src/renderer/styles.css`:

```css
.metric-strip {
  display: flex;
  gap: 10px;
}

.metric-strip span,
.topic-card__meta span {
  background: #e6f4f1;
  border-radius: 6px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 10px;
}

.nav-button {
  background: transparent;
  border: 0;
  color: #cbd5e1;
  text-align: left;
}

.nav-button:hover,
.nav-button--active {
  background: #1f2937;
  color: #ffffff;
}

.topic-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.topic-card,
.draft-panel,
.source-panel,
.project-row {
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 8px;
  padding: 18px;
}

.topic-card__meta {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.topic-card h2,
.draft-panel h2,
.source-panel h2 {
  font-size: 20px;
  margin: 16px 0 8px;
}

.score-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, 1fr);
  margin: 18px 0;
}

.score-grid div {
  background: #f8fafc;
  border-radius: 6px;
  padding: 10px;
}

.score-grid dt {
  color: #64748b;
  font-size: 12px;
}

.score-grid dd {
  font-weight: 700;
  margin: 2px 0 0;
}

.project-list {
  display: grid;
  gap: 10px;
}

.project-row {
  align-items: center;
  color: #172026;
  display: flex;
  justify-content: space-between;
  text-align: left;
}

.creation-studio {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 320px;
}

.source-panel article {
  border-top: 1px solid #dbe3ea;
  padding-top: 12px;
}

.source-panel h3 {
  font-size: 15px;
  margin: 0 0 6px;
}

.empty-state {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  padding: 24px;
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

- [ ] **Step 6: Commit desktop content loop UI**

Run:

```bash
git add apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/styles.css
git commit -m "feat: add desktop content loop UI"
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

- Covered in this plan: topic pool model, content project creation, draft version model, source references, local schema extension, basic desktop Topic Pool, Projects, and Creation Studio screens.
- Deferred by design: cloud model calls, real SQLite persistence, server archive, sync, platform publish packages, data import, OCR, review, knowledge base. Those are independent subsystems from the product design and should receive separate implementation plans.

Unresolved-marker scan:

- No unresolved markers or unspecified implementation steps are intentionally present.
- Every code-changing step includes exact file content or exact patch instructions.

Type consistency:

- `Topic`, `ContentProject`, `DraftVersion`, and `SourceReference` are defined in `packages/core/src/types.ts`.
- `createSampleContentLoopSeed` and `createContentProjectFromTopic` are exported from `packages/core/src/index.ts`.
- Desktop state helpers import domain functions from `@robert-station/core` and expose `initializeContentLoopState` plus `promoteTopicToProject`.

