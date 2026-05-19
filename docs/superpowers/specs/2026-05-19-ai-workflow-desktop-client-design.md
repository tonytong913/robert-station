# AI Workflow Desktop Client Design

Date: 2026-05-19

## Purpose

Build a cross-platform desktop client for a single creator running a flexible content operation across multiple columns, platforms, and future account structures.

The first version is a content production workbench, not only a writing assistant. It should support a full loop:

`Workspace setup -> topic discovery -> draft creation -> platform publish packages -> manual publishing -> data import -> review -> knowledge archive`

## Confirmed Product Direction

- Desktop stack: Electron + React + TypeScript.
- AI strategy: cloud model APIs first.
- User type: single creator first.
- Archive strategy: local working copy plus self-hosted server archive.
- Deployment: local development first, then single-machine ECS deployment.
- Content type: image/text content first, with short-video fields reserved for later.
- Publishing: publish assistant only; no automatic platform login or posting in v1.
- Data collection: CSV/Excel import first; OCR/screenshot/text parsing as fallback.
- Remote archive: self-hosted backend first; Baidu Netdisk may be added later as export or backup, not the primary system of record.

## Content Operation Model

The app must not hard-code one account strategy. It should support the current likely setup and future account splits through a flexible matrix:

`Workspace -> Persona -> PlatformAccount -> Column -> ContentProject`

This supports:

- one persona with mixed columns in one platform account;
- several platform accounts under the same persona;
- separate personas or accounts for specific columns later;
- review by persona, platform, column, and individual content project.

The first configured columns are equal in priority:

- AI: AI tools, AI workflows, AI workstation setups, productivity, AI knowledge explainers.
- Finance: personal finance, tools, methods, and learning notes.
- Parenting: child raising, family workflows, daily problem solving.
- Fitness: swimming, gym training, habit building, equipment, and plans.

## Core Modules

### Workspace Configuration

Configure the operating structure:

- workspace;
- persona or brand;
- platform accounts;
- columns;
- target audience;
- writing style;
- risk rules;
- common tags;
- topic sources;
- cloud model API settings;
- server sync endpoint;
- local repository path.

### Topic Pool

AI actively gathers trends, references, and candidate topics by column.

Each topic card should include:

- column;
- target platform;
- title idea;
- audience;
- hook;
- source references;
- key facts;
- pending verification points;
- risk notes;
- scores for heat, fit, difficulty, and account/persona consistency.

User actions:

- keep;
- discard;
- merge;
- tag;
- turn into content project.

### Creation Studio

Turn a selected topic into a content project.

Main capabilities:

- generate brief;
- summarize sources and evidence;
- generate title options;
- generate image/text draft;
- generate cover text;
- generate tag suggestions;
- suggest images or visual direction;
- track pending verification points;
- save draft versions;
- record prompts, model outputs, and human edits.

The first version should not implement a full fact-review system, but every generated project must preserve sources, key claims, and pending verification points.

### Publish Assistant

Generate platform-specific packages for Xiaohongshu, Douyin, WeChat Channels, and Bilibili.

The assistant should:

- adapt title, body, tags, and cover text per platform;
- check simple platform constraints such as title length, tag count, image count, and body structure;
- produce a copy-ready package;
- list required assets;
- let the user record publish status, publish time, and final URL.

It must not automate login, browser actions, or final publishing in v1.

### Data Import

Import post-performance data after manual publishing.

Priority:

1. CSV/Excel import.
2. Screenshot, OCR, pasted text, or copied table parsing.

The import flow should:

- preview parsed rows;
- map fields to standard metrics;
- match rows to publish records;
- allow manual correction;
- create metric snapshots.

### Review And Knowledge

Analyze content performance and archive useful conclusions.

Review levels:

- single content project;
- column;
- platform;
- persona/account;
- cross-column mix.

The review assistant should generate:

- what worked;
- what underperformed;
- likely causes;
- title, cover, topic, timing, and platform-fit observations;
- next topic suggestions;
- reusable knowledge items.

Knowledge items should be queryable by column, platform, topic, conclusion type, and source content project.

## Data Model

Core entities:

- `Workspace`: top-level operating space.
- `Persona`: creator identity or content brand.
- `PlatformAccount`: platform-specific account under a persona.
- `Column`: content direction such as AI, finance, parenting, fitness.
- `Topic`: candidate idea gathered or created before production.
- `ContentProject`: a concrete content piece or publishing task.
- `DraftVersion`: versioned drafts for a content project.
- `PlatformPackage`: platform-specific package generated from a project.
- `PublishRecord`: actual manual publishing result and URL.
- `MetricSnapshot`: imported performance metrics at a point in time.
- `ReviewReport`: AI or human review result.
- `KnowledgeItem`: reusable conclusion extracted from review.
- `Asset`: image, video, CSV, screenshot, document, or generated file.
- `SourceReference`: link, note, source excerpt, key fact, or pending verification item.

Important relationships:

- one persona can own multiple platform accounts;
- one column can be used by multiple personas or accounts;
- one content project has one primary column and optional secondary tags;
- one content project can generate multiple platform packages;
- one platform package can produce one or more publish records;
- metric snapshots attach to publish records;
- review reports are versioned instead of overwritten;
- knowledge items link back to source projects and reports.

## Technical Architecture

### Desktop Client

Electron client layers:

- Renderer UI: React screens and interaction state.
- Main Process: window management, menus, system APIs, secure IPC.
- Local Service Layer: AI calls, workflows, file management, table parsing, OCR integration, publishing package generation, sync queue.
- Local Storage: SQLite plus a local file repository.

Renderer must not directly access filesystem APIs or API keys.

### Server

First production deployment targets one ECS machine.

Server components:

- Node.js/TypeScript API service.
- Postgres for remote structured archive.
- File storage on local disk for v1 production, with an interface that can later move to object storage.
- Background worker for imports, indexing, review generation, and knowledge extraction.

### Sync

Use explicit sync plus a background queue. Avoid real-time collaboration complexity in v1.

Rules:

- local writes go to SQLite first;
- each syncable entity has `local_id`, `remote_id`, `sync_status`, `updated_at`, and version metadata;
- uploads happen when the user clicks sync or the app is idle;
- draft conflicts default to local update wins for single-user v1;
- publish records and metric snapshots are append-first;
- review reports create new versions instead of overwriting previous reviews.

### AI Workflow

Use workflow steps and specialized assistants, not fully autonomous agents in v1.

Assistants:

- trend and topic assistant;
- research summarization assistant;
- creation assistant;
- platform adaptation assistant;
- data parsing assistant;
- review assistant.

Every run should record:

- input;
- prompt template;
- model;
- output;
- duration;
- errors;
- related entity IDs.

Human confirmation is required before advancing important stages.

### Security

- Store model API keys in macOS Keychain or Windows Credential Manager.
- Renderer requests AI work through IPC and never receives raw secrets.
- Server tokens use secure local storage.
- Keep a predictable local file repository path.
- Allow users to disable uploading sensitive raw AI logs or source material.

## UI Structure

Main navigation:

- Dashboard: pending work, column overview, recent publishes, alerts.
- Columns: column configuration for AI, finance, parenting, and fitness.
- Topic Pool: AI-generated candidate topics and filters.
- Projects: content project list and status pipeline.
- Creation Studio: brief, sources, editor, AI suggestions, verification notes.
- Publish Assistant: platform tabs, packages, checks, copy actions, publish record.
- Data Import: CSV/Excel import, screenshot/text parsing, mapping, preview.
- Review: single-project, column, platform, persona/account reviews.
- Knowledge Base: reusable learnings and search.
- Settings: models, server, local repository, platform accounts, sync.

## Key User Flows

### Initialization

1. Create workspace.
2. Create persona.
3. Configure platform accounts.
4. Create columns: AI, finance, parenting, fitness.
5. Configure model keys.
6. Configure server sync.

### Topic To Draft

1. Select one or more columns.
2. Run topic discovery.
3. Review topic cards.
4. Keep, discard, merge, or convert a topic.
5. Generate brief and first draft.
6. Edit and save draft version.

### Draft To Publish

1. Generate platform packages.
2. Review platform checks.
3. Copy content and assets to each platform manually.
4. Record URL, publish time, and status.
5. Archive the published package.

### Publish To Review

1. Import CSV/Excel where possible.
2. Use screenshot/OCR/text parsing where needed.
3. Confirm field mapping and matched publish records.
4. Generate review report.
5. Extract knowledge items.

## MVP Milestones

### 1. Foundation

- Electron shell.
- React UI frame.
- SQLite schema.
- Local file repository.
- Core entities: workspace, persona, platform account, column, project, asset.

### 2. Content Loop

- Topic pool.
- Content projects.
- Creation editor.
- Cloud AI call integration.
- Brief and first-draft generation.
- Draft versioning.

### 3. Publish And Archive

- Platform packages.
- Platform rule checks.
- Publish records.
- Local archive package.
- Server API and first sync path.

### 4. Data And Review

- CSV/Excel import.
- Screenshot/text parsing fallback.
- Standard metric mapping.
- Single-project review.
- Basic column/platform analysis.

### 5. Knowledge And Polish

- Knowledge item extraction.
- Knowledge search.
- Historical knowledge reference in topic and creation flows.
- Sync stabilization.
- Error handling.
- Build and installer preparation.

## V1 Acceptance Criteria

The first usable version is successful when it can:

1. configure the four equal-priority columns;
2. generate topics for a selected column;
3. turn one topic into an image/text draft;
4. generate at least a Xiaohongshu publishing package;
5. record a manual publish URL;
6. import one data file or parse one screenshot/text sample;
7. generate a review report;
8. sync the archived project to the server;
9. show at least one extracted knowledge item in the knowledge base.

## Explicit Non-Goals For V1

- Automatic posting.
- Automatic platform backend scraping.
- Multi-user collaboration and approval workflow.
- Full short-video editing workflow.
- Full fact-review or evaluation system.
- Baidu Netdisk as primary archive.
- Advanced BI dashboards.
- Real-time sync or CRDT collaboration.

