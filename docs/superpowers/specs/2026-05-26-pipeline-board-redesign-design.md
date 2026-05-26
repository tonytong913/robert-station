# Pipeline Board Redesign Design

## Context

Robert Station is currently organized as a Chinese-first desktop taskflow with six top-level pages:
`总览 / 选题 / 创作 / 发布 / 复盘 / 知识库`. That structure helped split the original large renderer into focused screens, but it still asks users to decide which tool page to visit next.

The product should now become a pipeline-first content operations workbench. The primary question should be: where is this content item in the production line, and what is the next action?

This redesign uses the `ui-ux-pro-max` skill as a UI/UX guide, filtered for a dense operational desktop app rather than a marketing dashboard. The relevant rules are clear active states, keyboard navigation, predictable task progression, accessible labels, stable layouts, and concise information density.

## Goals

- Make the pipeline board the main product surface.
- Replace the six top-level task pages with fewer top-level entries.
- Show content items by stage: candidate, planned, drafting, ready to publish, published, and learning.
- Move topic, creation, publish, and review actions into a selected item detail panel.
- Preserve existing Electron IPC, core domain behavior, persistence behavior, and store actions.
- Keep the warm, quiet desktop visual system, while increasing scan efficiency.
- Add focused tests for pipeline stage derivation, navigation, and item details.

## Non-Goals

- Do not redesign `packages/core` domain entities in this slice.
- Do not add new backend or sync behavior.
- Do not add drag-and-drop between stages yet.
- Do not add batch operations in the first pipeline slice.
- Do not add browser-based visual mockups for this design.
- Do not remove existing behavior until the pipeline covers the same actions.

## Information Architecture

The top-level navigation becomes:

| Screen | Purpose |
| --- | --- |
| `流水线` | Main workbench. Shows all content items by production stage and exposes the next action for the selected item. |
| `素材库` | Source references, links, notes, claims, and risks. Can create topics from reusable sources. |
| `知识库` | Long-term knowledge created from archives and review extraction. It should not mix temporary sources with durable lessons. |
| `导出` | Export and backup workflows. If the first implementation keeps export small, this may begin as a simple auxiliary screen. |

The previous `选题 / 创作 / 发布 / 复盘` pages stop being top-level destinations. Their useful workflows move into the pipeline board detail panel.

## Pipeline Stages

The pipeline uses six conceptual stages:

| Stage | Chinese label | Primary source |
| --- | --- | --- |
| `candidate` | `候选选题` | Topics that are not promoted into projects. |
| `planned` | `已立项` | Projects that exist but need drafting or setup. |
| `drafting` | `草稿中` | Projects with draft work but no platform package ready for publishing. |
| `readyToPublish` | `待发布` | Projects with a platform package but no publish record. |
| `published` | `已发布` | Projects with a publish record and no review report yet. |
| `learning` | `复盘沉淀` | Projects with review reports, archive records, or knowledge items. |

Initial mapping rules:

- `Topic` with status `candidate` or `kept` and no project is shown in `candidate`.
- `ContentProject` with status `topic` is shown in `planned`.
- `ContentProject` with status `drafting` and no platform package is shown in `drafting`.
- A project with a `PlatformPackage` but no `PublishRecord` is shown in `readyToPublish`.
- A project with a `PublishRecord` but no `ReviewReport` is shown in `published`.
- A project with a `ReviewReport`, `ArchiveRecord`, or `KnowledgeItem` is shown in `learning`.
- Archived projects remain visible in `learning`, because they are completed pipeline history.

When a rule can be satisfied in multiple ways, the later lifecycle stage wins. For example, a project with status `drafting` but with a publish record belongs in `published`, not `drafting`.

## Component Architecture

Add a pipeline component area:

```text
apps/desktop/src/renderer/
  pipeline/
    pipeline-model.ts
    pipeline-model.test.ts
  components/
    pipeline/
      PipelineScreen.tsx
      PipelineBoard.tsx
      PipelineColumn.tsx
      PipelineCard.tsx
      PipelineDetailPanel.tsx
      PipelineStageActions.tsx
      PipelineFilters.tsx
    library/
      SourceLibraryScreen.tsx
      KnowledgeLibraryScreen.tsx
```

Existing layout and shared components remain:

```text
components/layout/AppShell.tsx
components/layout/Sidebar.tsx
components/layout/WorkspaceHeader.tsx
components/shared/Button.tsx
components/shared/EmptyState.tsx
components/shared/FieldGroup.tsx
components/shared/Panel.tsx
components/shared/StatusBadge.tsx
```

`AppShell` continues to own the desktop chrome. It routes fewer top-level screens:

```ts
type AppScreen = "pipeline" | "sources" | "knowledge" | "exports"
```

The old screen components may remain temporarily while pipeline components are introduced, but they should no longer be the final top-level interaction model.

## Pipeline Model

Pipeline stage derivation should live in pure functions, not directly inside React components.

Core types:

```ts
export type PipelineStage =
  | "candidate"
  | "planned"
  | "drafting"
  | "readyToPublish"
  | "published"
  | "learning"

export type PipelineItem =
  | { kind: "topic"; stage: "candidate"; topicId: string }
  | { kind: "project"; stage: Exclude<PipelineStage, "candidate">; projectId: string }
```

View models:

```ts
export type PipelineColumnViewModel = {
  stage: PipelineStage
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  items: PipelineCardViewModel[]
}

export type PipelineCardViewModel = {
  item: PipelineItem
  title: string
  columnLabel: string
  statusLabel: string
  primaryMetricLabel: string
  primaryMetricValue: string
  warningLabel: string | null
  updatedAt: string
}

export type PipelineDetailViewModel = {
  item: PipelineItem
  title: string
  stage: PipelineStage
  statusLabel: string
  primaryAction: PipelineAction | null
  secondaryActions: PipelineAction[]
  sections: PipelineDetailSection[]
}
```

Functions:

```ts
buildPipelineColumns(contentLoop, filters): PipelineColumnViewModel[]
resolvePipelineDetail(contentLoop, selectedItem): PipelineDetailViewModel | null
```

Components should consume these view models. They should not repeatedly inspect `topics`, `projects`, `drafts`, `platformPackages`, `publishRecords`, `reviewReports`, `archiveRecords`, and `knowledgeItems` themselves.

## Store Changes

The renderer store keeps existing business actions, but adds pipeline selection and filters:

```ts
pipelineStageFilter: PipelineStage | "all"
selectedPipelineItem: PipelineItem | null
selectPipelineItem(item: PipelineItem): void
setPipelineStageFilter(stage: PipelineStage | "all"): void
```

The existing actions remain the main behavior boundary:

- `generateTopics()`
- `promoteTopic()`
- `generateDraftPackage()`
- `generatePlatformPackage()`
- `recordManualPublish()`
- `importMetricCsv()`
- `saveMetricImport()`
- `generateReviewReport()`
- `extractReviewKnowledge()`
- `archiveProject()`
- `addSourceReference()`
- `createTopicFromSourceReference()`
- `createContentLoopExport()`

Actions that advance a content item should keep the user in the pipeline and update the selected card. For example, `promoteTopic()` should leave the user on `pipeline` and select the newly created project card in the appropriate stage.

## Detail Panel Actions

`PipelineDetailPanel` is the main replacement for the old task pages. It always answers three questions:

1. What state is this item in?
2. What is the next best action?
3. What context or artifacts already exist?

Stage actions:

| Stage | Primary action | Secondary actions |
| --- | --- | --- |
| `candidate` | `转为项目` | `生成更多选题` |
| `planned` | `生成草稿包` | `查看素材`, `归档` |
| `drafting` | `生成小红书包` | `重新生成草稿包`, `归档` |
| `readyToPublish` | `保存发布记录` | `查看平台包` |
| `published` | `生成复盘报告` | `导入指标`, `保存指标导入` |
| `learning` | `沉淀为知识` when applicable | `查看归档摘要`, `导出` |

Each stage should have at most one primary action. Destructive or finalizing actions, such as archive, should be visually subdued and placed below the main workflow actions.

## Visual And Interaction Design

The first viewport of the desktop app should be the actual workbench, not a landing page.

Desktop layout:

```text
Left: compact navigation
Top: workspace context and metrics
Center: horizontal pipeline board
Right: selected item detail panel
```

Narrow layout:

```text
Top: compact workspace context
Main: stage tabs plus one stage list
Below or overlay: selected item detail panel
```

Pipeline columns:

- Stable column width around 280px.
- Column header includes stage name and item count.
- Column header remains sticky within the board scroll area.
- Empty columns show a short next-step message.
- Board-level horizontal scrolling is allowed, but page-level horizontal overflow is not.

Cards:

- Title should wrap to at most two lines.
- Include a column badge and stage/status badge.
- Candidate cards show `热度 / 匹配 / 难度`.
- Project cards show one stage-relevant gap, such as missing package, missing URL, missing metrics, or missing review.
- Active card uses more than color: border, state text, or `aria-current`.

Detail panel:

- Shows current state, primary next action, secondary actions, and context sections.
- Uses collapsible or clearly separated sections for draft, package, publish record, metrics, review report, source references, archive, and knowledge.
- Shows async loading text on the action that is running.
- Shows errors close to the action that caused them.

Filters:

- Column filter: `全部 / AI / 财务 / 亲子 / 健身`
- Platform filter: `全部 / 小红书 / 抖音 / 视频号 / B站`
- Stage filter: `全部 / 候选 / 已立项 / 草稿中 / 待发布 / 已发布 / 复盘沉淀`
- Search: title and hook

Batch operations are intentionally deferred. First version global actions are limited to `生成更多选题` and `添加素材`.

## Accessibility Requirements

The implementation must follow these `ui-ux-pro-max` rules:

- All cards are keyboard-selectable with Enter and Space.
- Card tab order matches the visual order.
- Icon-only controls have `aria-label`.
- Active nav, active stage, and active card are visible without relying only on color.
- Pipeline board has an `aria-label`.
- Form fields have visible labels.
- Focus rings remain visible.
- Error messages use `role="alert"` near the relevant control.
- Status updates use `role="status"` or `aria-live` when useful.
- Heading hierarchy remains sequential.
- Text fits its container at desktop and narrow widths.

## Empty States

Empty states give a concrete next action:

- `候选选题`: `还没有候选选题。先选择栏目并生成一组选题。`
- `已立项`: `候选选题转为项目后，会出现在这里。`
- `草稿中`: `项目进入创作后，在这里生成草稿和平台包。`
- `待发布`: `生成平台包后，内容会进入待发布。`
- `已发布`: `保存发布记录后，可以导入指标并进入复盘。`
- `复盘沉淀`: `生成复盘报告后，可以沉淀为知识。`

## Migration Plan

1. Add `pipeline-model.ts` and tests for stage derivation.
2. Add pipeline UI components while keeping old task screens available internally.
3. Add pipeline selection and filters to `content-loop-store.ts`.
4. Switch top-level navigation to `流水线 / 素材库 / 知识库 / 导出`.
5. Move topic, creation, publish, and review actions into `PipelineStageActions`.
6. Stop routing to old task screens from the sidebar.
7. Remove or reduce old task screen components once pipeline coverage is complete.
8. Finalize responsive CSS, active states, focus states, loading states, and empty states.

This order preserves behavior while changing the product surface.

## Testing Strategy

Add or update:

- `pipeline-model.test.ts` for topic and project stage derivation.
- Store tests for pipeline selection after lifecycle actions.
- App navigation tests for the new top-level labels.
- Pipeline screen tests for card selection, detail rendering, primary action visibility, and empty states.
- Existing i18n tests for new translation keys.

Before handoff, run:

```bash
npm test
npm run typecheck
```

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Stage derivation becomes ambiguous. | Keep lifecycle rules in pure tested functions. Later stages win when multiple artifacts exist. |
| Old workflow behavior disappears. | Add pipeline in parallel, then switch navigation once actions are covered. |
| Store becomes too large. | Keep domain actions in the store, but keep pipeline derivation in pure model functions. |
| Board becomes too dense. | Cards show only stage-relevant information; detail panel carries full context. |
| Accessibility regresses in custom board UI. | Test keyboard selection, focus states, labels, active states, and alert/status messaging. |
| Existing uncommitted changes are overwritten. | Keep this redesign focused on renderer files and read touched files before editing them. |

## Open Implementation Notes

- The first implementation can keep `exports` minimal if the existing export workflow is small.
- Drag-and-drop may be added later only after lifecycle transitions are explicit and reversible.
- The pipeline should not invent new domain states until the current entity model is insufficient.
