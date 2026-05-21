# Desktop Taskflow Redesign Design

## Context

Robert Station is moving from an early single-screen renderer into a desktop workbench for repeated content operations. The current renderer keeps most UI state, async actions, navigation, and English copy inside `apps/desktop/src/renderer/App.tsx`. That was acceptable for the first content-loop slice, but the product now needs a clearer desktop architecture before more workflows are added.

The redesign follows the cc-haha desktop direction: a calm desktop shell, warm paper-like surfaces, low-noise boundaries, Chinese-first copy, and componentized task areas. It does not copy cc-haha's chat product structure. Robert Station remains a content operations workbench.

## Goals

- Reorganize the client around taskflow navigation: `总览 / 选题 / 创作 / 发布 / 复盘 / 知识库`.
- Keep project context visible across task pages without making projects the top-level navigation.
- Add Zustand now so future cross-page state does not keep accumulating in `App.tsx`.
- Add a lightweight i18n layer with Simplified Chinese as the default locale.
- Restyle the desktop client with the cc-haha-inspired warm, quiet, utility-focused design language.
- Preserve existing Electron IPC, core package behavior, and local persistence behavior.
- Update renderer tests around the new Chinese UI and taskflow behavior.

## Non-Goals

- Do not rewrite `packages/core` or `packages/local-store` domain logic.
- Do not add a language settings page in this slice.
- Do not add remote sync, account management, or a new backend.
- Do not add a full cc-haha-style tab system yet.
- Do not turn content columns into the highest-level navigation.

## Information Architecture

The top-level desktop navigation becomes task-oriented:

| Task | Purpose |
| --- | --- |
| `总览` | Show content-loop health, candidate topic count, active project count, publish/review readiness, and column distribution. |
| `选题` | Generate, inspect, filter, and promote candidate topics. Content columns are filters and metadata here. |
| `创作` | Work on the selected project draft, source references, draft package generation, platform package generation, and archive action. |
| `发布` | Record publish metadata, import metric CSV files, preview import results, and save matched metrics. |
| `复盘` | Generate review reports for published records and extract review knowledge. |
| `知识库` | Browse knowledge items created from archives and review extraction. |

This combines the selected direction:

- Taskflow is the main skeleton.
- The current project is the persistent context.
- Content columns such as AI, finance, parenting, and fitness remain filter and classification dimensions.

The shell should include a current-project context area that displays the selected project title, status, column, selected package/publish state, and high-level counts. Empty task pages must explain the next concrete step in Chinese, for example prompting the user to promote a topic before entering creation.

## State Architecture

Add `zustand` and use two renderer stores.

### `stores/content-loop-store.ts`

This store owns business workflow state:

- persisted content-loop state
- current task screen
- selected project id
- selected publish record id
- selected review report id
- loading state
- async action flags
- domain-facing errors
- content-loop actions that call `content-loop-loader.ts`

All existing IPC-facing actions should move behind store actions:

- load content loop
- promote topic
- generate topics
- generate draft package
- generate platform package
- archive project
- record manual publish
- import metrics CSV
- save metric import
- generate review report
- extract review knowledge

Store actions should include comments where the workflow has non-obvious constraints. In particular, review/report actions need stale-response protection so a response for an old selected publish record or review report does not overwrite the currently visible task state.

### `stores/ui-store.ts`

This store owns UI-only state:

- locale, defaulting to `zh`
- sidebar collapsed/open state
- task filters that are not persisted domain state
- transient toast or feedback state if needed by the new shell

The boundary is intentional: business data and workflow transitions belong to `content-loop-store`; visual preferences and pure UI controls belong to `ui-store`.

## Component Architecture

The renderer should move away from a large single `App.tsx`.

Planned structure:

```text
apps/desktop/src/renderer/
  App.tsx
  components/
    layout/
      AppShell.tsx
      Sidebar.tsx
      WorkspaceHeader.tsx
    screens/
      DashboardScreen.tsx
      TopicScreen.tsx
      CreationScreen.tsx
      PublishScreen.tsx
      ReviewScreen.tsx
      KnowledgeScreen.tsx
    shared/
      Button.tsx
      EmptyState.tsx
      FieldGroup.tsx
      Panel.tsx
      StatusBadge.tsx
  i18n/
    index.ts
    locales/
      en.ts
      zh.ts
  stores/
    content-loop-store.ts
    ui-store.ts
```

Responsibilities:

- `App.tsx` bootstraps store loading and renders `AppShell`.
- `AppShell` composes the sidebar, workspace header, and active task screen.
- `Sidebar` renders the taskflow navigation in Chinese with icons and active state.
- `WorkspaceHeader` shows current project context and key counts.
- Screen components subscribe only to the store slices they need.
- Shared components define consistent button, panel, badge, field, and empty-state behavior.

## i18n Design

Add a lightweight i18n module modeled after cc-haha's approach.

`i18n/locales/zh.ts` is the product default and contains the first complete Simplified Chinese UI copy set.

`i18n/locales/en.ts` keeps English values for key parity and future switching. It does not need a settings page in this slice.

`i18n/index.ts` exports:

- `translate(locale, key, params)`
- `useTranslation()`
- `TranslationKey`
- `Locale`

Interpolation should support simple `{name}` replacement so counts and selected names can be localized without hard-coded string concatenation.

## Visual Design

The desktop client should shift away from the current dark sidebar plus teal dashboard style.

Design tokens:

| Token | Value | Purpose |
| --- | --- | --- |
| surface | `#FAF9F5` | Main warm workbench surface. |
| surface-low | `#F4F4F0` | Sidebar and recessed utility areas. |
| surface-raised | `#FFFFFF` | Active panels and cards. |
| text-primary | `#1B1C1A` | Primary text, avoiding pure black. |
| text-secondary | `#5F5D58` | Secondary metadata and helper text. |
| text-tertiary | `#8A8580` | Muted labels and empty states. |
| border-subtle | `#E4E0D8` | Low-noise boundaries where required. |
| brand | `#8F482F` | Warm primary action color. |
| brand-soft | `#FFDBD0` | Soft highlight and warning surface. |
| success | `#677B4E` | Positive workflow state. |
| danger | `#AB2B3F` | Error state. |
| info | `#2D628F` | Informational accents. |

Layout principles:

- Use surface shifts instead of heavy dividing lines where possible.
- Keep panels dense enough for daily operations; avoid landing-page composition.
- Use 8px to 12px radii for panels and controls.
- Prefer quiet shadows only for floating elements.
- Keep mobile and narrow windows usable with one-column task content and non-overflowing Chinese labels.
- Use lucide icons for navigation and action affordances if `lucide-react` is added with the implementation.

## Copy Direction

Default interface language is Simplified Chinese.

Examples:

- `Dashboard` -> `总览`
- `Topic Pool` -> `选题`
- `Creation Studio` -> `创作`
- `Knowledge` -> `知识库`
- `Generate topics` -> `生成选题`
- `Promote to project` -> `转为项目`
- `Generate draft package` -> `生成草稿包`
- `Generate Xiaohongshu package` -> `生成小红书包`
- `Save publish record` -> `保存发布记录`
- `Extract knowledge` -> `沉淀为知识`

Error copy should also be Chinese and action-oriented. For example, `Could not generate topics. Try again.` becomes `选题生成失败，请重试。`

## Migration Plan

Implementation should preserve behavior first, then replace the shell.

1. Add dependencies and i18n/store scaffolding.
2. Move current async behavior into `content-loop-store.ts`.
3. Build `AppShell`, sidebar, header, and shared components.
4. Split the current UI into six task screens without changing domain behavior.
5. Replace English copy with translation keys.
6. Apply the warm desktop visual system in `styles.css` or a small theme CSS module.
7. Update and extend renderer tests.

This order keeps the IPC and persistence contract stable while the renderer structure changes.

## Testing Strategy

Update existing renderer tests and add focused coverage for:

- default Simplified Chinese rendering
- taskflow navigation between `总览 / 选题 / 创作 / 发布 / 复盘 / 知识库`
- promoting a topic and carrying the selected project into `创作`
- publish form behavior after moving publishing into its own task page
- review report and review knowledge actions after moving review into `复盘`
- async error display on the correct task page
- stale response protection for publish/report-dependent async actions
- `translate()` fallback and interpolation
- store actions calling the existing IPC loader functions

Verification before handoff should include:

```text
npm test
npm run typecheck
npm run build
```

## Documentation And Comments

Code comments should be detailed where they explain architecture or non-obvious workflow behavior:

- why the two stores are separate
- why certain async actions check the current selected record before applying state
- why task screens own only one workflow area
- how i18n fallback works

Comments should not repeat obvious JSX or CSS details.
