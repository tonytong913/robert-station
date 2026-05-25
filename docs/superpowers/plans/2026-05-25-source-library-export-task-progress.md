# Source Library Export Task Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a first usable source library, export layer, and task progress model inspired by `wechat-article-exporter` while keeping Robert Station local-first and manual-first.

**Architecture:** Extend the existing content-loop model instead of adding a separate subsystem. Core owns deterministic source, export, and task helpers; local-store persists the new fields through the existing repository contract; desktop IPC and renderer expose one minimal workflow for adding/filtering sources and exporting project material.

**Tech Stack:** TypeScript ES modules, Electron IPC, React, SQLite via `node:sqlite`, Vitest.

---

## TODO

- [x] Source Library v0: allow manually added source references with platform, author, published date, extraction status, usage status, tags, and excerpt.
- [x] Source Library filters: filter by column, platform, extraction status, usage status, tags, and text.
- [x] Export Center v0: generate Markdown, JSON, and CSV text exports for source references, content projects, review reports, and knowledge items.
- [x] Task Progress Model v0: model import/export/generation task phases with deterministic status transitions.
- [x] Topic Pool upstream: allow source references to attach to topics/projects and mark them as used when they feed a project.
- [x] Repository persistence: persist the new source fields and task runs in memory and SQLite.
- [x] Desktop bridge: validate IPC inputs for creating/filtering sources and exports.
- [x] UI slice: surface source library controls and export actions in the existing taskflow screens.
- [x] Verification: run focused package tests, full `npm test`, and `npm run typecheck`.

## File Structure

- Modify `packages/core/src/types.ts`: add source library fields, export types, and task run types.
- Create `packages/core/src/source-library.ts`: source input validation, creation, filtering, and usage helpers.
- Create `packages/core/src/export-center.ts`: Markdown, JSON, and CSV export text generation.
- Create `packages/core/src/task-progress.ts`: task creation and phase transition helpers.
- Modify `packages/core/src/index.ts`: export the new modules.
- Modify `packages/core/src/content-loop.ts`: seed richer source references.
- Modify `packages/local-store/src/content-loop-repository.ts`: add source/task/export repository methods and in-memory behavior.
- Modify `packages/local-store/src/schema.ts`: add source columns and task table schema.
- Modify `packages/local-store/src/sqlite-content-loop-repository.ts`: map and persist new source/task state.
- Modify `apps/desktop/src/main/ipc-channels.ts`: add source/export/task IPC channel constants.
- Modify `apps/desktop/src/main/content-loop-service.ts`: validate and register new IPC handlers.
- Modify `apps/desktop/src/preload/preload.ts`: expose typed renderer bridge methods.
- Modify `apps/desktop/src/renderer/content-loop-loader.ts`: call the new bridge methods.
- Modify `apps/desktop/src/renderer/stores/content-loop-store.ts`: add UI actions and state refresh.
- Modify `apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx`: add source library/filter affordances.
- Modify `apps/desktop/src/renderer/components/screens/PublishScreen.tsx` or `ReviewScreen.tsx`: add export actions where most relevant.

## Task 1: Core Source Library

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/source-library.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/source-library.test.ts`

- [x] **Step 1: Write failing tests for source creation, filtering, and usage**

Run: `npm --workspace @robert-station/core test -- source-library.test.ts`

Expected: FAIL because `source-library.ts` does not exist.

- [x] **Step 2: Implement source library helpers**

Implement `createManualSourceReference`, `filterSourceReferences`, and `markSourceReferenceUsed`.

- [x] **Step 3: Run focused tests**

Run: `npm --workspace @robert-station/core test -- source-library.test.ts`

Expected: PASS.

## Task 2: Core Export Center

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/export-center.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/export-center.test.ts`

- [x] **Step 1: Write failing tests for Markdown, JSON, and CSV export text**

Run: `npm --workspace @robert-station/core test -- export-center.test.ts`

Expected: FAIL because `export-center.ts` does not exist.

- [x] **Step 2: Implement export helpers**

Implement deterministic text exporters that do not write files directly.

- [x] **Step 3: Run focused tests**

Run: `npm --workspace @robert-station/core test -- export-center.test.ts`

Expected: PASS.

## Task 3: Core Task Progress

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/task-progress.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/task-progress.test.ts`

- [x] **Step 1: Write failing tests for task creation and transitions**

Run: `npm --workspace @robert-station/core test -- task-progress.test.ts`

Expected: FAIL because `task-progress.ts` does not exist.

- [x] **Step 2: Implement task progress helpers**

Implement `createTaskRun`, `advanceTaskRun`, and `failTaskRun`.

- [x] **Step 3: Run focused tests**

Run: `npm --workspace @robert-station/core test -- task-progress.test.ts`

Expected: PASS.

## Task 4: Repository Persistence

**Files:**
- Modify: `packages/local-store/src/content-loop-repository.ts`
- Modify: `packages/local-store/src/schema.ts`
- Modify: `packages/local-store/src/sqlite-content-loop-repository.ts`
- Test: `packages/local-store/src/content-loop-repository.test.ts`
- Test: `packages/local-store/src/sqlite-content-loop-repository.test.ts`
- Test: `packages/local-store/src/schema.test.ts`

- [x] **Step 1: Write failing repository tests**

Run: `npm --workspace @robert-station/local-store test -- content-loop-repository.test.ts sqlite-content-loop-repository.test.ts schema.test.ts`

Expected: FAIL until repository methods and schema are added.

- [x] **Step 2: Implement in-memory and SQLite persistence**

Add new state fields and persist source/task data with migrations compatible with existing empty databases.

- [x] **Step 3: Run focused repository tests**

Run: `npm --workspace @robert-station/local-store test -- content-loop-repository.test.ts sqlite-content-loop-repository.test.ts schema.test.ts`

Expected: PASS.

## Task 5: Desktop IPC And UI

**Files:**
- Modify: `apps/desktop/src/main/ipc-channels.ts`
- Modify: `apps/desktop/src/main/content-loop-service.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/content-loop-loader.ts`
- Modify: `apps/desktop/src/renderer/stores/content-loop-store.ts`
- Modify: `apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx`
- Modify: `apps/desktop/src/renderer/components/screens/ReviewScreen.tsx`
- Test: `apps/desktop/src/renderer/content-loop-service.test.ts`
- Test: `apps/desktop/src/renderer/content-loop-loader.test.ts`
- Test: `apps/desktop/src/renderer/stores/content-loop-store.test.ts`
- Test: `apps/desktop/src/renderer/App.test.tsx`

- [x] **Step 1: Write failing desktop tests**

Run: `npm --workspace @robert-station/desktop test -- content-loop-service.test.ts content-loop-loader.test.ts content-loop-store.test.tsx App.test.tsx`

Expected: FAIL until IPC, store, and UI are wired.

- [x] **Step 2: Implement desktop bridge and UI**

Add source library controls and export actions using existing screen/component styles.

- [x] **Step 3: Run focused desktop tests**

Run: `npm --workspace @robert-station/desktop test -- content-loop-service.test.ts content-loop-loader.test.ts content-loop-store.test.tsx App.test.tsx`

Expected: PASS.

## Task 6: Final Verification

**Files:**
- Modify: `README.md` if behavior descriptions need updating.

- [x] **Step 1: Run full tests**

Run: `npm test`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [x] **Step 3: Run build if typecheck and tests pass**

Run: `npm run build`

Expected: PASS.

## Self-Review

- Spec coverage: The plan covers the five inspiration points as source library, export center, task progress, topic upstream attachment, and richer filtering/table-like operation.
- Placeholder scan: No `TBD` placeholders remain; each task has concrete files and commands.
- Type consistency: New core concepts are named `SourceReference`, `TaskRun`, and export helpers consistently across core, store, IPC, and renderer.
