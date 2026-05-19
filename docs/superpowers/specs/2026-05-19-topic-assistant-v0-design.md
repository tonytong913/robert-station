# Topic Assistant V0 Design

Date: 2026-05-19

## Purpose

Add the first usable topic-generation workflow to the desktop client. The user should be able to choose one of the four equal-priority columns and generate new candidate topics that are saved to local SQLite and shown in Topic Pool.

This slice creates the product and technical seam for future AI providers, but it does not call a real cloud model yet.

## Scope

Included:

- Add a deterministic `TopicAssistant` interface and mock implementation.
- Generate candidate topics for AI, finance, parenting, and fitness.
- Preserve source references and pending verification notes for generated topics.
- Persist generated topics through the existing `ContentLoopRepository`.
- Expose topic generation through Electron IPC and preload.
- Add a Topic Pool UI control for selecting a column and generating topics.
- Keep generated topics visible after app reload through SQLite.

Deferred:

- Real cloud model API calls.
- API key storage.
- live trend search or platform scraping.
- fact-review workflow.
- topic deduplication beyond deterministic IDs for this mock provider.
- user-authored topic creation.
- publish packages and data review.

## User Flow

1. User opens Topic Pool.
2. User chooses a column: AI, Finance, Parenting, or Fitness.
3. User clicks `Generate topics`.
4. App asks the local topic assistant for candidate topics.
5. App persists the generated topics and source references.
6. Topic Pool refreshes and shows the new candidates.
7. User can promote any generated topic into a project using the existing flow.

## Architecture

The feature adds one new workflow method behind the existing repository and IPC boundary:

```ts
generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define topic assistant request/result types and deterministic mock topic generation.
- `@robert-station/local-store`: add repository support for inserting generated topics and source references.
- Electron main process: owns the repository and registers `content-loop:generate-topics`.
- Preload: exposes `window.robertStation.contentLoop.generateTopics(columnSlug)`.
- Renderer: calls the preload API, updates state, and renders the generated candidates.

Renderer still does not access the filesystem, database, or future API keys.

## Topic Assistant

The first assistant is deterministic so tests and early UX are stable. It should return realistic topic cards for each column, but it must clearly behave as a local mock provider.

Each generated topic includes:

- column slug;
- title;
- hook;
- audience;
- target platforms;
- score;
- source reference note;
- pending verification note in the source/reference text.

The assistant should produce two topics per generation request. IDs should include the column slug and a stable suffix so repeated generation for the same column does not create duplicates in this v0 implementation.

Example AI topic shape:

- title: `3 AI workflow automations a solo creator can build this week`
- hook: `Start with repeatable handoffs instead of chasing every new tool.`
- source note: `Mock assistant seed. Verify tool availability, pricing, and platform rules before publishing.`

## Persistence

`ContentLoopRepository` will gain `generateTopics(columnSlug)`.

For SQLite:

- call the deterministic topic assistant;
- insert generated topics into `topics`;
- insert generated source references into `source_references`;
- use a transaction;
- return the full loaded state.

For in-memory:

- call the same deterministic topic assistant;
- add generated topics and source references unless their IDs already exist;
- return a cloned state.

Repeated generation for the same column should be idempotent for v0. This keeps the UI predictable until a real provider returns variable topic batches.

## UI

Topic Pool gets a compact generation bar above the topic grid:

- column selector using the existing four column names;
- `Generate topics` button;
- disabled/loading state while the request is in flight.

After generation:

- candidate count updates;
- generated topics appear in the same cards as seeded topics;
- existing promote behavior continues to work.

If generation fails, the UI should show a short inline error message and keep existing topics intact.

## Error Handling

Repository generation errors should reject through IPC. Renderer catches the error and shows a readable message:

```text
Could not generate topics. Try again.
```

The app does not retry automatically in v0.

## Testing

Core tests:

- deterministic assistant returns two topics for a column;
- topic IDs are stable;
- generated topics carry source references and verification notes.

Local-store tests:

- in-memory repository generates topics and source references;
- SQLite repository persists generated topics across repository instances;
- repeated generation for the same column does not duplicate topics.

Renderer tests:

- Topic Pool shows the generation controls;
- clicking `Generate topics` calls preload API with the selected column;
- generated topic appears after the API resolves;
- errors render an inline message.

## Success Criteria

This slice is complete when:

1. User can generate mock topics for any of the four columns from Topic Pool.
2. Generated topics are persisted to SQLite.
3. Reloading the repository returns generated topics.
4. Existing promote-to-project flow works for generated topics.
5. Full workspace test, typecheck, build, and production dependency audit pass.
