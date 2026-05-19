# Creation Assistant V0 Design

Date: 2026-05-19

## Purpose

Upgrade Creation Studio from a thin promoted-topic draft into a usable first-material generator. After a topic becomes a content project, the user should be able to generate a fuller draft package that includes a brief, title options, body draft, cover copy, tag suggestions, and verification notes.

This slice creates the creation-assistant seam for future cloud model calls. It remains deterministic and local in v0.

## Scope

Included:

- Add a deterministic mock creation assistant.
- Generate a new `DraftVersion` for a selected content project.
- Use the project, source topic, and source references as assistant inputs.
- Include brief, title options, body draft, cover copy, tag suggestions, visual direction, and pending verification notes in the draft body.
- Persist generated draft versions in SQLite.
- Expose draft generation through Electron IPC and preload.
- Add a `Generate draft package` action in Creation Studio.
- Render the newest selected draft and preserve source/verification context.

Deferred:

- Real cloud model calls.
- prompt templates and prompt history.
- API key storage.
- fact-review system.
- separate publish-package entities.
- image generation or asset files.
- human edit tracking.

## User Flow

1. User opens Topic Pool.
2. User promotes a topic into a content project.
3. Creation Studio shows the initial draft version.
4. User clicks `Generate draft package`.
5. App generates a richer assistant draft package and saves it as the next draft version.
6. Creation Studio refreshes to the latest draft version.
7. Sources remain visible so the user can review context before publishing.

## Architecture

The feature adds one repository workflow:

```ts
generateDraftPackage(projectId: string): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define mock creation assistant inputs and deterministic output.
- `@robert-station/local-store`: create the next `DraftVersion` for a project and persist it.
- Electron main process: validates the project ID shape enough for IPC and delegates to the repository.
- Preload: exposes `window.robertStation.contentLoop.generateDraftPackage(projectId)`.
- Renderer: adds a Creation Studio button, loading state, error state, and refreshes from the returned state.

Renderer still does not access the database, filesystem, or future API keys.

## Mock Creation Assistant

The v0 assistant takes:

- `ContentProject`
- source `Topic` when available
- related `SourceReference[]`
- next draft version number
- timestamp

It returns a `DraftVersion`.

The body is plain text with stable section labels:

```text
Brief
...

Title Options
1. ...
2. ...
3. ...

Body Draft
...

Cover Copy
...

Tag Suggestions
...

Visual Direction
...

Pending Verification
...
```

The generated copy should be useful but conservative. It must not invent factual claims beyond the topic hook, audience, and source notes. Pending verification remains visible because a full fact-review system is deferred.

## Persistence

For each project:

- find the selected project by `projectId`;
- find the source topic by `project.sourceTopicId`;
- find related source references by topic ID or project ID;
- compute the next draft version as `max(version) + 1`;
- insert one new assistant-created `DraftVersion`;
- keep existing draft versions instead of overwriting them;
- return the full loaded content-loop state with `selectedProjectId` set to the project.

Repeated clicks intentionally create new draft versions. This supports later human comparison and prompt iteration.

If the project does not exist, return the current state without inserting a draft.

## UI

Creation Studio gets a compact action bar above the draft panel:

- `Generate draft package` button;
- disabled/loading state while generation is running;
- inline error message when generation fails.

The existing draft display remains text-first. It should show the latest draft version for the selected project. Source references should include both topic-level and project-level references if present.

## Error Handling

Repository-level missing project:

- return the current state unchanged.

IPC-level invalid project ID:

- reject with a clear error.

Renderer-level failure:

- show:

```text
Could not generate draft package. Try again.
```

Existing draft content must remain visible when generation fails.

## Testing

Core tests:

- mock creation assistant produces stable section labels;
- next draft version and draft ID are deterministic from project/version;
- source notes appear in the pending verification area.

Local-store tests:

- in-memory repository creates the next draft version;
- SQLite repository persists generated draft versions across repository instances;
- missing project does not insert drafts.

Desktop tests:

- preload/loader calls `generateDraftPackage(projectId)`;
- Creation Studio button generates a new draft package and displays `Draft v2`;
- generation failure shows an inline error and keeps the previous draft visible.

## Success Criteria

This slice is complete when:

1. A promoted project can generate a richer draft package from Creation Studio.
2. The generated draft package is saved as a new `DraftVersion`.
3. The new draft version survives SQLite repository reload.
4. Existing topic generation and promote flows still work.
5. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
