# Content Loop V0 Milestone

Date: 2026-05-20

## Purpose

This milestone records the first end-to-end local content operations loop in Robert Station. The app now supports a single creator moving from topic selection through publishing records, metric import, review, archiving, and reusable knowledge extraction.

## Completed Workflow

The implemented local workflow is:

```text
Topic Pool -> Creation Studio -> Xiaohongshu Package -> Manual Publish -> Metrics Import -> Review Report -> Archive -> Knowledge
```

The loop is intentionally deterministic and local-first. It does not call real AI providers yet, but the package boundaries match the intended production shape: `@robert-station/core` owns deterministic domain helpers, `@robert-station/local-store` owns persistence workflows, and `apps/desktop` exposes them through Electron IPC, preload APIs, and React UI.

## Current Capabilities

- Generate candidate topics for the configured content columns.
- Promote a topic into a content project with a draft package.
- Generate a Xiaohongshu-ready platform package.
- Record manual publish time, URL, and notes.
- Import metric CSV rows, preview matches and invalid rows, and save metric snapshots.
- Generate versioned review reports from publish records and optional metrics.
- Archive a content project into an archive record and reusable knowledge item.
- Extract one deterministic review-derived knowledge item after a project is archived.
- Persist content loop state in memory and SQLite.

## Validation Evidence

The latest full verification before this milestone:

- `npm test`: passed across desktop, core, and local-store workspaces.
- `npm run typecheck`: passed for all workspaces.
- `npm run build`: passed for Electron main, preload, renderer, core, and local-store.
- `npm audit --omit=dev`: found 0 vulnerabilities.
- `git diff --check`: passed.
- Bundle boundary check: `apps/desktop/out/main/main.js` exists and does not contain runtime imports from `@robert-station/core` or `@robert-station/local-store`.

## Known Limits

- AI behavior is mocked and deterministic.
- Only Xiaohongshu package generation is visible in the current UI.
- Publishing is manually recorded; the app does not automate platform login or posting.
- CSV import is the only implemented metric ingestion path.
- Knowledge items are listed but not searchable, editable, or grouped.
- No remote sync, account/persona configuration UI, or server archive exists yet.

## Recommended Next Slice

The next focused increment should be `Knowledge Search / Filter V0`.

That slice should keep the current schema and add useful filtering to the Knowledge screen by column, tag, and project/title text. It builds directly on the completed archive and review-knowledge workflows without introducing a larger data-model migration.
