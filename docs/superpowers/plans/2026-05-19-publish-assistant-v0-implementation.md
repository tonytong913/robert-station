# Publish Assistant V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic Xiaohongshu publishing-package workflow for selected projects with saved copy-ready platform material.

**Architecture:** Add publish package types and a mock generator in `@robert-station/core`, extend `ContentLoopRepository` state and workflows, persist `platform_packages` in SQLite, expose generation through Electron IPC/preload, and render the newest Xiaohongshu package in Creation Studio.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Node `node:sqlite`, Vitest, React Testing Library, npm workspaces.

---

## Scope

Included:

- `PlatformPackage` and `PlatformPackageCheck` domain types.
- Deterministic Xiaohongshu package generation from the latest project draft.
- In-memory and SQLite repository support.
- IPC/preload/renderer loader support.
- Creation Studio action and package display.

Deferred:

- automatic posting.
- publish URL capture.
- metrics ingestion.
- real model calls.
- asset file generation.
- other platform package generators.

## Target File Structure

```text
packages/
  core/
    src/
      publish-assistant.test.ts
      publish-assistant.ts
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

## Task 1: Core Publish Assistant

**Files:**

- Create: `packages/core/src/publish-assistant.test.ts`
- Create: `packages/core/src/publish-assistant.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing publish assistant tests**

Create `packages/core/src/publish-assistant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateMockXiaohongshuPackage } from "./publish-assistant";
import type { ContentProject, DraftVersion } from "./types";

const project: ContentProject = {
  id: "project_topic-ai-local-workstation",
  workspaceId: "workspace_robert-station",
  primaryColumnId: "column_ai",
  sourceTopicId: "topic_ai_local-workstation",
  title: "How to build a personal AI workstation for daily content work",
  status: "drafting",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
};

const draft: DraftVersion = {
  id: "draft_project-topic-ai-local-workstation-2",
  workspaceId: "workspace_robert-station",
  contentProjectId: project.id,
  version: 2,
  title: "How to build a personal AI workstation for daily content work",
  body: [
    "Brief",
    "Audience: Creators who want practical AI productivity gains.",
    "",
    "Body Draft",
    "Turn scattered AI tools into one repeatable daily workflow.",
    "",
    "Cover Copy",
    "Make the workflow visible",
    "",
    "Tag Suggestions",
    "#ai",
    "#workflow",
    "#content-ops"
  ].join("\n"),
  createdBy: "assistant",
  createdAt: "2026-05-19T12:00:00.000Z",
  updatedAt: "2026-05-19T12:00:00.000Z"
};

describe("generateMockXiaohongshuPackage", () => {
  it("generates a deterministic copy-ready package from a project and draft", () => {
    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft,
      now: new Date("2026-05-19T13:00:00.000Z")
    });

    expect(platformPackage.id).toBe(
      "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-2-xiaohongshu"
    );
    expect(platformPackage.platform).toBe("xiaohongshu");
    expect(platformPackage.contentProjectId).toBe(project.id);
    expect(platformPackage.draftVersionId).toBe(draft.id);
    expect(platformPackage.title.length).toBeLessThanOrEqual(20);
    expect(platformPackage.body).toContain("Turn scattered AI tools into one repeatable daily workflow.");
    expect(platformPackage.tags).toEqual(["#ai", "#workflow", "#content-ops"]);
    expect(platformPackage.coverText).toBe("Make the workflow visible");
    expect(platformPackage.requiredAssets).toEqual(["Cover image", "1-3 supporting screenshots or workflow visuals"]);
    expect(platformPackage.checks.map((check) => check.name)).toEqual([
      "Title length",
      "Body",
      "Tags",
      "Assets"
    ]);
    expect(platformPackage.createdAt).toBe("2026-05-19T13:00:00.000Z");
  });

  it("adds warning checks when v0 constraints are exceeded", () => {
    const noisyDraft: DraftVersion = {
      ...draft,
      title: "A very long title that needs trimming before Xiaohongshu publishing",
      body: [
        "Body Draft",
        "Short body.",
        "",
        "Tag Suggestions",
        "#one",
        "#two",
        "#three",
        "#four",
        "#five",
        "#six",
        "#seven",
        "#eight",
        "#nine"
      ].join("\n")
    };

    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft: noisyDraft,
      now: new Date("2026-05-19T13:00:00.000Z")
    });

    expect(platformPackage.checks).toContainEqual({
      name: "Tags",
      status: "warning",
      message: "Use 8 or fewer tags for the v0 Xiaohongshu package."
    });
  });
});
```

- [ ] **Step 2: Run core tests to verify red state**

Run:

```bash
npm --workspace @robert-station/core test
```

Expected: FAIL because `./publish-assistant` and publish package types do not exist.

- [ ] **Step 3: Add publish package types**

Modify `packages/core/src/types.ts` by adding these exports after `DraftVersion`:

```ts
export interface PlatformPackageCheck {
  name: string;
  status: "pass" | "warning";
  message: string;
}

export interface PlatformPackage {
  id: EntityId;
  workspaceId: EntityId;
  contentProjectId: EntityId;
  draftVersionId: EntityId;
  platform: Platform;
  title: string;
  body: string;
  tags: string[];
  coverText: string;
  requiredAssets: string[];
  checks: PlatformPackageCheck[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Implement the deterministic Xiaohongshu generator**

Create `packages/core/src/publish-assistant.ts`:

```ts
import { createEntityId } from "./ids";
import type { ContentProject, DraftVersion, PlatformPackage, PlatformPackageCheck } from "./types";

interface GenerateMockXiaohongshuPackageRequest {
  project: ContentProject;
  draft: DraftVersion;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");
const MAX_TITLE_LENGTH = 20;
const MAX_TAG_COUNT = 8;

export function generateMockXiaohongshuPackage(request: GenerateMockXiaohongshuPackageRequest): PlatformPackage {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const title = shortenTitle(request.draft.title || request.project.title);
  const body = extractBody(request.draft.body);
  const tags = extractTags(request.draft.body, request.project.primaryColumnId);
  const coverText = extractCoverText(request.draft.body, title);
  const requiredAssets = ["Cover image", "1-3 supporting screenshots or workflow visuals"];

  return {
    id: createEntityId("platform-package", `${request.project.id}-${request.draft.id}-xiaohongshu`),
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    draftVersionId: request.draft.id,
    platform: "xiaohongshu",
    title,
    body,
    tags,
    coverText,
    requiredAssets,
    checks: buildChecks({ title, body, tags, requiredAssets }),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function shortenTitle(title: string): string {
  const compact = title.trim().replace(/\s+/g, " ");
  return compact.length <= MAX_TITLE_LENGTH ? compact : compact.slice(0, MAX_TITLE_LENGTH);
}

function extractBody(draftBody: string): string {
  const lines = draftBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const bodyStart = lines.findIndex((line) => line === "Body Draft");
  const nextSection = bodyStart >= 0 ? lines.findIndex((line, index) => index > bodyStart && /^[A-Z][A-Za-z ]+$/.test(line)) : -1;
  const bodyLines =
    bodyStart >= 0
      ? lines.slice(bodyStart + 1, nextSection > bodyStart ? nextSection : undefined)
      : lines.filter((line) => !line.startsWith("#"));

  return bodyLines.length > 0 ? bodyLines.join("\n") : "Share the practical workflow, key steps, and one action readers can try today.";
}

function extractTags(draftBody: string, primaryColumnId: string): string[] {
  const rawTags = draftBody
    .split(/\s+/)
    .map((part) => part.trim().replace(/[,.，。;；]+$/g, ""))
    .filter((part) => /^#[A-Za-z0-9_-]+$/.test(part));
  const fallbackTag = `#${primaryColumnId.replace(/^column_/, "") || "workflow"}`;
  const uniqueTags = Array.from(new Set(rawTags.length > 0 ? rawTags : [fallbackTag, "#workflow", "#content-ops"]));

  return uniqueTags;
}

function extractCoverText(draftBody: string, title: string): string {
  const lines = draftBody.split("\n").map((line) => line.trim());
  const coverIndex = lines.findIndex((line) => line === "Cover Copy");
  const coverLine = coverIndex >= 0 ? lines.slice(coverIndex + 1).find((line) => line.length > 0) : null;
  const coverText = coverLine ?? title;

  return coverText.length <= 24 ? coverText : coverText.slice(0, 24);
}

function buildChecks(input: {
  title: string;
  body: string;
  tags: string[];
  requiredAssets: string[];
}): PlatformPackageCheck[] {
  return [
    {
      name: "Title length",
      status: input.title.length <= MAX_TITLE_LENGTH ? "pass" : "warning",
      message:
        input.title.length <= MAX_TITLE_LENGTH
          ? "Title fits the v0 Xiaohongshu length target."
          : "Shorten the title to 20 characters or fewer."
    },
    {
      name: "Body",
      status: input.body.length > 0 ? "pass" : "warning",
      message: input.body.length > 0 ? "Body copy is present." : "Add body copy before publishing."
    },
    {
      name: "Tags",
      status: input.tags.length <= MAX_TAG_COUNT ? "pass" : "warning",
      message:
        input.tags.length <= MAX_TAG_COUNT
          ? "Tag count fits the v0 Xiaohongshu package."
          : "Use 8 or fewer tags for the v0 Xiaohongshu package."
    },
    {
      name: "Assets",
      status: input.requiredAssets.length > 0 ? "pass" : "warning",
      message: input.requiredAssets.length > 0 ? "Asset checklist is present." : "Add at least one required asset."
    }
  ];
}
```

- [ ] **Step 5: Export the publish assistant API**

Modify `packages/core/src/index.ts`:

```ts
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
git add packages/core/src/types.ts packages/core/src/index.ts packages/core/src/publish-assistant.ts packages/core/src/publish-assistant.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add mock publish assistant"
```

## Task 2: Repository State And In-Memory Workflow

**Files:**

- Modify: `packages/local-store/src/content-loop-repository.test.ts`
- Modify: `packages/local-store/src/content-loop-repository.ts`

- [ ] **Step 1: Write failing in-memory repository tests**

Add these tests to `packages/local-store/src/content-loop-repository.test.ts`:

```ts
  it("generates a Xiaohongshu platform package in memory for the latest draft", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterDraft = await repository.generateDraftPackage(projectId);
    const latestDraft = afterDraft.drafts.find((draft) => draft.contentProjectId === projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");

    expect(afterPackage.platformPackages).toHaveLength(1);
    expect(afterPackage.platformPackages[0]?.platform).toBe("xiaohongshu");
    expect(afterPackage.platformPackages[0]?.contentProjectId).toBe(projectId);
    expect(afterPackage.platformPackages[0]?.draftVersionId).toBe(latestDraft?.id);
    expect(afterPackage.platformPackages[0]?.tags).toContain("#ai");
    expect(afterPackage.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory platform package for repeated generation on the same draft", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterFirstPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterSecondPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");

    expect(afterFirstPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages[0]?.id).toBe(afterFirstPackage.platformPackages[0]?.id);
  });

  it("does not insert a platform package when the project is missing", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const afterGenerate = await repository.generatePlatformPackage("project_missing", "xiaohongshu");

    expect(afterGenerate).toEqual(before);
  });
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `platformPackages` and `generatePlatformPackage` do not exist.

- [ ] **Step 3: Extend repository state and interface**

Modify imports and interfaces in `packages/local-store/src/content-loop-repository.ts`:

```ts
import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  generateMockDraftPackage,
  generateMockTopics,
  generateMockXiaohongshuPackage
} from "@robert-station/core";
import type { ContentColumnSlug, ContentProject, DraftVersion, Platform, PlatformPackage, SourceReference, Topic } from "@robert-station/core";
```

Update `PersistedContentLoopState` and `ContentLoopRepository`:

```ts
export interface PersistedContentLoopState {
  topics: Topic[];
  sourceReferences: SourceReference[];
  projects: ContentProject[];
  drafts: DraftVersion[];
  platformPackages: PlatformPackage[];
  selectedProjectId: string | null;
}

export interface ContentLoopRepository {
  loadContentLoop(): Promise<PersistedContentLoopState>;
  generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState>;
  generateDraftPackage(projectId: string): Promise<PersistedContentLoopState>;
  generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState>;
  promoteTopic(topicId: string): Promise<PersistedContentLoopState>;
}
```

Add `platformPackages: []` to `createSeeded`.

- [ ] **Step 4: Implement in-memory package generation**

Add this method to `InMemoryContentLoopRepository`:

```ts
  async generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState> {
    if (platform !== "xiaohongshu") {
      return cloneState(this.state);
    }

    const project = this.state.projects.find((candidate) => candidate.id === projectId);
    const draft = this.state.drafts
      .filter((candidate) => candidate.contentProjectId === projectId)
      .sort((left, right) => right.version - left.version || right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!project || !draft) {
      return cloneState(this.state);
    }

    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft,
      now: new Date()
    });

    this.state = {
      ...this.state,
      platformPackages: [
        platformPackage,
        ...this.state.platformPackages.filter((candidate) => candidate.id !== platformPackage.id)
      ],
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }
```

- [ ] **Step 5: Run local-store tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: FAIL in SQLite and desktop-facing compile paths until those layers add `platformPackages` and `generatePlatformPackage`.

- [ ] **Step 6: Commit after Task 3 is complete**

Do not commit this task alone if TypeScript fails because the shared interface requires SQLite updates. Commit Tasks 2 and 3 together after Task 3 passes.

## Task 3: SQLite Schema And Persistence

**Files:**

- Modify: `packages/local-store/src/schema.test.ts`
- Modify: `packages/local-store/src/schema.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`

- [ ] **Step 1: Write failing schema and SQLite repository tests**

In `packages/local-store/src/schema.test.ts`, add `platform_packages` to the core table list:

```ts
      "draft_versions",
      "source_references",
      "platform_packages",
      "assets"
```

In `packages/local-store/src/sqlite-content-loop-repository.test.ts`, update the schema table expectation to include `platform_packages`:

```ts
        "content_projects",
        "draft_versions",
        "platform_packages"
```

Add these tests:

```ts
  it("persists generated platform packages across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await firstRepository.generateDraftPackage(projectId);
    const afterPackage = await firstRepository.generatePlatformPackage(projectId, "xiaohongshu");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPackage.platformPackages).toHaveLength(1);
    expect(afterPackage.platformPackages[0]?.platform).toBe("xiaohongshu");
    expect(afterReload).toEqual(afterPackage);
  });

  it("replaces a generated platform package for the same draft and platform", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterFirstPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterSecondPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    repository.close();

    expect(afterFirstPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages[0]?.id).toBe(afterFirstPackage.platformPackages[0]?.id);
  });

  it("does not insert a platform package for a missing project", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });
    const before = await repository.loadContentLoop();
    const afterMissingProject = await repository.generatePlatformPackage("project_missing", "xiaohongshu");
    repository.close();

    expect(afterMissingProject).toEqual(before);
  });
```

- [ ] **Step 2: Run local-store tests to verify red state**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `platform_packages` and SQLite repository methods do not exist.

- [ ] **Step 3: Add the SQLite table**

Modify `packages/local-store/src/schema.ts` by adding this table before `assets`:

```sql
CREATE TABLE IF NOT EXISTS platform_packages (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT NOT NULL REFERENCES content_projects(id),
  draft_version_id TEXT NOT NULL REFERENCES draft_versions(id),
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  cover_text TEXT NOT NULL,
  required_assets_json TEXT NOT NULL DEFAULT '[]',
  checks_json TEXT NOT NULL DEFAULT '[]',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 4: Extend SQLite repository imports, row types, and load state**

In `packages/local-store/src/sqlite-content-loop-repository.ts`, add `generateMockXiaohongshuPackage` to the core import and add `PlatformPackage`, `PlatformPackageCheck` to type imports.

Add:

```ts
interface PlatformPackageRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  draft_version_id: string;
  platform: string;
  title: string;
  body: string;
  tags_json: string;
  cover_text: string;
  required_assets_json: string;
  checks_json: string;
  created_at: string;
  updated_at: string;
}
```

In `loadState`, query packages:

```ts
    const platformPackages = this.database
      .prepare("SELECT * FROM platform_packages ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as PlatformPackageRow[];
```

Return:

```ts
      platformPackages: platformPackages.map(mapPlatformPackageRow),
```

- [ ] **Step 5: Add SQLite package generation helpers**

Add the repository method:

```ts
  async generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState> {
    if (platform !== "xiaohongshu") {
      return this.loadState();
    }

    const project = this.getContentProject(projectId);
    const draft = this.getLatestDraftForProject(projectId);

    if (!project || !draft) {
      return this.loadState();
    }

    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft,
      now: this.createPromotionDate()
    });

    this.runTransaction(() => {
      this.upsertPlatformPackage(platformPackage);
    });

    return this.loadState(project.id);
  }
```

Add `getLatestDraftForProject`:

```ts
  private getLatestDraftForProject(projectId: string): DraftVersion | null {
    const row = this.database
      .prepare(
        `SELECT * FROM draft_versions
         WHERE content_project_id = ?
         ORDER BY version DESC, updated_at DESC, id ASC
         LIMIT 1;`
      )
      .get(projectId) as DraftVersionRow | undefined;

    return row ? mapDraftVersionRow(row) : null;
  }
```

Update `createPromotionDate` union to include package timestamps:

```sql
           UNION ALL
           SELECT updated_at FROM platform_packages
```

Add `upsertPlatformPackage`:

```ts
  private upsertPlatformPackage(platformPackage: PlatformPackage): void {
    this.database
      .prepare(
        `INSERT INTO platform_packages (
          id, workspace_id, content_project_id, draft_version_id, platform, title, body,
          tags_json, cover_text, required_assets_json, checks_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          draft_version_id = excluded.draft_version_id,
          platform = excluded.platform,
          title = excluded.title,
          body = excluded.body,
          tags_json = excluded.tags_json,
          cover_text = excluded.cover_text,
          required_assets_json = excluded.required_assets_json,
          checks_json = excluded.checks_json,
          updated_at = excluded.updated_at;`
      )
      .run(
        platformPackage.id,
        platformPackage.workspaceId,
        platformPackage.contentProjectId,
        platformPackage.draftVersionId,
        platformPackage.platform,
        platformPackage.title,
        platformPackage.body,
        JSON.stringify(platformPackage.tags),
        platformPackage.coverText,
        JSON.stringify(platformPackage.requiredAssets),
        JSON.stringify(platformPackage.checks),
        platformPackage.createdAt,
        platformPackage.updatedAt
      );
  }
```

Add mapper:

```ts
function mapPlatformPackageRow(row: PlatformPackageRow): PlatformPackage {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    draftVersionId: row.draft_version_id,
    platform: row.platform as Platform,
    title: row.title,
    body: row.body,
    tags: JSON.parse(row.tags_json) as string[],
    coverText: row.cover_text,
    requiredAssets: JSON.parse(row.required_assets_json) as string[],
    checks: JSON.parse(row.checks_json) as PlatformPackageCheck[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

- [ ] **Step 6: Update existing empty-state expectations**

In `packages/local-store/src/content-loop-repository.test.ts`, add this assertion to the seeded state test:

```ts
    expect(state.platformPackages).toHaveLength(0);
```

In `packages/local-store/src/sqlite-content-loop-repository.test.ts`, add this assertion to the seed/reload test:

```ts
    expect(firstLoad.platformPackages).toHaveLength(0);
```

In `apps/desktop/src/renderer/content-loop-service.test.ts`, update `emptyState`:

```ts
platformPackages: []
```

- [ ] **Step 7: Run local-store verification**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both pass.

- [ ] **Step 8: Commit Tasks 2 and 3 together**

Run:

```bash
git add packages/local-store/src/content-loop-repository.ts packages/local-store/src/content-loop-repository.test.ts packages/local-store/src/schema.ts packages/local-store/src/schema.test.ts packages/local-store/src/sqlite-content-loop-repository.ts packages/local-store/src/sqlite-content-loop-repository.test.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: persist platform packages"
```

## Task 4: IPC, Preload, And Loader API

**Files:**

- Modify: `apps/desktop/src/main/ipc-channels.ts`
- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/global.d.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Modify: `apps/desktop/src/renderer/content-loop-service.test.ts`
- Modify: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Write failing loader and IPC tests**

Update `apps/desktop/src/renderer/content-loop-loader.test.ts` imports:

```ts
import {
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedTopics,
  loadPersistedContentLoop,
  promotePersistedTopic
} from "./content-loop-loader";
```

Add:

```ts
  it("generates platform packages through preload API", async () => {
    await generatePersistedPlatformPackage("project_topic-ai-local-workstation", "xiaohongshu");

    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    );
  });
```

Update `apps/desktop/src/renderer/content-loop-service.test.ts` imports:

```ts
import {
  CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL,
  CONTENT_LOOP_GENERATE_TOPICS_CHANNEL
} from "../main/ipc-channels";
```

Add tests:

```ts
  it("rejects invalid platform package project ids before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGeneratePlatformPackageHandler();

    await expect(handler({} as IpcMainInvokeEvent, "", "xiaohongshu")).rejects.toThrow(
      "Invalid content project id."
    );
    expect(repository.generatePlatformPackage).not.toHaveBeenCalled();
  });

  it("rejects unsupported platform package platforms before calling the repository", async () => {
    const repository = createRepository();
    registerContentLoopIpc(repository);

    const handler = getGeneratePlatformPackageHandler();

    await expect(handler({} as IpcMainInvokeEvent, "project_topic-ai-local-workstation", "douyin")).rejects.toThrow(
      "Unsupported publish platform."
    );
    expect(repository.generatePlatformPackage).not.toHaveBeenCalled();
  });
```

Add helper:

```ts
function getGeneratePlatformPackageHandler(): (
  event: IpcMainInvokeEvent,
  projectId: unknown,
  platform: unknown
) => Promise<unknown> {
  const handleCall = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL);

  if (!handleCall) {
    throw new Error("Generate platform package IPC handler was not registered.");
  }

  return handleCall[1] as (event: IpcMainInvokeEvent, projectId: unknown, platform: unknown) => Promise<unknown>;
}
```

- [ ] **Step 2: Run desktop tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because the platform package preload and IPC APIs do not exist.

- [ ] **Step 3: Add IPC channel and main-process validation**

Modify `apps/desktop/src/main/ipc-channels.ts`:

```ts
export const CONTENT_LOOP_LOAD_CHANNEL = "content-loop:load";
export const CONTENT_LOOP_PROMOTE_TOPIC_CHANNEL = "content-loop:promote-topic";
export const CONTENT_LOOP_GENERATE_TOPICS_CHANNEL = "content-loop:generate-topics";
export const CONTENT_LOOP_GENERATE_DRAFT_PACKAGE_CHANNEL = "content-loop:generate-draft-package";
export const CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL = "content-loop:generate-platform-package";
```

Modify `apps/desktop/src/main/content-loop-service.ts`:

```ts
import { DEFAULT_COLUMNS, type ContentColumnSlug, type Platform } from "@robert-station/core";
```

Include the new channel import. Add:

```ts
  ipcMain.handle(CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL, async (_event, projectId: unknown, platform: unknown) => {
    if (typeof projectId !== "string" || projectId.length === 0) {
      throw new Error("Invalid content project id.");
    }

    if (!isSupportedPublishPlatform(platform)) {
      throw new Error("Unsupported publish platform.");
    }

    return repository.generatePlatformPackage(projectId, platform);
  });
```

Add helper:

```ts
function isSupportedPublishPlatform(value: unknown): value is Platform {
  return value === "xiaohongshu";
}
```

- [ ] **Step 4: Add preload, global type, and loader function**

Modify `apps/desktop/src/preload/preload.ts`:

```ts
import type { ContentColumnSlug, Platform } from "@robert-station/core";
```

Add `CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL` to imports and expose:

```ts
    generatePlatformPackage: (projectId: string, platform: Platform) =>
      ipcRenderer.invoke(CONTENT_LOOP_GENERATE_PLATFORM_PACKAGE_CHANNEL, projectId, platform) as Promise<PersistedContentLoopState>,
```

Modify `apps/desktop/src/renderer/global.d.ts`:

```ts
import type { ContentColumnSlug, Platform } from "@robert-station/core";
```

Add:

```ts
        generatePlatformPackage: (projectId: string, platform: Platform) => Promise<PersistedContentLoopState>;
```

Modify `apps/desktop/src/renderer/content-loop-loader.ts`:

```ts
import type { ContentColumnSlug, Platform } from "@robert-station/core";
```

Add:

```ts
export async function generatePersistedPlatformPackage(
  projectId: string,
  platform: Platform
): Promise<PersistedContentLoopState> {
  return window.robertStation.contentLoop.generatePlatformPackage(projectId, platform);
}
```

Modify `apps/desktop/src/renderer/test-setup.ts`:

```ts
      generatePlatformPackage: vi.fn(async (projectId: string, platform: Platform) =>
        repository.generatePlatformPackage(projectId, platform)
      ),
```

Also import `Platform`.

Modify `createRepository()` in `apps/desktop/src/renderer/content-loop-service.test.ts`:

```ts
    generatePlatformPackage: vi.fn(async () => emptyState),
```

- [ ] **Step 5: Run desktop verification**

Run:

```bash
npm --workspace @robert-station/desktop test
npm --workspace @robert-station/desktop run typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run after tests and typecheck pass:

```bash
git add apps/desktop/src/main/ipc-channels.ts apps/desktop/src/main/content-loop-service.ts apps/desktop/src/preload/preload.ts apps/desktop/src/renderer/global.d.ts apps/desktop/src/renderer/content-loop-loader.ts apps/desktop/src/renderer/content-loop-loader.test.ts apps/desktop/src/renderer/content-loop-service.test.ts apps/desktop/src/renderer/test-setup.ts
git -c user.name=Codex -c user.email=codex@local commit -m "feat: expose platform package ipc"
```

## Task 5: Creation Studio UI

**Files:**

- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing UI tests**

In `apps/desktop/src/renderer/App.test.tsx`, add:

```ts
  it("generates and displays a Xiaohongshu package for the selected project", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));

    expect(await screen.findByRole("heading", { name: "Xiaohongshu Package" })).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Cover text")).toBeInTheDocument();
    expect(screen.getByText("Required assets")).toBeInTheDocument();
    expect(screen.getByText("Checks")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    );
  });

  it("shows an inline error and keeps current content when Xiaohongshu package generation fails", async () => {
    window.robertStation.contentLoop.generatePlatformPackage = vi.fn(async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));

    expect(await screen.findByText("Could not generate Xiaohongshu package. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Draft v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Xiaohongshu package" })).toBeEnabled();
  });
```

- [ ] **Step 2: Run UI tests to verify red state**

Run:

```bash
npm --workspace @robert-station/desktop test -- App.test.tsx
```

Expected: FAIL because the button and package panel do not exist.

- [ ] **Step 3: Wire UI state and handler**

Modify imports in `apps/desktop/src/renderer/App.tsx`:

```ts
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedTopics,
```

Add state:

```ts
  const [isGeneratingPlatformPackage, setIsGeneratingPlatformPackage] = useState(false);
  const [platformPackageError, setPlatformPackageError] = useState<string | null>(null);
```

Add handler:

```ts
  async function handleGeneratePlatformPackage(projectId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsGeneratingPlatformPackage(true);
    setPlatformPackageError(null);

    try {
      const nextState = await generatePersistedPlatformPackage(projectId, "xiaohongshu");
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setPlatformPackageError("Could not generate Xiaohongshu package. Try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingPlatformPackage(false);
      }
    }
  }
```

Compute selected package near `selectedDraft`:

```ts
  const selectedXiaohongshuPackage = selectedProject
    ? contentLoop.platformPackages.find(
        (platformPackage) =>
          platformPackage.contentProjectId === selectedProject.id && platformPackage.platform === "xiaohongshu"
      ) ?? null
    : null;
```

- [ ] **Step 4: Render the package action and panel**

Inside the `selectedProject && selectedDraft` Creation Studio branch, add the button beside the existing draft package button:

```tsx
                  <button
                    disabled={isGeneratingPlatformPackage}
                    onClick={() => void handleGeneratePlatformPackage(selectedProject.id)}
                    type="button"
                  >
                    {isGeneratingPlatformPackage ? "Generating..." : "Generate Xiaohongshu package"}
                  </button>
                  {platformPackageError ? (
                    <p className="inline-error" role="alert">
                      {platformPackageError}
                    </p>
                  ) : null}
```

After `source-panel`, render:

```tsx
                <section className="publish-package-panel" aria-label="Xiaohongshu Package">
                  <h2>Xiaohongshu Package</h2>
                  {selectedXiaohongshuPackage ? (
                    <>
                      <section>
                        <h3>Title</h3>
                        <p>{selectedXiaohongshuPackage.title}</p>
                      </section>
                      <section>
                        <h3>Body</h3>
                        <p>{selectedXiaohongshuPackage.body}</p>
                      </section>
                      <section>
                        <h3>Tags</h3>
                        <p>{selectedXiaohongshuPackage.tags.join(" ")}</p>
                      </section>
                      <section>
                        <h3>Cover text</h3>
                        <p>{selectedXiaohongshuPackage.coverText}</p>
                      </section>
                      <section>
                        <h3>Required assets</h3>
                        <ul>
                          {selectedXiaohongshuPackage.requiredAssets.map((asset) => (
                            <li key={asset}>{asset}</li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <h3>Checks</h3>
                        <ul>
                          {selectedXiaohongshuPackage.checks.map((check) => (
                            <li key={check.name}>
                              <strong>{check.status}</strong> {check.name}: {check.message}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </>
                  ) : (
                    <p className="empty-state">No Xiaohongshu package yet.</p>
                  )}
                </section>
```

- [ ] **Step 5: Add compact package panel styling**

Add to `apps/desktop/src/renderer/styles.css`:

```css
.publish-package-panel {
  background: #ffffff;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  display: grid;
  gap: 14px;
  padding: 18px;
}

.publish-package-panel h2,
.publish-package-panel h3 {
  margin: 0;
}

.publish-package-panel p,
.publish-package-panel ul {
  color: #435064;
  margin: 0;
}

.publish-package-panel ul {
  padding-left: 18px;
}
```

If the existing `.creation-studio` grid needs room, adjust it with:

```css
.creation-studio {
  align-items: start;
}
```

- [ ] **Step 6: Run desktop tests and typecheck**

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
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add xiaohongshu package ui"
```

## Task 6: Full Verification

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

Expected: no matches and exit code 1. This means workspace package paths were bundled away from the main process output.

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

Expected: no whitespace errors. `git status --short` should be clean after all intended commits.

- [ ] **Step 7: Complete branch workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present branch completion options and follow the user's selected option.
