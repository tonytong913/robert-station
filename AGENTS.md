# Repository Guidelines

## Project Structure & Module Organization

This is a private npm workspace for a TypeScript Electron app. The desktop client lives in `apps/desktop`: Electron main code is in `src/main`, preload code in `src/preload`, React renderer code in `src/renderer`, and the HTML entry is `index.html`. Shared domain logic lives in `packages/core/src`. Local persistence implementations, including file and SQLite repositories, live in `packages/local-store/src`. Planning and design notes are kept under `docs/superpowers`.

## Build, Test, and Development Commands

- `npm install`: install workspace dependencies from `package-lock.json`.
- `npm run dev:desktop`: start the Electron desktop app via `electron-vite`.
- `npm run build`: build all workspaces that expose a build script.
- `npm run typecheck`: run strict TypeScript checks across workspaces.
- `npm test`: run all workspace Vitest suites.
- `npm --workspace @robert-station/core test`: run one package test suite when iterating.

## Coding Style & Naming Conventions

Use TypeScript ES modules and keep imports explicit. The project uses strict compiler settings from `tsconfig.base.json`, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; avoid loose optional handling. Follow the existing style: two-space indentation, double quotes, semicolons omitted, `camelCase` functions and variables, `PascalCase` React components and exported types, and kebab-case filenames such as `content-loop-service.ts`.

## Testing Guidelines

Vitest is the test runner. Place tests next to implementation files with `.test.ts` or `.test.tsx` suffixes, matching the existing layout in `packages/*/src` and `apps/desktop/src/renderer`. Renderer tests run with jsdom and `src/renderer/test-setup.ts`. Add focused tests for new domain behavior, repository persistence rules, IPC-facing service behavior, and UI state changes. Run `npm test` and `npm run typecheck` before handing off changes.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit-style subjects such as `feat: add metrics csv import ui`, `fix: scope metrics import preview to publish record`, and `test: update desktop repository mock for metrics import`. Keep subjects imperative and scoped to one change. Pull requests should include a short behavior summary, tests run, linked issue or plan when available, and screenshots or short clips for visible desktop UI changes.

## Security & Configuration Tips

Do not commit generated build output, local databases, credentials, or personal workspace data. Keep Electron IPC channel names centralized in `apps/desktop/src/main/ipc-channels.ts` and validate data at package boundaries before persisting it.
