# Publish Assistant V0 Design

Date: 2026-05-19

## Purpose

Add the first publishing-assistant slice for Xiaohongshu. After a content project has a draft package, the user should be able to generate a copy-ready platform package with title, body, tags, cover text, required asset checklist, and simple platform checks.

This slice stays local and deterministic. It creates the product and code seam for later real model calls, platform-specific variants, fact checks, and post-publish analytics.

## Scope

Included:

- Add a `PlatformPackage` domain model for platform-ready publishing material.
- Add deterministic Xiaohongshu package generation from the selected project's latest draft.
- Persist generated platform packages in SQLite.
- Expose package generation through Electron IPC and preload.
- Add a Creation Studio action for `Generate Xiaohongshu package`.
- Render the latest Xiaohongshu package with copy-ready fields and check results.

Deferred:

- Automatic platform posting.
- publish URL recording.
- post-publish metrics.
- real cloud model calls.
- fact-review scoring.
- asset file creation or uploads.
- support for Douyin, WeChat Channels, or Bilibili packages.

## User Flow

1. User promotes a topic into a content project.
2. User generates or reviews the latest draft package in Creation Studio.
3. User clicks `Generate Xiaohongshu package`.
4. App creates a Xiaohongshu-specific package from the latest draft and saves it.
5. Creation Studio refreshes and shows the latest package for the selected project.
6. User copies the title, body, tags, cover text, and asset checklist into Xiaohongshu manually.

## Architecture

The feature adds one repository workflow:

```ts
generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState>;
```

Layer responsibilities:

- `@robert-station/core`: define `PlatformPackage`, `PlatformPackageCheck`, and deterministic Xiaohongshu package generation.
- `@robert-station/local-store`: find the project and latest draft, generate one package for the project/draft/platform, persist it, and return the refreshed state.
- Electron main process: validate project ID and supported platform, then delegate to the repository.
- Preload: expose `window.robertStation.contentLoop.generatePlatformPackage(projectId, platform)`.
- Renderer: add a Creation Studio action, loading state, error state, and package display.

Renderer does not access the database, filesystem, future API keys, or platform credentials.

## Data Model

Add `PlatformPackage`:

```ts
interface PlatformPackage {
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

Add `PlatformPackageCheck`:

```ts
interface PlatformPackageCheck {
  name: string;
  status: "pass" | "warning";
  message: string;
}
```

SQLite adds `platform_packages`:

- `id`
- `remote_id`
- `workspace_id`
- `content_project_id`
- `draft_version_id`
- `platform`
- `title`
- `body`
- `tags_json`
- `cover_text`
- `required_assets_json`
- `checks_json`
- `sync_status`
- `created_at`
- `updated_at`

The repository state adds:

```ts
platformPackages: PlatformPackage[];
```

## Generation Rules

V0 supports only `platform === "xiaohongshu"`.

The generator takes:

- `ContentProject`
- latest `DraftVersion`
- timestamp

It returns one `PlatformPackage` with:

- title derived from the draft title, shortened to a Xiaohongshu-friendly line when needed;
- body derived from the draft body and framed as a practical note;
- tags extracted from draft tag lines when possible, otherwise column/project fallback tags;
- cover text limited to a short readable phrase;
- required assets such as cover image and 1-3 supporting visuals;
- checks for title length, tag count, non-empty body, and required assets.

IDs are deterministic for the project, draft, and platform:

```text
platform-package_<project-id>-<draft-id>-xiaohongshu
```

Repeated generation for the same project, draft, and platform replaces the existing package instead of creating duplicates. When the user creates a new draft version, generating again creates a new package tied to that draft.

## Persistence

Repository behavior:

- find the selected project by `projectId`;
- find the latest draft for that project by version, then timestamp;
- if project or draft is missing, return current state unchanged;
- reject unsupported platforms at IPC level before repository generation;
- generate the package with the latest draft;
- upsert into `platform_packages`;
- return full content-loop state with `selectedProjectId` set to the project.

Packages are ordered newest first in loaded state.

## UI

Creation Studio adds a publish package section below the draft/source area:

- `Generate Xiaohongshu package` button;
- disabled/loading state while generation runs;
- inline error message when generation fails;
- latest Xiaohongshu package for the selected project.

The package display should be copy-ready:

- Title
- Body
- Tags
- Cover text
- Required assets
- Checks

The design remains text-first and compact. No publish action is shown in v0 because auto posting is explicitly deferred.

## Error Handling

Repository-level missing project or missing draft:

- return the current state unchanged.

IPC-level invalid project ID:

- reject with:

```text
Invalid content project id.
```

IPC-level unsupported platform:

- reject with:

```text
Unsupported publish platform.
```

Renderer-level failure:

- show:

```text
Could not generate Xiaohongshu package. Try again.
```

Existing draft and previously generated package content must remain visible when generation fails.

## Testing

Core tests:

- Xiaohongshu package generation is deterministic for project, draft, and platform.
- generated packages include title, body, tags, cover text, required assets, and checks.
- check statuses warn when the generated package exceeds simple v0 constraints.

Local-store tests:

- in-memory repository generates and stores a platform package.
- repeated generation for the same draft/platform replaces the existing package.
- SQLite repository persists platform packages across repository instances.
- missing project or missing draft does not insert packages.

Desktop tests:

- preload/loader calls `generatePlatformPackage(projectId, "xiaohongshu")`.
- IPC rejects empty project IDs and unsupported platforms.
- Creation Studio button generates and displays a Xiaohongshu package.
- generation failure shows an inline error and keeps existing content visible.

## Success Criteria

This slice is complete when:

1. A selected project with a draft can generate a Xiaohongshu publishing package.
2. The package is saved as a `PlatformPackage`, not embedded into a draft.
3. Regenerating for the same project/draft/platform replaces the prior package.
4. The package survives SQLite repository reload.
5. Creation Studio shows copy-ready package fields and simple check results.
6. Existing topic generation, project promotion, and draft-package generation still work.
7. Full workspace test, typecheck, build, bundle check, and production dependency audit pass.
