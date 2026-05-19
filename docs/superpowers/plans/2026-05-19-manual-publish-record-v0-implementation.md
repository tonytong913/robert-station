# Manual Publish Record V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual publish-record workflow so a generated Xiaohongshu package can be marked as published with time, URL, and note.

**Architecture:** Add `PublishRecord` and `ManualPublishInput` in `@robert-station/core`, extend local-store state and SQLite persistence with `publish_records`, expose `recordManualPublish(input)` through Electron IPC/preload, and add a compact publish-record form in Creation Studio.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- `PublishRecord` and `ManualPublishInput` domain types.
- Deterministic manual publish record generation from a platform package.
- In-memory and SQLite publish record persistence.
- IPC/preload/renderer loader API.
- Creation Studio form for saving a manual publish record.

Deferred:

- automatic posting.
- platform login or browser automation.
- metric snapshots and CSV/Excel data import.
- multiple publish records for one package.
- publish scheduling.

## Target File Structure

```text
packages/
  core/
    src/
      manual-publish.test.ts
      manual-publish.ts
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

## Task 1: Core Manual Publish

**Files:**

- Create: `packages/core/src/manual-publish.test.ts`
- Create: `packages/core/src/manual-publish.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing manual publish tests**

Create `packages/core/src/manual-publish.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createManualPublishRecord } from "./manual-publish";
import type { ManualPublishInput, PlatformPackage } from "./types";

const platformPackage: PlatformPackage = {
  id: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
  workspaceId: "workspace_robert-station",
  contentProjectId: "project_topic-ai-local-workstation",
  draftVersionId: "draft_project-topic-ai-local-workstation-2",
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

describe("createManualPublishRecord", () => {
  it("creates a deterministic publish record from a platform package and manual input", () => {
    const input: ManualPublishInput = {
      platformPackageId: platformPackage.id,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "Published after final title edit."
    };

    const publishRecord = createManualPublishRecord({
      platformPackage,
      input,
      now: new Date("2026-05-19T15:01:00.000Z")
    });

    expect(publishRecord.id).toBe(
      "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu"
    );
    expect(publishRecord.workspaceId).toBe(platformPackage.workspaceId);
    expect(publishRecord.contentProjectId).toBe(platformPackage.contentProjectId);
    expect(publishRecord.platformPackageId).toBe(platformPackage.id);
    expect(publishRecord.platform).toBe("xiaohongshu");
    expect(publishRecord.status).toBe("published");
    expect(publishRecord.publishedAt).toBe(input.publishedAt);
    expect(publishRecord.url).toBe(input.url);
    expect(publishRecord.note).toBe(input.note);
    expect(publishRecord.createdAt).toBe("2026-05-19T15:01:00.000Z");
  });

  it("defaults optional url and note to empty strings", () => {
    const publishRecord = createManualPublishRecord({
      platformPackage,
      input: {
        platformPackageId: platformPackage.id,
        publishedAt: "2026-05-19T15:00:00.000Z"
      },
      now: new Date("2026-05-19T15:01:00.000Z")
    });

    expect(publishRecord.url).toBe("");
    expect(publishRecord.note).toBe("");
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./manual-publish` and publish record types do not exist.

- [ ] **Step 3: Add manual publish types**

Modify `packages/core/src/types.ts` after `PlatformPackage`:

```ts
export interface PublishRecord {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  platformPackageId: EntityId;
  platform: Platform;
  status: "published";
  publishedAt: string;
  url: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPublishInput {
  platformPackageId: EntityId;
  publishedAt: string;
  url?: string;
  note?: string;
}
```

- [ ] **Step 4: Implement manual publish record generation**

Create `packages/core/src/manual-publish.ts`:

```ts
import { createEntityId } from "./ids";
import type { ManualPublishInput, PlatformPackage, PublishRecord } from "./types";

interface CreateManualPublishRecordRequest {
  platformPackage: PlatformPackage;
  input: ManualPublishInput;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function createManualPublishRecord(request: CreateManualPublishRecordRequest): PublishRecord {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();

  return {
    id: createEntityId("publish-record", request.platformPackage.id),
    workspaceId: request.platformPackage.workspaceId,
    contentProjectId: request.platformPackage.contentProjectId,
    platformPackageId: request.platformPackage.id,
    platform: request.platformPackage.platform,
    status: "published",
    publishedAt: request.input.publishedAt,
    url: request.input.url ?? "",
    note: request.input.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
```

- [ ] **Step 5: Export manual publish API**

Modify `packages/core/src/index.ts`:

```ts
export * from "./archive-assistant";
export * from "./columns";
export * from "./content-loop";
export * from "./creation-assistant";
export * from "./ids";
export * from "./manual-publish";
export * from "./publish-assistant";
export * from "./topic-assistant";
export * from "./types";
```

- [ ] **Step 6: Run core verification**

Run:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/core run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/core/src/manual-publish.test.ts packages/core/src/manual-publish.ts packages/core/src/types.ts packages/core/src/index.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add manual publish record core"
```

## Task 2: Local-Store And SQLite Persistence

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/schema.test.ts`
- Modify: `packages/local-store/src/schema.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`

- [ ] **Step 1: Write failing local-store tests**

In `packages/local-store/src/content-loop-repository.test.ts`, add seeded assertion:

```ts
    expect(state.publishRecords).toHaveLength(0);
```

Add tests:

```ts
  it("records a manual publish in memory and marks the project as published", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "Published manually."
    });

    expect(afterPublish.publishRecords).toHaveLength(1);
    expect(afterPublish.publishRecords[0]?.platformPackageId).toBe(packageId);
    expect(afterPublish.projects.find((project) => project.id === projectId)?.status).toBe("published");
    expect(afterPublish.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory publish record and preserves createdAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterFirstPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/first"
    });
    const afterSecondPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T16:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/second"
    });

    expect(afterSecondPublish.publishRecords).toHaveLength(1);
    expect(afterSecondPublish.publishRecords[0]?.id).toBe(afterFirstPublish.publishRecords[0]?.id);
    expect(afterSecondPublish.publishRecords[0]?.createdAt).toBe(afterFirstPublish.publishRecords[0]?.createdAt);
    expect(afterSecondPublish.publishRecords[0]?.url).toBe("https://www.xiaohongshu.com/explore/second");
  });
```

In `schema.test.ts`, add `publish_records` to the core table list.

In `sqlite-content-loop-repository.test.ts`, add seeded assertion and schema table expectation, plus:

```ts
  it("persists manual publish records across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    const afterPackage = await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterPublish = await firstRepository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo"
    });
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPublish.publishRecords).toHaveLength(1);
    expect(afterReload).toEqual(afterPublish);
  });

  it("does not insert a manual publish record for a missing package", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterPublish = await repository.recordManualPublish({
      platformPackageId: "platform-package_missing",
      publishedAt: "2026-05-19T15:00:00.000Z"
    });
    repository.close();

    expect(afterPublish).toEqual(before);
  });
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because publish record state, method, and table do not exist.

- [ ] **Step 3: Extend repository state and in-memory workflow**

Modify imports in `content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createManualPublishRecord,
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
  ManualPublishInput,
  Platform,
  PlatformPackage,
  PublishRecord,
  SourceReference,
  Topic
} from "@robert-station/core";
```

Add to `PersistedContentLoopState`:

```ts
  publishRecords: PublishRecord[];
```

Add to `ContentLoopRepository`:

```ts
  recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState>;
```

Seed `publishRecords: []`.

Add method:

```ts
  async recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState> {
    const platformPackage = this.state.platformPackages.find((candidate) => candidate.id === input.platformPackageId);

    if (!platformPackage) {
      return cloneState(this.state);
    }

    const publishRecord = createManualPublishRecord({
      platformPackage,
      input,
      now: new Date()
    });
    const existing = this.state.publishRecords.find((candidate) => candidate.id === publishRecord.id);
    const persistedPublishRecord = {
      ...publishRecord,
      createdAt: existing?.createdAt ?? publishRecord.createdAt
    };

    this.state = {
      ...this.state,
      projects: this.state.projects.map((project) =>
        project.id === platformPackage.contentProjectId
          ? { ...project, status: "published", updatedAt: persistedPublishRecord.updatedAt }
          : project
      ),
      publishRecords: [
        persistedPublishRecord,
        ...this.state.publishRecords.filter((candidate) => candidate.id !== persistedPublishRecord.id)
      ],
      selectedProjectId: platformPackage.contentProjectId
    };

    return cloneState(this.state);
  }
```

- [ ] **Step 4: Add SQLite table and mappers**

Add `publish_records` to `schema.ts` before `archive_records`:

```sql
CREATE TABLE IF NOT EXISTS publish_records (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  platform_package_id TEXT NOT NULL REFERENCES platform_packages(id),
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

In `sqlite-content-loop-repository.ts`:

- import `createManualPublishRecord`;
- add `ManualPublishInput`, `PublishRecord` type imports;
- add `PublishRecordRow`;
- query `publish_records` in `loadState`:

```ts
    const publishRecords = this.database
      .prepare("SELECT * FROM publish_records ORDER BY published_at DESC, updated_at DESC, id ASC;")
      .all() as unknown as PublishRecordRow[];
```

- return `publishRecords: publishRecords.map(mapPublishRecordRow)`;
- include `SELECT updated_at FROM publish_records` in `createPromotionDate`.

Add `getPlatformPackage(packageId)`:

```ts
  private getPlatformPackage(packageId: string): PlatformPackage | null {
    const row = this.database
      .prepare("SELECT * FROM platform_packages WHERE id = ?;")
      .get(packageId) as PlatformPackageRow | undefined;

    return row ? mapPlatformPackageRow(row) : null;
  }
```

Add mapper:

```ts
function mapPublishRecordRow(row: PublishRecordRow): PublishRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    platformPackageId: row.platform_package_id,
    platform: row.platform as Platform,
    status: row.status as PublishRecord["status"],
    publishedAt: row.published_at,
    url: row.url,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

- [ ] **Step 5: Implement SQLite manual publish workflow**

Add method:

```ts
  async recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState> {
    const platformPackage = this.getPlatformPackage(input.platformPackageId);

    if (!platformPackage) {
      return this.loadState();
    }

    const publishRecord = createManualPublishRecord({
      platformPackage,
      input,
      now: this.createPromotionDate()
    });
    const project = this.getContentProject(platformPackage.contentProjectId);
    const publishedProject: ContentProject | null = project
      ? { ...project, status: "published", updatedAt: publishRecord.updatedAt }
      : null;

    this.runTransaction(() => {
      if (publishedProject) {
        this.upsertContentProject(publishedProject);
      }
      this.upsertPublishRecord(publishRecord);
    });

    return this.loadState(platformPackage.contentProjectId);
  }
```

Add upsert:

```ts
  private upsertPublishRecord(publishRecord: PublishRecord): void {
    this.database
      .prepare(
        `INSERT INTO publish_records (
          id, workspace_id, content_project_id, platform_package_id, platform, status,
          published_at, url, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          platform_package_id = excluded.platform_package_id,
          platform = excluded.platform,
          status = excluded.status,
          published_at = excluded.published_at,
          url = excluded.url,
          note = excluded.note,
          updated_at = excluded.updated_at;`
      )
      .run(
        publishRecord.id,
        publishRecord.workspaceId,
        publishRecord.contentProjectId,
        publishRecord.platformPackageId,
        publishRecord.platform,
        publishRecord.status,
        publishRecord.publishedAt,
        publishRecord.url,
        publishRecord.note,
        publishRecord.createdAt,
        publishRecord.updatedAt
      );
  }
```

- [ ] **Step 6: Run local-store verification**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/schema.ts packages/local-store/src/schema.test.ts packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist manual publish records"
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

In `content-loop-loader.test.ts`, import `recordPersistedManualPublish` and add:

```ts
  it("records manual publishes through preload API", async () => {
    const input = {
      platformPackageId: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu",
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo"
    };

    await recordPersistedManualPublish(input);

    expect(window.robertStation.contentLoop.recordManualPublish).toHaveBeenCalledWith(input);
  });
```

In `content-loop-service.test.ts`, add channel import and invalid payload tests:

```ts
  it("rejects invalid manual publish inputs before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getRecordManualPublishHandler();

    await expect(handler({} as IpcMainInvokeEvent, { platformPackageId: "", publishedAt: "" })).rejects.toThrow(
      "Invalid manual publish input."
    );
    expect(repository.recordManualPublish).not.toHaveBeenCalled();
  });
```

Update `emptyState` with `publishRecords: []` and `createRepository()` with `recordManualPublish`.

Add helper:

```ts
function getRecordManualPublishHandler(): (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL);

  if (!handleCall) {
    throw new Error("Record manual publish IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>;
}
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because manual publish preload/IPC APIs do not exist.

- [ ] **Step 3: Add IPC channel and validation**

Add channel:

```ts
export const CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL = "content-loop:record-manual-publish";
```

In `content-loop-service.ts`, import `type ManualPublishInput` and add:

```ts
  ipcMain.handle(CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL, async (_event, input: unknown) => {
    if (!isManualPublishInput(input)) {
      throw new Error("Invalid manual publish input.");
    }

    return repository.recordManualPublish(input);
  });
```

Add helper:

```ts
function isManualPublishInput(value: unknown): value is ManualPublishInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Partial<ManualPublishInput>;
  return (
    typeof input.platformPackageId === "string" &&
    input.platformPackageId.length > 0 &&
    typeof input.publishedAt === "string" &&
    input.publishedAt.length > 0 &&
    (input.url === undefined || typeof input.url === "string") &&
    (input.note === undefined || typeof input.note === "string")
  );
}
```

- [ ] **Step 4: Add preload, globals, loader, and test setup**

Expose:

```ts
recordManualPublish: (input: ManualPublishInput) =>
  ipcRenderer.invoke(CONTENT_LOOP_RECORD_MANUAL_PUBLISH_CHANNEL, input) as Promise<PersistedContentLoopState>,
```

Add global type:

```ts
recordManualPublish: (input: ManualPublishInput) => Promise<PersistedContentLoopState>;
```

Add loader:

```ts
export async function recordPersistedManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.recordManualPublish(input);
}
```

Add test setup mock:

```ts
recordManualPublish: vi.fn(async (input: ManualPublishInput) => repository.recordManualPublish(input)),
```

- [ ] **Step 5: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
npm run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/src/main/ipc-channels.ts apps/desktop/src/main/content-loop-service.ts apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/content-loop-service.test.ts apps/desktop/src/renderer/test-setup.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose manual publish ipc"
```

## Task 4: Creation Studio Publish Record UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

Add tests:

```ts
  it("saves a manual publish record for the Xiaohongshu package", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
    await screen.findByRole("heading", { name: "Xiaohongshu Package" });
    fireEvent.change(screen.getByLabelText("Publish URL"), {
      target: { value: "https://www.xiaohongshu.com/explore/demo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getByText("https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.recordManualPublish).toHaveBeenCalled();
  });

  it("shows an inline error and keeps package content when manual publish save fails", async () => {
    window.robertStation.contentLoop.recordManualPublish = vi.fn(async () => {
      throw new Error("publish failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
    await screen.findByRole("heading", { name: "Xiaohongshu Package" });
    fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

    expect(await screen.findByText("Could not save publish record. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Xiaohongshu Package" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run UI tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- App.test.tsx
```

Expected: FAIL because the publish record form does not exist.

- [ ] **Step 3: Add UI state and handler**

Import `recordPersistedManualPublish`.

Add state:

```ts
const [publishUrl, setPublishUrl] = useState("");
const [publishNote, setPublishNote] = useState("");
const [isSavingPublishRecord, setIsSavingPublishRecord] = useState(false);
const [publishRecordError, setPublishRecordError] = useState<string | null>(null);
```

Compute selected record:

```ts
const selectedPublishRecord = selectedXiaohongshuPackage
  ? contentLoop.publishRecords.find((record) => record.platformPackageId === selectedXiaohongshuPackage.id) ?? null
  : null;
```

Add handler:

```ts
async function handleRecordManualPublish(platformPackageId: string): Promise<void> {
  if (!isMountedRef.current) {
    return;
  }

  setIsSavingPublishRecord(true);
  setPublishRecordError(null);

  try {
    const nextState = await recordPersistedManualPublish({
      platformPackageId,
      publishedAt: new Date().toISOString(),
      url: publishUrl,
      note: publishNote
    });
    if (isMountedRef.current) {
      setContentLoop(nextState);
    }
  } catch {
    if (isMountedRef.current) {
      setPublishRecordError("Could not save publish record. Try again.");
    }
  } finally {
    if (isMountedRef.current) {
      setIsSavingPublishRecord(false);
    }
  }
}
```

- [ ] **Step 4: Render publish record form**

Inside the selected Xiaohongshu package branch, add:

```tsx
<section className="manual-publish-panel" aria-label="Manual publish record">
  <h3>Manual publish</h3>
  <label>
    <span>Publish URL</span>
    <input
      aria-label="Publish URL"
      onChange={(event) => setPublishUrl(event.target.value)}
      type="url"
      value={publishUrl}
    />
  </label>
  <label>
    <span>Publish note</span>
    <input
      aria-label="Publish note"
      onChange={(event) => setPublishNote(event.target.value)}
      type="text"
      value={publishNote}
    />
  </label>
  <button
    disabled={isSavingPublishRecord}
    onClick={() => void handleRecordManualPublish(selectedXiaohongshuPackage.id)}
    type="button"
  >
    {isSavingPublishRecord ? "Saving..." : "Save publish record"}
  </button>
  {publishRecordError ? (
    <p className="inline-error" role="alert">
      {publishRecordError}
    </p>
  ) : null}
  {selectedPublishRecord ? (
    <div className="publish-record-summary">
      <strong>Published</strong>
      <p>{selectedPublishRecord.publishedAt}</p>
      <p>{selectedPublishRecord.url || "No URL recorded"}</p>
    </div>
  ) : null}
</section>
```

- [ ] **Step 5: Add compact styles**

Add:

```css
.manual-publish-panel {
  border-top: 1px solid #dbe3ea;
  display: grid;
  gap: 10px;
  padding-top: 14px;
}

.manual-publish-panel label {
  color: #475569;
  display: grid;
  font-size: 0.82rem;
  font-weight: 700;
  gap: 6px;
}

.manual-publish-panel input {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #172026;
  font: inherit;
  min-width: 0;
  padding: 9px 10px;
}

.publish-record-summary {
  background: #f8fafc;
  border-radius: 6px;
  display: grid;
  gap: 6px;
  padding: 10px;
}
```

- [ ] **Step 6: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/styles.css
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add manual publish record ui"
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
