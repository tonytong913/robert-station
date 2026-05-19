# SQLite Content Loop Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the content loop to a local SQLite database so promoted topics, projects, drafts, and source references survive app restarts.

**Architecture:** Add `SqliteContentLoopRepository` behind the existing `ContentLoopRepository` interface in `@robert-station/local-store`. Keep renderer and preload APIs unchanged; only Electron main process switches from the in-memory repository to the SQLite repository under `app.getPath("userData")`.

**Tech Stack:** TypeScript, Node `node:sqlite` `DatabaseSync`, Electron main process, Vitest, npm workspaces.

---

## Scope

Included:

- SQLite-backed repository implementation.
- Schema initialization using existing `SQLITE_SCHEMA`.
- First-run seed for workspace, columns, topics, and source references.
- Durable topic promotion transaction.
- Electron main process wiring to `app.getPath("userData")`.
- Tests proving persistence across repository instances.

Deferred:

- Full migration version table.
- Server sync.
- encrypted secrets.
- publish package persistence.
- metric import/review persistence.
- asset file storage.

## Target File Structure

```text
packages/
  local-store/
    src/
      content-loop-repository.ts
      sqlite-content-loop-repository.test.ts
      sqlite-content-loop-repository.ts
      index.ts
apps/
  desktop/
    src/
      main/
        content-loop-service.ts
        main.ts
```

## Task 1: SQLite Repository Persistence Tests

**Files:**

- Create: `packages/local-store/src/sqlite-content-loop-repository.test.ts`

- [ ] **Step 1: Write failing SQLite repository tests**

Create `packages/local-store/src/sqlite-content-loop-repository.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteContentLoopRepository } from "./sqlite-content-loop-repository";

describe("SqliteContentLoopRepository", () => {
  let tempDirectory: string;
  let databasePath: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "robert-station-sqlite-"));
    databasePath = path.join(tempDirectory, "content-loop.sqlite");
  });

  afterEach(async () => {
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it("seeds and reloads the content loop from disk", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const firstLoad = await firstRepository.loadContentLoop();
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const secondLoad = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(firstLoad.topics).toHaveLength(4);
    expect(firstLoad.projects).toHaveLength(0);
    expect(firstLoad.drafts).toHaveLength(0);
    expect(secondLoad).toEqual(firstLoad);
  });

  it("persists a promoted topic across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPromote.projects).toHaveLength(1);
    expect(afterPromote.drafts).toHaveLength(1);
    expect(afterPromote.selectedProjectId).toBe("project_topic-ai-local-workstation");
    expect(afterReload).toEqual(afterPromote);
  });

  it("does not duplicate a project when promoting the same topic twice", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    await repository.promoteTopic("topic_ai_local-workstation");
    const afterSecondPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const afterUnknownPromote = await repository.promoteTopic("topic_missing");

    repository.close();

    expect(afterSecondPromote.projects).toHaveLength(1);
    expect(afterSecondPromote.drafts).toHaveLength(1);
    expect(afterUnknownPromote).toEqual(afterSecondPromote);
  });
});
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `./sqlite-content-loop-repository` does not exist.

- [ ] **Step 3: Commit red tests**

Do not commit yet. Keep the red test in the working tree and proceed directly to Task 2.

## Task 2: SQLite Repository Implementation

**Files:**

- Create: `packages/local-store/src/sqlite-content-loop-repository.ts`
- Modify: `packages/local-store/src/index.ts`

- [ ] **Step 1: Implement SQLite repository**

Create `packages/local-store/src/sqlite-content-loop-repository.ts`:

```ts
import { DatabaseSync } from "node:sqlite";
import {
  createContentProjectFromTopic,
  createDefaultWorkspaceSeed,
  createSampleContentLoopSeed
} from "@robert-station/core";
import type {
  ContentColumnSlug,
  ContentProject,
  ContentProjectStatus,
  DraftVersion,
  Platform,
  SourceReference,
  SourceReferenceKind,
  Topic,
  TopicScore,
  TopicStatus
} from "@robert-station/core";
import type { ContentLoopRepository, PersistedContentLoopState } from "./content-loop-repository";
import { getSqliteSchemaStatements } from "./schema";

const WORKSPACE_NAME = "Robert Station";
const WORKSPACE_ID = "workspace_robert-station";

interface SqliteContentLoopRepositoryOptions {
  databasePath: string;
}

interface TopicRow {
  id: string;
  workspace_id: string;
  column_slug: string;
  title: string;
  hook: string;
  audience: string;
  target_platforms_json: string;
  status: string;
  score_json: string;
  created_at: string;
  updated_at: string;
}

interface SourceReferenceRow {
  id: string;
  workspace_id: string;
  topic_id: string | null;
  content_project_id: string | null;
  kind: string;
  title: string;
  url: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

interface ContentProjectRow {
  id: string;
  workspace_id: string;
  primary_column_id: string;
  source_topic_id: string | null;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DraftVersionRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  version: number;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export class SqliteContentLoopRepository implements ContentLoopRepository {
  private constructor(private readonly database: DatabaseSync) {
    this.initialize();
  }

  static open(options: SqliteContentLoopRepositoryOptions): SqliteContentLoopRepository {
    return new SqliteContentLoopRepository(new DatabaseSync(options.databasePath));
  }

  async loadContentLoop(): Promise<PersistedContentLoopState> {
    return this.loadState();
  }

  async promoteTopic(topicId: string): Promise<PersistedContentLoopState> {
    const topic = this.getTopic(topicId);

    if (!topic || topic.status === "promoted") {
      return this.loadState();
    }

    const result = createContentProjectFromTopic(topic, `column_${topic.columnSlug}`);

    try {
      this.database.exec("BEGIN;");
      this.upsertTopic(result.updatedTopic);
      this.upsertContentProject(result.project);
      this.upsertDraftVersion(result.draft);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }

    return this.loadState();
  }

  close(): void {
    this.database.close();
  }

  private initialize(): void {
    this.database.exec("PRAGMA foreign_keys = ON;");

    for (const statement of getSqliteSchemaStatements()) {
      this.database.exec(statement);
    }

    this.seedIfEmpty();
  }

  private seedIfEmpty(): void {
    const existingTopic = this.database.prepare("SELECT id FROM topics LIMIT 1;").get() as { id: string } | undefined;

    if (existingTopic) {
      return;
    }

    const workspaceSeed = createDefaultWorkspaceSeed(WORKSPACE_NAME);
    const contentSeed = createSampleContentLoopSeed(WORKSPACE_ID);

    try {
      this.database.exec("BEGIN;");

      this.database
        .prepare(
          "INSERT OR IGNORE INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);"
        )
        .run(
          workspaceSeed.workspace.id,
          workspaceSeed.workspace.name,
          workspaceSeed.workspace.createdAt,
          workspaceSeed.workspace.updatedAt
        );

      const insertColumn = this.database.prepare(
        "INSERT OR IGNORE INTO columns (id, workspace_id, slug, name, description, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);"
      );

      for (const column of workspaceSeed.columns) {
        insertColumn.run(
          column.id,
          column.workspaceId,
          column.slug,
          column.name,
          column.description,
          column.priority,
          column.createdAt,
          column.updatedAt
        );
      }

      for (const topic of contentSeed.topics) {
        this.upsertTopic(topic);
      }

      for (const sourceReference of contentSeed.sourceReferences) {
        this.upsertSourceReference(sourceReference);
      }

      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  private loadState(): PersistedContentLoopState {
    const topics = this.database
      .prepare("SELECT * FROM topics ORDER BY created_at ASC, id ASC;")
      .all() as TopicRow[];
    const sourceReferences = this.database
      .prepare("SELECT * FROM source_references ORDER BY created_at ASC, id ASC;")
      .all() as SourceReferenceRow[];
    const projects = this.database
      .prepare("SELECT * FROM content_projects ORDER BY created_at DESC, id ASC;")
      .all() as ContentProjectRow[];
    const drafts = this.database
      .prepare("SELECT * FROM draft_versions ORDER BY created_at DESC, version DESC, id ASC;")
      .all() as DraftVersionRow[];
    const selectedProject = this.database
      .prepare("SELECT id FROM content_projects ORDER BY updated_at DESC, created_at DESC, id ASC LIMIT 1;")
      .get() as { id: string } | undefined;

    return {
      topics: topics.map(mapTopicRow),
      sourceReferences: sourceReferences.map(mapSourceReferenceRow),
      projects: projects.map(mapContentProjectRow),
      drafts: drafts.map(mapDraftVersionRow),
      selectedProjectId: selectedProject?.id ?? null
    };
  }

  private getTopic(topicId: string): Topic | null {
    const row = this.database.prepare("SELECT * FROM topics WHERE id = ?;").get(topicId) as TopicRow | undefined;
    return row ? mapTopicRow(row) : null;
  }

  private upsertTopic(topic: Topic): void {
    this.database
      .prepare(
        "INSERT OR REPLACE INTO topics (id, workspace_id, column_slug, title, hook, audience, target_platforms_json, status, score_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"
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

  private upsertSourceReference(sourceReference: SourceReference): void {
    this.database
      .prepare(
        "INSERT OR REPLACE INTO source_references (id, workspace_id, topic_id, content_project_id, kind, title, url, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"
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

  private upsertContentProject(project: ContentProject): void {
    this.database
      .prepare(
        "INSERT OR REPLACE INTO content_projects (id, workspace_id, primary_column_id, source_topic_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);"
      )
      .run(
        project.id,
        project.workspaceId,
        project.primaryColumnId,
        project.sourceTopicId ?? null,
        project.title,
        project.status,
        project.createdAt,
        project.updatedAt
      );
  }

  private upsertDraftVersion(draft: DraftVersion): void {
    this.database
      .prepare(
        "INSERT OR REPLACE INTO draft_versions (id, workspace_id, content_project_id, version, title, body, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);"
      )
      .run(
        draft.id,
        draft.workspaceId,
        draft.contentProjectId,
        draft.version,
        draft.title,
        draft.body,
        draft.createdBy,
        draft.createdAt,
        draft.updatedAt
      );
  }
}

function mapTopicRow(row: TopicRow): Topic {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    columnSlug: row.column_slug as ContentColumnSlug,
    title: row.title,
    hook: row.hook,
    audience: row.audience,
    targetPlatforms: JSON.parse(row.target_platforms_json) as Platform[],
    status: row.status as TopicStatus,
    score: JSON.parse(row.score_json) as TopicScore,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSourceReferenceRow(row: SourceReferenceRow): SourceReference {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    topicId: row.topic_id ?? undefined,
    contentProjectId: row.content_project_id ?? undefined,
    kind: row.kind as SourceReferenceKind,
    title: row.title,
    url: row.url ?? undefined,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapContentProjectRow(row: ContentProjectRow): ContentProject {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    primaryColumnId: row.primary_column_id,
    sourceTopicId: row.source_topic_id ?? undefined,
    title: row.title,
    status: row.status as ContentProjectStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDraftVersionRow(row: DraftVersionRow): DraftVersion {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    version: row.version,
    title: row.title,
    body: row.body,
    createdBy: row.created_by as "assistant" | "human",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

- [ ] **Step 2: Export SQLite repository**

Modify `packages/local-store/src/index.ts`:

```ts
export * from "./content-loop-repository";
export * from "./file-repository";
export * from "./schema";
export * from "./sqlite-content-loop-repository";
```

- [ ] **Step 3: Run tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both pass. Node may print an experimental SQLite warning; that is acceptable for this slice.

- [ ] **Step 4: Commit SQLite repository**

Run:

```bash
git add packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts packages/local-store/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add sqlite content loop repository"
```

## Task 3: Electron Main Process Wiring

**Files:**

- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/main/main.ts`

- [ ] **Step 1: Make IPC registration accept a repository**

Modify `apps/desktop/src/main/content-loop-service.ts`:

```ts
import { ipcMain } from "electron";
import type { ContentLoopRepository } from "@robert-station/local-store";
import {
  CONTENT_LOOP_LOAD_CHANNEL,
  CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL
} from "./ipc-channels";

export function registerContentLoopIpc(repository: ContentLoopRepository): void {
  ipcMain.handle(CONTENT_LOOP_LOAD_CHANNEL, async () => repository.loadContentLoop());
  ipcMain.handle(CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL, async (_event, topicId: string) =>
    repository.promoteTopic(topicId)
  );
}
```

- [ ] **Step 2: Create SQLite repository from Electron userData**

Modify `apps/desktop/src/main/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import { SqliteContentLoopRepository } from "@robert-station/local-store";
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
  const repository = SqliteContentLoopRepository.open({
    databasePath: path.join(app.getPath("userData"), "robert-station.sqlite")
  });

  registerContentLoopIpc(repository);
  createMainWindow();

  app.on("before-quit", () => {
    repository.close();
  });

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

- [ ] **Step 3: Run desktop typecheck and build**

Run:

```bash
npm --workspace @robert-station/desktop run typecheck
npm --workspace @robert-station/desktop run build
```

Expected: both pass.

- [ ] **Step 4: Commit Electron wiring**

Run:

```bash
git add apps/desktop/src/main/content-loop-service.ts apps/desktop/src/main/main.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist desktop content loop in sqlite"
```

## Task 4: Final Verification

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

- [ ] **Step 4: Run production dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: `found 0 vulnerabilities`.

- [ ] **Step 5: Run Git checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and clean working tree.

## Self-Review Notes

- Spec coverage: this plan implements the SQLite repository, first-run seed, durable promote transaction, and Electron userData wiring from the design.
- Out of scope: server sync, AI calls, publish packages, metrics, reviews, and asset storage remain deferred.
- Type consistency: the new repository implements the existing `ContentLoopRepository` and returns the existing `PersistedContentLoopState`.
