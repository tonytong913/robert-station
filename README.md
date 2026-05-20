# Robert Station

Robert Station is a local-first desktop workbench for a single creator running a repeatable content operation.

It is not only a writing assistant. The current v0 loop helps move one content idea from topic selection through drafting, Xiaohongshu packaging, manual publishing, metrics import, review, archiving, and reusable knowledge extraction.

```text
Topic Pool -> Creation Studio -> Xiaohongshu Package -> Manual Publish
  -> Metrics Import -> Review Report -> Archive -> Knowledge
```

The app is built as an Electron + React + TypeScript monorepo with deterministic mock assistants and local SQLite persistence. The package boundaries are shaped for later production AI integrations, but the current implementation is intentionally offline-friendly and predictable.

## Current Capabilities

- Generate candidate topics for four content columns: AI, Finance, Parenting, and Fitness.
- Promote a topic into a content project.
- Generate draft packages with audience, angle, title options, body copy, cover copy, tags, visual direction, and verification notes.
- Generate a Xiaohongshu-ready platform package with title/body/tags/cover text/assets/checks.
- Record manual publish metadata: publish time, final URL, and notes.
- Import performance metrics from CSV, preview matched and invalid rows, and save metric snapshots.
- Generate versioned review reports from publish records and optional metric snapshots.
- Archive a content project into archive records and knowledge items.
- Extract deterministic review-derived knowledge after a project has been archived.
- Persist the content loop through an in-memory repository for tests and a SQLite repository for the desktop app.

## Product Shape

Robert Station is designed around this operating model:

```text
Workspace -> Persona -> Platform Account -> Column -> Content Project
```

The first implementation focuses on one local workspace named Robert Station and one creator. The domain model already leaves room for multiple personas, platform accounts, content columns, publish records, metric snapshots, review reports, knowledge items, assets, and source references.

The first visible platform package is Xiaohongshu. Other platforms are represented in the domain types and metric import model, but the current UI does not generate full Douyin, WeChat Channels, or Bilibili packages yet.

## Architecture

```text
apps/desktop
  Electron main process, preload bridge, React renderer, IPC-facing workflow UI

packages/core
  Domain types and deterministic assistant helpers

packages/local-store
  Content loop repository interface, in-memory implementation, SQLite implementation, schema

docs/superpowers
  Product specs, implementation plans, and milestone notes
```

### Desktop App

`apps/desktop` contains the Electron client.

- `src/main` creates the Electron window, opens the SQLite repository, and registers IPC handlers.
- `src/preload` exposes a typed `window.robertStation` API to the renderer.
- `src/renderer` contains the React app, loader functions, styles, and renderer tests.

The renderer does not access Node filesystem APIs directly. File access, CSV import, and persistence flow through Electron IPC.

### Core Package

`packages/core` owns the business objects and deterministic assistant behavior:

- content columns and workspace seed data;
- topic generation;
- topic promotion into projects;
- draft package generation;
- Xiaohongshu package generation;
- manual publish records;
- metric CSV parsing and matching;
- review report generation;
- archive and knowledge item generation.

These helpers are deterministic enough to test tightly, while preserving the interfaces expected from future real AI assistants.

### Local Store Package

`packages/local-store` owns persistence workflows.

- `ContentLoopRepository` defines the app-facing repository contract.
- `InMemoryContentLoopRepository` supports fast workflow and renderer tests.
- `SqliteContentLoopRepository` persists the local desktop state in SQLite.
- `schema.ts` contains the current SQLite table definitions.

The desktop app stores its SQLite database at Electron's `userData` path as `robert-station.sqlite`.

## Tech Stack

- TypeScript ES modules
- Electron
- electron-vite
- React
- Vitest
- React Testing Library
- Node `node:sqlite`
- npm workspaces

The TypeScript configuration is strict and enables `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the desktop app:

```bash
npm run dev:desktop
```

Run the full build:

```bash
npm run build
```

Run strict TypeScript checks:

```bash
npm run typecheck
```

Run all tests:

```bash
npm test
```

Run one workspace while iterating:

```bash
npm --workspace @robert-station/core test
npm --workspace @robert-station/local-store test
npm --workspace @robert-station/desktop test
```

## Metrics CSV Import

The metrics import flow expects a CSV with these headers:

```csv
url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note
```

Example:

```csv
url,publishedAt,platform,views,likes,favorites,comments,shares,snapshotAt,note
https://example.com/post/1,2026-05-20T09:00:00.000Z,xiaohongshu,1200,96,44,12,5,2026-05-21T09:00:00.000Z,First 24h snapshot
```

Rows are matched to publish records by URL when a URL is present. If the URL is blank, the importer falls back to matching by platform and `publishedAt`.

Metric fields must be non-negative integers. Unsupported platforms, missing headers, empty files, and unmatched rows are shown as invalid preview rows.

## Validation

Latest local verification:

```bash
npm run typecheck
npm test
npm run build
```

All three commands pass in the current `foundation` branch after installing dependencies from `package-lock.json`.

The current test suite covers:

- core assistant helpers and content loop behavior;
- metric CSV parsing and snapshot creation;
- in-memory and SQLite repository workflows;
- schema creation;
- Electron IPC service behavior;
- preload/renderer loader behavior;
- React UI state changes.

## Known Limits

- Assistant behavior is mocked and deterministic; no real model provider is called yet.
- Only Xiaohongshu package generation is surfaced in the current UI.
- Publishing is manual; the app does not log in to platforms or automate posting.
- CSV import is the only implemented metric ingestion path.
- Knowledge items can be listed, but search/filter/edit/grouping is not implemented yet.
- There is no remote sync, server archive, account configuration UI, or packaged installer yet.
- The SQLite implementation uses Node's experimental `node:sqlite` API in this stage.

## Suggested Next Slices

1. Add Knowledge search and filtering by column, tag, project title, and lesson text.
2. Split the large renderer `App.tsx` into focused screen components and workflow hooks.
3. Split the SQLite repository into smaller mapper/query/command modules.
4. Add real AI provider adapters behind the existing deterministic assistant boundaries.
5. Add packaged desktop distribution once the local workflow stabilizes.

## Repository Notes

This repository uses concise Conventional Commit-style commit subjects such as:

```text
feat: add review knowledge ui
fix: announce review knowledge feedback
docs: record content loop v0 milestone
```

See `AGENTS.md` for coding conventions, project structure, testing expectations, and security notes.
