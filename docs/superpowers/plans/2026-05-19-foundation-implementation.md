# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable foundation for the AI workflow desktop client: npm workspace, shared domain model, SQLite schema definition, Electron + React shell, and a basic dashboard for the four equal-priority content columns.

**Architecture:** Use a monorepo with `apps/desktop` for Electron + React and `packages/core` plus `packages/local-store` for shared domain logic and local persistence schema. The first slice is offline-first and local-only; cloud AI, server archive, sync, publish packages, and data import are separate follow-up plans.

**Tech Stack:** Electron, React, TypeScript, Vite/electron-vite, Vitest, npm workspaces.

---

## Scope

This plan implements Milestone 1 from the design spec:

- Electron shell.
- React UI frame.
- Shared domain entities.
- Local SQLite schema definition.
- Basic local file repository path helper.
- First dashboard showing AI, finance, parenting, and fitness as equal-priority columns.

This plan does not implement:

- AI provider calls.
- Topic discovery.
- Server API or Postgres archive.
- Sync queue.
- Publish assistant.
- CSV/Excel import.
- OCR parsing.
- Review and knowledge extraction.

Those are separate plans after this foundation is running and testable.

## Target File Structure

```text
package.json
tsconfig.base.json
vitest.config.ts
docs/superpowers/plans/2026-05-19-foundation-implementation.md
packages/
  core/
    package.json
    tsconfig.json
    src/
      columns.test.ts
      columns.ts
      ids.ts
      index.ts
      types.ts
  local-store/
    package.json
    tsconfig.json
    src/
      file-repository.test.ts
      file-repository.ts
      index.ts
      schema.test.ts
      schema.ts
apps/
  desktop/
    package.json
    electron.vite.config.ts
    tsconfig.json
    index.html
    src/
      main/
        main.ts
      preload/
        preload.ts
      renderer/
        App.test.tsx
        App.tsx
        main.tsx
        styles.css
        test-setup.ts
```

## Task 1: Workspace Tooling

**Files:**

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create root package metadata**

Create `package.json`:

```json
{
  "name": "robert-station",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:desktop": "npm --workspace @robert-station/desktop run dev",
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Create root Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx"],
    globals: true,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 5: Run baseline test command**

Run:

```bash
npm test
```

Expected: no tests are found yet, or workspace packages without tests are skipped. If npm reports missing workspace packages, continue after Task 2 creates them.

- [ ] **Step 6: Commit workspace tooling**

Run:

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts
git commit -m "chore: add workspace tooling"
```

Expected: commit succeeds.

## Task 2: Shared Domain Model

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/ids.ts`
- Create: `packages/core/src/columns.ts`
- Create: `packages/core/src/columns.test.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create package metadata**

Create `packages/core/package.json`:

```json
{
  "name": "@robert-station/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src"
  },
  "devDependencies": {
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write failing domain tests**

Create `packages/core/src/columns.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_COLUMNS, createDefaultWorkspaceSeed } from "./columns";

describe("default content columns", () => {
  it("treats AI, finance, parenting, and fitness as equal-priority columns", () => {
    expect(DEFAULT_COLUMNS.map((column) => column.slug)).toEqual([
      "ai",
      "finance",
      "parenting",
      "fitness"
    ]);
    expect(new Set(DEFAULT_COLUMNS.map((column) => column.priority))).toEqual(new Set([1]));
  });

  it("creates a workspace seed with one persona and four columns", () => {
    const seed = createDefaultWorkspaceSeed("Robert Station");

    expect(seed.workspace.name).toBe("Robert Station");
    expect(seed.personas).toHaveLength(1);
    expect(seed.columns).toHaveLength(4);
    expect(seed.platformAccounts).toEqual([]);
    expect(seed.columns.every((column) => column.workspaceId === seed.workspace.id)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the failing test**

Run:

```bash
npm --workspace @robert-station/core test -- --runInBand
```

Expected: FAIL because `./columns` does not exist.

- [ ] **Step 5: Add shared types**

Create `packages/core/src/types.ts`:

```ts
export type EntityId = string;

export type Platform = "xiaohongshu" | "douyin" | "wechat_channels" | "bilibili";

export type ContentColumnSlug = "ai" | "finance" | "parenting" | "fitness";

export interface Workspace {
  id: EntityId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Persona {
  id: EntityId;
  workspaceId: EntityId;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAccount {
  id: EntityId;
  workspaceId: EntityId;
  personaId: EntityId;
  platform: Platform;
  handle: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: EntityId;
  workspaceId: EntityId;
  slug: ContentColumnSlug;
  name: string;
  description: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSeed {
  workspace: Workspace;
  personas: Persona[];
  platformAccounts: PlatformAccount[];
  columns: Column[];
}
```

- [ ] **Step 6: Add deterministic local ID helper**

Create `packages/core/src/ids.ts`:

```ts
export function createEntityId(prefix: string, value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}_${normalized || "default"}`;
}
```

- [ ] **Step 7: Implement default columns and workspace seed**

Create `packages/core/src/columns.ts`:

```ts
import { createEntityId } from "./ids";
import type { Column, ContentColumnSlug, WorkspaceSeed } from "./types";

export const DEFAULT_COLUMNS: Array<Pick<Column, "slug" | "name" | "description" | "priority">> = [
  {
    slug: "ai",
    name: "AI",
    description: "AI tools, workflows, workstations, productivity, and AI knowledge explainers.",
    priority: 1
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Personal finance, tools, methods, and learning notes.",
    priority: 1
  },
  {
    slug: "parenting",
    name: "Parenting",
    description: "Child raising, family workflows, and daily problem solving.",
    priority: 1
  },
  {
    slug: "fitness",
    name: "Fitness",
    description: "Swimming, gym training, habit building, equipment, and plans.",
    priority: 1
  }
];

export function createDefaultWorkspaceSeed(name: string, now = new Date("2026-05-19T00:00:00.000Z")): WorkspaceSeed {
  const timestamp = now.toISOString();
  const workspaceId = createEntityId("workspace", name);
  const personaId = createEntityId("persona", `${name}-default`);

  return {
    workspace: {
      id: workspaceId,
      name,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    personas: [
      {
        id: personaId,
        workspaceId,
        name,
        description: "Default creator persona.",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    platformAccounts: [],
    columns: DEFAULT_COLUMNS.map((column) => ({
      id: createEntityId("column", column.slug satisfies ContentColumnSlug),
      workspaceId,
      slug: column.slug,
      name: column.name,
      description: column.description,
      priority: column.priority,
      createdAt: timestamp,
      updatedAt: timestamp
    }))
  };
}
```

- [ ] **Step 8: Add package exports**

Create `packages/core/src/index.ts`:

```ts
export * from "./columns";
export * from "./ids";
export * from "./types";
```

- [ ] **Step 9: Run tests and typecheck**

Run:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/core run typecheck
```

Expected: both commands pass.

- [ ] **Step 10: Commit shared domain model**

Run:

```bash
git add packages/core
git commit -m "feat: add shared content domain model"
```

Expected: commit succeeds.

## Task 3: Local Store Schema And File Repository Helpers

**Files:**

- Create: `packages/local-store/package.json`
- Create: `packages/local-store/tsconfig.json`
- Create: `packages/local-store/src/schema.ts`
- Create: `packages/local-store/src/schema.test.ts`
- Create: `packages/local-store/src/file-repository.ts`
- Create: `packages/local-store/src/file-repository.test.ts`
- Create: `packages/local-store/src/index.ts`

- [ ] **Step 1: Create package metadata**

Create `packages/local-store/package.json`:

```json
{
  "name": "@robert-station/local-store",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
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

- [ ] **Step 2: Create TypeScript config**

Create `packages/local-store/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write failing schema tests**

Create `packages/local-store/src/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SQLITE_SCHEMA } from "./schema";

describe("SQLite schema", () => {
  it("contains core foundation tables", () => {
    for (const table of ["workspaces", "personas", "platform_accounts", "columns", "content_projects", "assets"]) {
      expect(SQLITE_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("tracks sync metadata on local-first entities", () => {
    expect(SQLITE_SCHEMA).toContain("remote_id TEXT");
    expect(SQLITE_SCHEMA).toContain("sync_status TEXT NOT NULL DEFAULT 'local'");
    expect(SQLITE_SCHEMA).toContain("updated_at TEXT NOT NULL");
  });
});
```

- [ ] **Step 4: Write failing file repository tests**

Create `packages/local-store/src/file-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWorkspaceRepositoryPaths } from "./file-repository";

describe("file repository paths", () => {
  it("keeps project files under one predictable workspace directory", () => {
    const paths = buildWorkspaceRepositoryPaths("/Users/robert/RobertStation", "workspace_robert-station");

    expect(paths.root).toBe("/Users/robert/RobertStation/workspace_robert-station");
    expect(paths.assets).toBe("/Users/robert/RobertStation/workspace_robert-station/assets");
    expect(paths.imports).toBe("/Users/robert/RobertStation/workspace_robert-station/imports");
    expect(paths.exports).toBe("/Users/robert/RobertStation/workspace_robert-station/exports");
  });
});
```

- [ ] **Step 5: Run failing tests**

Run:

```bash
npm --workspace @robert-station/local-store test
```

Expected: FAIL because `schema` and `file-repository` modules do not exist.

- [ ] **Step 6: Implement SQLite schema string**

Create `packages/local-store/src/schema.ts`:

```ts
export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  name TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_accounts (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  persona_id TEXT NOT NULL REFERENCES personas(id),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_projects (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  primary_column_id TEXT NOT NULL REFERENCES columns(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'topic',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  remote_id TEXT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  content_project_id TEXT REFERENCES content_projects(id),
  kind TEXT NOT NULL,
  local_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function getSqliteSchemaStatements(): string[] {
  return SQLITE_SCHEMA.split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);
}
```

- [ ] **Step 7: Implement file repository helper**

Create `packages/local-store/src/file-repository.ts`:

```ts
import path from "node:path";

export interface WorkspaceRepositoryPaths {
  root: string;
  assets: string;
  imports: string;
  exports: string;
}

export function buildWorkspaceRepositoryPaths(baseDirectory: string, workspaceId: string): WorkspaceRepositoryPaths {
  const root = path.join(baseDirectory, workspaceId);

  return {
    root,
    assets: path.join(root, "assets"),
    imports: path.join(root, "imports"),
    exports: path.join(root, "exports")
  };
}
```

- [ ] **Step 8: Add package exports**

Create `packages/local-store/src/index.ts`:

```ts
export * from "./file-repository";
export * from "./schema";
```

- [ ] **Step 9: Run tests and typecheck**

Run:

```bash
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/local-store run typecheck
```

Expected: both commands pass.

- [ ] **Step 10: Commit local store foundation**

Run:

```bash
git add packages/local-store
git commit -m "feat: add local store foundation"
```

Expected: commit succeeds.

## Task 4: Desktop App Scaffold

**Files:**

- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main/main.ts`
- Create: `apps/desktop/src/preload/preload.ts`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Create desktop package metadata**

Create `apps/desktop/package.json`:

```json
{
  "name": "@robert-station/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src/renderer"
  },
  "dependencies": {
    "@robert-station/core": "0.1.0",
    "@robert-station/local-store": "0.1.0",
    "@vitejs/plugin-react": "^4.4.0",
    "electron": "^36.0.0",
    "electron-vite": "^3.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "jsdom": "^26.1.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `apps/desktop/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["electron.vite.config.ts", "src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create electron-vite config**

Create `apps/desktop/electron.vite.config.ts`:

```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: ".",
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer")
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: ["src/renderer/test-setup.ts"]
    }
  }
});
```

- [ ] **Step 4: Create renderer HTML entry**

Create `apps/desktop/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Robert Station</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create Electron main process**

Create `apps/desktop/src/main/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";

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

- [ ] **Step 6: Create preload bridge**

Create `apps/desktop/src/preload/preload.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("robertStation", {
  appName: "Robert Station"
});
```

- [ ] **Step 7: Create renderer entry and test setup**

Create `apps/desktop/src/renderer/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/desktop/src/renderer/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: Install dependencies**

Run:

```bash
npm install
```

Expected: desktop dependencies are added to `package-lock.json`.

- [ ] **Step 9: Build desktop scaffold**

Run:

```bash
npm --workspace @robert-station/desktop run build
```

Expected: FAIL because `App.tsx` and `styles.css` do not exist yet. This is acceptable before Task 5.

- [ ] **Step 10: Commit desktop scaffold**

Run:

```bash
git add apps/desktop package-lock.json package.json
git commit -m "feat: scaffold desktop app"
```

Expected: commit succeeds even though the renderer app component is added in the next task.

## Task 5: Dashboard UI For Equal-Priority Columns

**Files:**

- Create: `apps/desktop/src/renderer/App.tsx`
- Create: `apps/desktop/src/renderer/App.test.tsx`
- Create: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Write failing dashboard test**

Create `apps/desktop/src/renderer/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App dashboard", () => {
  it("renders the four equal-priority content columns", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("shows the foundation workflow stages", () => {
    render(<App />);

    expect(screen.getByText("Topic Pool")).toBeInTheDocument();
    expect(screen.getByText("Creation Studio")).toBeInTheDocument();
    expect(screen.getByText("Publish Assistant")).toBeInTheDocument();
    expect(screen.getByText("Data Import")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing dashboard test**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: FAIL because `./App` does not exist.

- [ ] **Step 3: Implement dashboard component**

Create `apps/desktop/src/renderer/App.tsx`:

```tsx
import { DEFAULT_COLUMNS } from "@robert-station/core";

const workflowStages = [
  "Topic Pool",
  "Creation Studio",
  "Publish Assistant",
  "Data Import",
  "Review",
  "Knowledge Base"
];

export function App(): JSX.Element {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">RS</div>
        <nav>
          {workflowStages.map((stage) => (
            <a href={`#${stage.toLowerCase().replaceAll(" ", "-")}`} key={stage}>
              {stage}
            </a>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Content operations workbench</p>
            <h1>Robert Station</h1>
          </div>
          <button type="button">New Project</button>
        </header>

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
                  <dd>0</dd>
                </div>
                <div>
                  <dt>Drafts</dt>
                  <dd>0</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>0</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add dashboard styles**

Create `apps/desktop/src/renderer/styles.css`:

```css
:root {
  color: #172026;
  background: #f4f6f8;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button {
  border: 1px solid #0f766e;
  border-radius: 6px;
  background: #0f766e;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  padding: 10px 14px;
}

.app-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  background: #111827;
  color: #f9fafb;
  padding: 20px;
}

.brand {
  align-items: center;
  background: #0f766e;
  border-radius: 8px;
  display: flex;
  font-weight: 700;
  height: 42px;
  justify-content: center;
  margin-bottom: 28px;
  width: 42px;
}

.sidebar nav {
  display: grid;
  gap: 8px;
}

.sidebar a {
  border-radius: 6px;
  color: #cbd5e1;
  padding: 10px 12px;
  text-decoration: none;
}

.sidebar a:hover {
  background: #1f2937;
  color: #ffffff;
}

.dashboard {
  padding: 28px;
}

.dashboard-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.dashboard-header h1 {
  font-size: 32px;
  line-height: 1.1;
  margin: 0;
}

.eyebrow {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

.summary-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.column-card {
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 8px;
  padding: 18px;
}

.column-card__header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.column-card h2 {
  font-size: 20px;
  margin: 0;
}

.column-card span {
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
}

.column-card p {
  color: #475569;
  min-height: 72px;
}

.column-card dl {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, 1fr);
  margin: 18px 0 0;
}

.column-card div {
  background: #f8fafc;
  border-radius: 6px;
  padding: 10px;
}

.column-card dt {
  color: #64748b;
  font-size: 12px;
}

.column-card dd {
  font-size: 18px;
  font-weight: 700;
  margin: 2px 0 0;
}
```

- [ ] **Step 5: Run dashboard tests**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: PASS.

- [ ] **Step 6: Run desktop typecheck**

Run:

```bash
npm --workspace @robert-station/desktop run typecheck
```

Expected: PASS.

- [ ] **Step 7: Build desktop app**

Run:

```bash
npm --workspace @robert-station/desktop run build
```

Expected: PASS and `apps/desktop/dist` is generated.

- [ ] **Step 8: Commit dashboard UI**

Run:

```bash
git add apps/desktop
git commit -m "feat: add desktop dashboard foundation"
```

Expected: commit succeeds.

## Task 6: Whole-Repo Verification

**Files:**

- Modify: none unless previous tasks reveal type or test errors.

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

- [ ] **Step 4: Check Git diff cleanliness**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` shows no uncommitted files after commits are complete.

## Self-Review

Spec coverage:

- Covered: Electron shell, React UI frame, shared core entities, local SQLite schema definition, local file repository path helper, four equal-priority columns.
- Deferred by design: AI calls, topic discovery workflow, server API, sync queue, publish assistant, data import, review, knowledge base. These require separate plans because the original design covers multiple independent subsystems.

Unresolved-marker scan:

- No unresolved markers or unspecified implementation steps are intentionally present.
- Every code-changing step includes concrete file content.

Type consistency:

- `Column`, `Workspace`, `Persona`, `PlatformAccount`, and `WorkspaceSeed` are defined in `packages/core/src/types.ts`.
- `DEFAULT_COLUMNS` and `createDefaultWorkspaceSeed` are exported from `packages/core/src/index.ts`.
- Desktop imports `DEFAULT_COLUMNS` from `@robert-station/core`.
