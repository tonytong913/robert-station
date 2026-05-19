# Archive Assistant V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local archive workflow that turns a content project into an archive record and a reusable knowledge item.

**Architecture:** Add archive domain types and a deterministic generator in `@robert-station/core`, extend `ContentLoopRepository` state with archive records and knowledge items, persist them in SQLite, expose `archiveProject(projectId)` through Electron IPC/preload, and add an Archive action plus Knowledge screen in the renderer.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- `ArchiveRecord` and `KnowledgeItem` domain types.
- Deterministic archive generation from project, latest draft, latest package, topic, and sources.
- In-memory and SQLite persistence.
- IPC/preload/renderer loader API.
- Creation Studio archive action.
- Knowledge screen listing local reusable knowledge items.

Deferred:

- server sync execution.
- publish URL capture.
- imported metrics.
- performance review reports.
- search, embeddings, and editing knowledge items.

## Target File Structure

```text
packages/
  core/
    src/
      archive-assistant.test.ts
      archive-assistant.ts
      index.ts
      types.ts
  local-store/
    src/
      content-loop-repository.test.ts
      content-loop-repository.ts
      schema.test.ts
      schema.ts
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
        content-loop-service.test.ts
        global.d.ts
        test-setup.ts
        styles.css
```

## Task 1: Core Archive Assistant

**Files:**

- Create: `packages/core/src/archive-assistant.test.ts`
- Create: `packages/core/src/archive-assistant.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing archive assistant tests**

Create `packages/core/src/archive-assistant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateMockArchivePackage } from "./archive-assistant";
import type { ContentProject, DraftVersion, PlatformPackage, SourceReference, Topic } from "./types";

const topic: Topic = {
  id: "topic_ai_local-workstation",
  workspaceId: "workspace_robert-station",
  columnSlug: "ai",
  title: "How to build a personal AI workstation for daily content work",
  hook: "Turn scattered AI tools into one repeatable daily workflow.",
  audience: "Creators who want practical AI productivity gains.",
  targetPlatforms: ["xiaohongshu"],
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

const draft: DraftVersion = {
  id: "draft_project-topic-ai-local-workstation-2",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  version: 2,
  title: project.title,
  body: "Body Draft\nTurn scattered AI tools into one repeatable daily workflow.",
  createdBy: "assistant",
  createdAt: "2026-05-19T12:00:00.000Z",
  updatedAt: "2026-05-19T12:00:00.000Z"
};

const platformPackage: PlatformPackage = {
  id: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  draftVersionId: draft.id,
  platform: "xiaohongshu",
  title: "AI workstation flow",
  body: "Turn scattered AI tools into one repeatable daily workflow.",
  tags: ["#ai", "#workflow"],
  coverText: "Make the workflow visible",
  requiredAssets: ["Cover image"],
  checks: [{ name: "Body", status: "pass", message: "Body copy is present." }],
  createdAt: "2026-05-19T13:00:00.000Z",
  updatedAt: "2026-05-19T13:00:00.000Z"
};

const sourceReferences: SourceReference[] = [
  {
    id: "source_topic-ai-local-workstation",
    workspaceId: "workspace_robert-station",
    topicId: topic.id,
    kind: "note",
    title: "Research note",
    note: "Verify tool availability before publishing.",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z"
  }
];

describe("generateMockArchivePackage", () => {
  it("generates deterministic archive and knowledge records", () => {
    const result = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences,
      now: new Date("2026-05-19T14:00:00.000Z")
    });

    expect(result.archiveRecord.id).toBe("archive-record_project-topic-ai-local-workstation");
    expect(result.archiveRecord.contentProjectId).toBe(project.id);
    expect(result.archiveRecord.draftVersionId).toBe(draft.id);
    expect(result.archiveRecord.platformPackageId).toBe(platformPackage.id);
    expect(result.archiveRecord.sourceCount).toBe(1);
    expect(result.archiveRecord.packageCount).toBe(1);
    expect(result.archiveRecord.status).toBe("archived");
    expect(result.knowledgeItem.id).toBe("knowledge-item_project-topic-ai-local-workstation");
    expect(result.knowledgeItem.archiveRecordId).toBe(result.archiveRecord.id);
    expect(result.knowledgeItem.columnSlug).toBe("ai");
    expect(result.knowledgeItem.tags).toEqual(["ai", "xiaohongshu", "archive"]);
  });

  it("uses source and package evidence in the knowledge item", () => {
    const result = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences,
      now: new Date("2026-05-19T14:00:00.000Z")
    });

    expect(result.archiveRecord.summary).toContain("Turn scattered AI tools into one repeatable daily workflow.");
    expect(result.archiveRecord.summary).toContain("Xiaohongshu package: AI workstation flow.");
    expect(result.knowledgeItem.lesson).toContain("Reusable lesson:");
    expect(result.knowledgeItem.evidence).toContain("1 source reference");
    expect(result.knowledgeItem.evidence).toContain("1 platform package");
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./archive-assistant` and archive types do not exist.

- [ ] **Step 3: Add archive types**

Modify `packages/core/src/types.ts` after `PlatformPackage`:

```ts
export interface ArchiveRecord {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  draftVersionId?: EntityId;
  platformPackageId?: EntityId;
  title: string;
  summary: string;
  sourceCount: number;
  packageCount: number;
  status: "archived";
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: EntityId;
  workspaceId: EntityId;
  archiveRecordId: EntityId;
  contentProjectId: EntityId;
  columnSlug: ContentColumnSlug;
  title: string;
  lesson: string;
  evidence: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Implement deterministic archive generation**

Create `packages/core/src/archive-assistant.ts`:

```ts
import { createEntityId } from "./ids";
import type {
  ArchiveRecord,
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  KnowledgeItem,
  PlatformPackage,
  SourceReference,
  Topic
} from "./types";

interface GenerateMockArchivePackageRequest {
  project: ContentProject;
  topic?: Topic | null;
  draft?: DraftVersion | null;
  platformPackage?: PlatformPackage | null;
  sourceReferences: SourceReference[];
  now?: Date;
}

interface GenerateMockArchivePackageResult {
  archiveRecord: ArchiveRecord;
  knowledgeItem: KnowledgeItem;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function generateMockArchivePackage(
  request: GenerateMockArchivePackageRequest
): GenerateMockArchivePackageResult {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const columnSlug = getColumnSlug(request.project, request.topic);
  const archiveRecord: ArchiveRecord = {
    id: createEntityId("archive-record", request.project.id),
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    ...(request.draft ? { draftVersionId: request.draft.id } : {}),
    ...(request.platformPackage ? { platformPackageId: request.platformPackage.id } : {}),
    title: request.project.title,
    summary: buildArchiveSummary(request),
    sourceCount: request.sourceReferences.length,
    packageCount: request.platformPackage ? 1 : 0,
    status: "archived",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const knowledgeItem: KnowledgeItem = {
    id: createEntityId("knowledge-item", request.project.id),
    workspaceId: request.project.workspaceId,
    archiveRecordId: archiveRecord.id,
    contentProjectId: request.project.id,
    columnSlug,
    title: `${request.project.title} - reusable lesson`,
    lesson: `Reusable lesson: ${request.topic?.hook ?? request.project.title} works best when the draft, source notes, and platform package stay linked.`,
    evidence: `${request.sourceReferences.length} source ${request.sourceReferences.length === 1 ? "reference" : "references"}; ${archiveRecord.packageCount} platform ${archiveRecord.packageCount === 1 ? "package" : "packages"}.`,
    tags: [columnSlug, request.platformPackage?.platform ?? "local", "archive"],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return { archiveRecord, knowledgeItem };
}

function getColumnSlug(project: ContentProject, topic?: Topic | null): ContentColumnSlug {
  if (topic) {
    return topic.columnSlug;
  }

  return project.primaryColumnId.replace(/^column_/, "") as ContentColumnSlug;
}

function buildArchiveSummary(request: GenerateMockArchivePackageRequest): string {
  const lines = [
    request.topic?.hook ?? request.draft?.body.split("\n").find((line) => line.trim().length > 0) ?? request.project.title
  ];

  if (request.draft) {
    lines.push(`Latest draft: ${request.draft.title}.`);
  }

  if (request.platformPackage) {
    lines.push(`${formatPlatform(request.platformPackage.platform)} package: ${request.platformPackage.title}.`);
  }

  lines.push(`${request.sourceReferences.length} source references archived.`);

  return lines.join("\n");
}

function formatPlatform(platform: PlatformPackage["platform"]): string {
  if (platform === "xiaohongshu") {
    return "Xiaohongshu";
  }

  return platform;
}
```

- [ ] **Step 5: Export archive assistant API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./archive-assistant";
export * from "./columns";
export * from "./content-loop";
export * from "./creation-assistant";
export * from "./ids";
export * from "./publish-assistant";
export * from "./topic-assistant";
export * from "./types";
```

- [ ] **Step 6: Run core verification**

Run:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/core run typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/core/src/archive-assistant.test.ts packages/core/src/archive-assistant.ts packages/core/src/types.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add mock archive assistant"
```

## Task 2: Repository State And SQLite Persistence

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/schema.test.ts`
- Modify: `packages/local-store/src/schema.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`

- [ ] **Step 1: Write failing repository and schema tests**

In `packages/local-store/src/content-loop-repository.test.ts`, add to seeded-state assertions:

```ts
    expect(state.archiveRecords).toHaveLength(0);
    expect(state.knowledgeItems).toHaveLength(0);
```

Add tests:

```ts
  it("archives a project and creates a knowledge item in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterArchive = await repository.archiveProject(projectId);

    expect(afterArchive.archiveRecords).toHaveLength(1);
    expect(afterArchive.knowledgeItems).toHaveLength(1);
    expect(afterArchive.projects.find((project) => project.id === projectId)?.status).toBe("archived");
    expect(afterArchive.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory archive and knowledge item for repeated archive generation", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterFirstArchive = await repository.archiveProject(projectId);
    const afterSecondArchive = await repository.archiveProject(projectId);

    expect(afterFirstArchive.archiveRecords).toHaveLength(1);
    expect(afterSecondArchive.archiveRecords).toHaveLength(1);
    expect(afterSecondArchive.archiveRecords[0]?.id).toBe(afterFirstArchive.archiveRecords[0]?.id);
    expect(afterSecondArchive.knowledgeItems[0]?.id).toBe(afterFirstArchive.knowledgeItems[0]?.id);
  });
```

In `packages/local-store/src/schema.test.ts`, add `archive_records` and `knowledge_items` to the table list.

In `packages/local-store/src/sqlite-content-loop-repository.test.ts`, add seeded assertions and tests equivalent to the in-memory tests, plus reload:

```ts
  it("persists archive records and knowledge items across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterArchive = await firstRepository.archiveProject(projectId);
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterArchive.archiveRecords).toHaveLength(1);
    expect(afterArchive.knowledgeItems).toHaveLength(1);
    expect(afterReload).toEqual(afterArchive);
  });

  it("does not insert an archive record for a missing project", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterArchive = await repository.archiveProject("project_missing");
    repository.close();

    expect(afterArchive).toEqual(before);
  });
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because archive state, repository methods, and tables do not exist.

- [ ] **Step 3: Extend local-store state and in-memory repository**

Modify `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  generateMockArchivePackage,
  generateMockDraftPackage,
  generateMockTopics,
  generateMockXiaohongshuPackage
} from "@robert-station/core";
import type {
  ArchiveRecord,
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  KnowledgeItem,
  Platform,
  PlatformPackage,
  SourceReference,
  Topic
} from "@robert-station/core";
```

Add to `PersistedContentLoopState`:

```ts
  archiveRecords: ArchiveRecord[];
  knowledgeItems: KnowledgeItem[];
```

Add to `ContentLoopRepository`:

```ts
  archiveProject(projectId: string): Promise<PersistedContentLoopState>;
```

Seed state with empty arrays.

Add method:

```ts
  async archiveProject(projectId: string): Promise<PersistedContentLoopState> {
    const project = this.state.projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      return cloneState(this.state);
    }

    const topic = project.sourceTopicId
      ? this.state.topics.find((candidate) => candidate.id === project.sourceTopicId) ?? null
      : null;
    const draft = this.state.drafts
      .filter((candidate) => candidate.contentProjectId === projectId)
      .sort((left, right) => right.version - left.version || right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    const platformPackage = this.state.platformPackages
      .filter((candidate) => candidate.contentProjectId === projectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    const sourceReferences = this.state.sourceReferences.filter(
      (source) => source.topicId === project.sourceTopicId || source.contentProjectId === project.id
    );
    const archivePackage = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences,
      now: new Date()
    });

    this.state = {
      ...this.state,
      projects: this.state.projects.map((candidate) =>
        candidate.id === project.id ? { ...candidate, status: "archived", updatedAt: archivePackage.archiveRecord.updatedAt } : candidate
      ),
      archiveRecords: [
        archivePackage.archiveRecord,
        ...this.state.archiveRecords.filter((candidate) => candidate.id !== archivePackage.archiveRecord.id)
      ],
      knowledgeItems: [
        archivePackage.knowledgeItem,
        ...this.state.knowledgeItems.filter((candidate) => candidate.id !== archivePackage.knowledgeItem.id)
      ],
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }
```

- [ ] **Step 4: Add SQLite schema and mappers**

Add tables to `packages/local-store/src/schema.ts` before `assets`:

```sql
CREATE TABLE IF NOT EXISTS archive_records (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  draft_version_id TEXT REFERENCES draft_versions(id),
  platform_package_id TEXT REFERENCES platform_packages(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  package_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'archived',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  archive_record_id TEXT NOT NULL REFERENCES archive_records(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  column_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  lesson TEXT NOT NULL,
  evidence TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

In `packages/local-store/src/sqlite-content-loop-repository.ts`, add row interfaces for archive and knowledge, query them in `loadState`, and return mapped `archiveRecords` and `knowledgeItems`.

- [ ] **Step 5: Implement SQLite archive workflow**

Add `archiveProject(projectId)` to `SqliteContentLoopRepository`:

```ts
  async archiveProject(projectId: string): Promise<PersistedContentLoopState> {
    const project = this.getContentProject(projectId);

    if (!project) {
      return this.loadState();
    }

    const archivePackage = generateMockArchivePackage({
      project,
      topic: project.sourceTopicId ? this.getTopic(project.sourceTopicId) : null,
      draft: this.getLatestDraftForProject(projectId),
      platformPackage: this.getLatestPlatformPackageForProject(projectId),
      sourceReferences: this.getSourceReferencesForProject(project),
      now: this.createPromotionDate()
    });
    const archivedProject: ContentProject = {
      ...project,
      status: "archived",
      updatedAt: archivePackage.archiveRecord.updatedAt
    };

    this.runTransaction(() => {
      this.upsertContentProject(archivedProject);
      this.upsertArchiveRecord(archivePackage.archiveRecord);
      this.upsertKnowledgeItem(archivePackage.knowledgeItem);
    });

    return this.loadState(project.id);
  }
```

Add helper:

```ts
  private getLatestPlatformPackageForProject(projectId: string): PlatformPackage | null {
    const row = this.database
      .prepare(
        `SELECT * FROM platform_packages
         WHERE content_project_id = ?
         ORDER BY updated_at DESC, created_at DESC, id ASC
         LIMIT 1;`
      )
      .get(projectId) as PlatformPackageRow | undefined;

    return row ? mapPlatformPackageRow(row) : null;
  }
```

Add upsert and mapper functions for `ArchiveRecord` and `KnowledgeItem`, storing `tags` as `tags_json`.

Update `createPromotionDate` to include:

```sql
           UNION ALL
           SELECT updated_at FROM archive_records
           UNION ALL
           SELECT updated_at FROM knowledge_items
```

- [ ] **Step 6: Run local-store verification**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/schema.ts packages/local-store/src/schema.test.ts packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist archive knowledge"
```

## Task 3: IPC, Preload, And Loader API

**Files:**

- Modify: `apps/desktop/src/main/ipc-channels.ts`
- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Modify: `apps/desktop/src/renderer/content-loop-service.test.ts`
- Modify: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Write failing desktop API tests**

In `content-loop-loader.test.ts`, import `archivePersistedProject` and add:

```ts
  it("archives projects through preload API", async () => {
    await archivePersistedProject("project_topic-ai-local-workstation");

    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });
```

In `content-loop-service.test.ts`, import `CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL` and add:

```ts
  it("rejects invalid archive project ids before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getArchiveProjectHandler();

    await expect(handler({} as IpcMainInvokeEvent, "")).rejects.toThrow("Invalid content project id.");
    expect(repository.archiveProject).not.toHaveBeenCalled();
  });
```

Add `archiveProject: vi.fn(async () => emptyState)` to `createRepository()`.

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because archive IPC/preload APIs do not exist.

- [ ] **Step 3: Add IPC channel and validation**

Add channel:

```ts
export const CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL = "content-loop:archive-project";
```

In `registerContentLoopIpc`, add:

```ts
  ipcMain.handle(CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL, async (_event, projectId: unknown) => {
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new Error("Invalid content project id.");
    }

    return repository.archiveProject(projectId);
  });
```

- [ ] **Step 4: Add preload, globals, loader, and test setup**

Expose:

```ts
archiveProject: (projectId: string) =>
  ipcRenderer.invoke(CONTENT_LOOP_ARCHIVE_PROJECT_CHANNEL, projectId) as Promise<PersistedContentLoopState>,
```

Add global type:

```ts
archiveProject: (projectId: string) => Promise<PersistedContentLoopState>;
```

Add loader:

```ts
export async function archivePersistedProject(projectId: string): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.archiveProject(projectId);
}
```

Add test setup mock:

```ts
archiveProject: vi.fn(async (projectId: string) => repository.archiveProject(projectId)),
```

- [ ] **Step 5: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/src/main/ipc-channels.ts apps/desktop/src/main/content-loop-service.ts apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/content-loop-service.test.ts apps/desktop/src/renderer/test-setup.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose archive project ipc"
```

## Task 4: Creation Studio Archive UI And Knowledge Screen

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add tests:

```ts
  it("archives the selected project and shows archive status", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));

    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("lists archived knowledge items in the Knowledge screen", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));
    await screen.findByText("Archived");
    fireEvent.click(screen.getByRole("button", { name: "Knowledge" }));

    expect(await screen.findByRole("heading", { name: "Knowledge" })).toBeInTheDocument();
    expect(screen.getByText(/Reusable lesson:/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run UI tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- App.test.tsx
```

Expected: FAIL because the Knowledge nav and Archive action do not exist.

- [ ] **Step 3: Add UI state and handler**

Add `Knowledge` to `workflowStages`.

Import `archivePersistedProject`.

Add state:

```ts
const [isArchivingProject, setIsArchivingProject] = useState(false);
const [archiveError, setArchiveError] = useState<string | null>(null);
```

Add handler:

```ts
async function handleArchiveProject(projectId: string): Promise<void> {
  if (!isMountedRef.current) {
    return;
  }

  setIsArchivingProject(true);
  setArchiveError(null);

  try {
    const nextState = await archivePersistedProject(projectId);
    if (isMountedRef.current) {
      setContentLoop(nextState);
    }
  } catch {
    if (isMountedRef.current) {
      setArchiveError("Could not archive project. Try again.");
    }
  } finally {
    if (isMountedRef.current) {
      setIsArchivingProject(false);
    }
  }
}
```

Compute:

```ts
const selectedArchiveRecord = selectedProject
  ? contentLoop.archiveRecords.find((archiveRecord) => archiveRecord.contentProjectId === selectedProject.id) ?? null
  : null;
```

- [ ] **Step 4: Render archive button, status, and Knowledge screen**

Add action button:

```tsx
<button disabled={isArchivingProject} onClick={() => void handleArchiveProject(selectedProject.id)} type="button">
  {isArchivingProject ? "Archiving..." : "Archive project"}
</button>
```

Add error display:

```tsx
{archiveError ? (
  <p className="inline-error" role="alert">
    {archiveError}
  </p>
) : null}
```

Add status panel in Creation Studio:

```tsx
<section className="archive-status-panel" aria-label="Archive status">
  <h2>Archive</h2>
  {selectedArchiveRecord ? (
    <>
      <strong>Archived</strong>
      <p>{selectedArchiveRecord.summary}</p>
    </>
  ) : (
    <p className="empty-state">Not archived yet.</p>
  )}
</section>
```

Add Knowledge screen:

```tsx
{screen === "Knowledge" ? (
  <section className="knowledge-list" aria-label="Knowledge items">
    {contentLoop.knowledgeItems.length === 0 ? (
      <p className="empty-state">No archived knowledge yet.</p>
    ) : (
      contentLoop.knowledgeItems.map((item) => (
        <article className="knowledge-card" key={item.id}>
          <div className="topic-card__meta">
            <span>{item.columnSlug}</span>
            <span>{item.tags.join(" ")}</span>
          </div>
          <h2>{item.title}</h2>
          <p>{item.lesson}</p>
          <p>{item.evidence}</p>
        </article>
      ))
    )}
  </section>
) : null}
```

- [ ] **Step 5: Add compact styles**

Add:

```css
.archive-status-panel,
.knowledge-card {
  background: #ffffff;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  padding: 18px;
}

.archive-status-panel {
  grid-column: 1 / -1;
}

.knowledge-list {
  display: grid;
  gap: 16px;
}

.knowledge-card h2 {
  font-size: 20px;
  margin: 14px 0 8px;
}

.knowledge-card p,
.archive-status-panel p {
  color: #435064;
  margin: 0;
}
```

- [ ] **Step 6: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/styles.css
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add archive knowledge ui"
```

## Task 5: Full Verification

**Files:**

- No planned source changes unless verification exposes a concrete issue.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: all workspaces pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: all workspaces pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: app builds successfully.

- [ ] **Step 4: Run bundle boundary check**

Run:

```bash
rg -n "@robert-station/local-store|packages/local-store/src|@robert-station/core|packages/core/src" apps/desktop/out/main/main.js
```

Expected: no matches and exit code 1.

- [ ] **Step 5: Run production dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: 0 vulnerabilities.

- [ ] **Step 6: Run whitespace and status checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. `git status --short` should be clean after intended commits.

- [ ] **Step 7: Complete branch workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present branch completion options and follow the user's selected option.
