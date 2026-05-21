# Desktop Taskflow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Robert Station renderer as a Chinese-first taskflow desktop workbench with Zustand stores, lightweight i18n, componentized screens, and a cc-haha-inspired warm visual system.

**Architecture:** Keep existing Electron IPC, core, and local-store behavior intact while moving renderer state into `content-loop-store` and `ui-store`. `App.tsx` becomes a small bootstrap component, `AppShell` owns the desktop chrome, and six task screens own their workflow areas.

**Tech Stack:** TypeScript, React 19, Electron Vite, Zustand, lucide-react, Vitest, Testing Library, CSS custom properties.

---

## File Structure

### New Files

- `apps/desktop/src/renderer/i18n/locales/zh.ts`
  - Simplified Chinese translation map and exported `zh` object.
- `apps/desktop/src/renderer/i18n/locales/en.ts`
  - English translation map with the same keys as `zh`.
- `apps/desktop/src/renderer/i18n/index.ts`
  - `Locale`, `TranslationKey`, `translate()`, `useTranslation()`, and fallback/interpolation logic.
- `apps/desktop/src/renderer/i18n/index.test.tsx`
  - Translation fallback and interpolation coverage.
- `apps/desktop/src/renderer/stores/ui-store.ts`
  - Locale, sidebar state, and UI-only helpers.
- `apps/desktop/src/renderer/stores/content-loop-store.ts`
  - Business workflow state, derived selectors, and content-loop async actions.
- `apps/desktop/src/renderer/stores/content-loop-store.test.ts`
  - Store action coverage for IPC loader calls and stale response protection.
- `apps/desktop/src/renderer/components/shared/Button.tsx`
  - Shared button primitive with `primary`, `secondary`, and `ghost` variants.
- `apps/desktop/src/renderer/components/shared/EmptyState.tsx`
  - Consistent empty-state block.
- `apps/desktop/src/renderer/components/shared/FieldGroup.tsx`
  - Label/input grouping for dense workflow forms.
- `apps/desktop/src/renderer/components/shared/Panel.tsx`
  - Shared raised/recessed panel primitive.
- `apps/desktop/src/renderer/components/shared/StatusBadge.tsx`
  - Small status chip for project, topic, publish, and review state.
- `apps/desktop/src/renderer/components/layout/AppShell.tsx`
  - Main desktop shell: sidebar, workspace header, active screen router.
- `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
  - Taskflow navigation with lucide icons and translated labels.
- `apps/desktop/src/renderer/components/layout/WorkspaceHeader.tsx`
  - Current project context and high-level content-loop counts.
- `apps/desktop/src/renderer/components/screens/DashboardScreen.tsx`
  - `总览` task screen.
- `apps/desktop/src/renderer/components/screens/TopicScreen.tsx`
  - `选题` task screen.
- `apps/desktop/src/renderer/components/screens/CreationScreen.tsx`
  - `创作` task screen.
- `apps/desktop/src/renderer/components/screens/PublishScreen.tsx`
  - `发布` task screen.
- `apps/desktop/src/renderer/components/screens/ReviewScreen.tsx`
  - `复盘` task screen.
- `apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx`
  - `知识库` task screen.
- `apps/desktop/src/renderer/datetime.ts`
  - Date/time helpers moved out of `App.tsx`.

### Modified Files

- `apps/desktop/package.json`
  - Add `zustand` and `lucide-react`.
- `package-lock.json`
  - Dependency lockfile update.
- `apps/desktop/src/renderer/App.tsx`
  - Replace current large renderer with store bootstrap and `AppShell`.
- `apps/desktop/src/renderer/App.test.tsx`
  - Update user-flow tests to Chinese taskflow labels and split workflow screens.
- `apps/desktop/src/renderer/styles.css`
  - Replace current dark/teal dashboard style with warm desktop tokens and component styles.
- `apps/desktop/src/renderer/test-setup.ts`
  - Reset Zustand stores after each test so store state does not leak.

---

## Task 1: Add Dependencies And i18n Foundation

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `package-lock.json`
- Create: `apps/desktop/src/renderer/i18n/locales/zh.ts`
- Create: `apps/desktop/src/renderer/i18n/locales/en.ts`
- Create: `apps/desktop/src/renderer/i18n/index.ts`
- Create: `apps/desktop/src/renderer/i18n/index.test.tsx`
- Create: `apps/desktop/src/renderer/stores/ui-store.ts`

- [ ] **Step 1: Install renderer dependencies**

Run:

```bash
npm install --workspace @robert-station/desktop zustand lucide-react
```

Expected: `apps/desktop/package.json` contains `zustand` and `lucide-react`; `package-lock.json` updates without install errors.

- [ ] **Step 2: Write the failing i18n test**

Create `apps/desktop/src/renderer/i18n/index.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { translate } from "./index";

describe("renderer i18n", () => {
  it("uses Simplified Chinese text and interpolates params", () => {
    expect(translate("zh", "app.title")).toBe("Robert Station");
    expect(translate("zh", "metrics.candidateTopics", { count: 4 })).toBe("4 个候选选题");
  });

  it("falls back to English and then the key when a locale is missing a value", () => {
    expect(translate("zh", "app.fallbackSmoke")).toBe("Fallback smoke");
    expect(translate("zh", "missing.translation.key" as never)).toBe("missing.translation.key");
  });
});
```

- [ ] **Step 3: Run the i18n test to verify it fails**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/i18n/index.test.tsx
```

Expected: FAIL because `apps/desktop/src/renderer/i18n/index.ts` does not exist yet.

- [ ] **Step 4: Add Chinese translations**

Create `apps/desktop/src/renderer/i18n/locales/zh.ts`:

```ts
export const zh = {
  "app.title": "Robert Station",
  "app.loading": "正在加载内容工作台...",
  "app.fallbackSmoke": "",
  "nav.dashboard": "总览",
  "nav.topics": "选题",
  "nav.creation": "创作",
  "nav.publish": "发布",
  "nav.review": "复盘",
  "nav.knowledge": "知识库",
  "header.eyebrow": "内容运营工作台",
  "header.noProject": "尚未选择项目",
  "header.noProjectHint": "从选题页转为项目后，这里会显示当前项目上下文。",
  "metrics.candidateTopics": "{count} 个候选选题",
  "metrics.activeProjects": "{count} 个活跃项目",
  "metrics.publishedRecords": "{count} 条发布记录",
  "metrics.knowledgeItems": "{count} 条知识",
  "dashboard.title": "总览",
  "dashboard.columnDistribution": "栏目分布",
  "dashboard.workflowHealth": "工作流状态",
  "dashboard.topics": "选题",
  "dashboard.drafts": "草稿",
  "dashboard.published": "已发布",
  "topics.title": "选题",
  "topics.column": "栏目",
  "topics.generate": "生成选题",
  "topics.generating": "生成中...",
  "topics.promote": "转为项目",
  "topics.promoted": "已转为项目",
  "topics.empty": "暂无选题候选。",
  "topics.generateFailed": "选题生成失败，请重试。",
  "creation.title": "创作",
  "creation.empty": "先从选题页转为项目，再进入创作。",
  "creation.draftVersion": "草稿 v{version}",
  "creation.sources": "来源",
  "creation.generateDraft": "生成草稿包",
  "creation.generatePlatform": "生成小红书包",
  "creation.archive": "归档项目",
  "creation.generating": "生成中...",
  "creation.archiving": "归档中...",
  "creation.draftFailed": "草稿包生成失败，请重试。",
  "creation.platformFailed": "小红书包生成失败，请重试。",
  "creation.archiveFailed": "项目归档失败，请重试。",
  "creation.archiveTitle": "归档",
  "creation.archived": "已归档",
  "creation.notArchived": "尚未归档。",
  "package.title": "小红书包",
  "package.noPackage": "还没有小红书包。",
  "package.fieldTitle": "标题",
  "package.body": "正文",
  "package.tags": "标签",
  "package.coverText": "封面文案",
  "package.requiredAssets": "所需素材",
  "package.checks": "检查项",
  "publish.title": "发布",
  "publish.empty": "先在创作页生成小红书包，再记录发布信息。",
  "publish.manual": "手动发布",
  "publish.publishedAt": "发布时间",
  "publish.url": "发布链接",
  "publish.note": "发布备注",
  "publish.save": "保存发布记录",
  "publish.saving": "保存中...",
  "publish.saved": "已发布",
  "publish.noUrl": "未记录链接",
  "publish.saveFailed": "发布记录保存失败，请重试。",
  "metrics.importTitle": "指标导入",
  "metrics.importCsv": "导入指标 CSV",
  "metrics.importing": "导入中...",
  "metrics.saveImported": "保存导入指标",
  "metrics.saving": "保存中...",
  "metrics.importFailed": "指标 CSV 导入失败，请重试。",
  "metrics.saveFailed": "导入指标保存失败，请重试。",
  "metrics.previewMatched": "本次导入匹配 {count} 行",
  "metrics.previewInvalid": "{count} 行无效",
  "metrics.row": "第 {row} 行：{value}",
  "metrics.views": "浏览",
  "metrics.likes": "点赞",
  "metrics.favorites": "收藏",
  "metrics.comments": "评论",
  "metrics.shares": "分享",
  "metrics.snapshot": "快照时间",
  "review.title": "复盘",
  "review.empty": "先完成发布记录，再生成复盘报告。",
  "review.generate": "生成复盘报告",
  "review.generating": "生成中...",
  "review.generateFailed": "复盘报告生成失败，请重试。",
  "review.reportVersion": "复盘报告 v{version}",
  "review.generatedAt": "生成时间 {time}",
  "review.highlights": "亮点",
  "review.underperforming": "弱信号",
  "review.causes": "可能原因",
  "review.nextActions": "下一步动作",
  "review.extractKnowledge": "沉淀为知识",
  "review.extracting": "沉淀中...",
  "review.knowledgeExtracted": "知识已沉淀",
  "review.archiveRequired": "请先归档项目，再沉淀复盘知识。",
  "review.extractFailed": "复盘知识沉淀失败，请重试。",
  "knowledge.title": "知识库",
  "knowledge.empty": "暂无沉淀知识。",
  "common.status": "状态",
  "common.priority": "优先级 {priority}",
  "common.heat": "热度",
  "common.fit": "匹配",
  "common.difficulty": "难度"
} as const;
```

- [ ] **Step 5: Add English translations with the same keys**

Create `apps/desktop/src/renderer/i18n/locales/en.ts`:

```ts
import type { zh } from "./zh";

export const en: Record<keyof typeof zh, string> = {
  "app.title": "Robert Station",
  "app.loading": "Loading content workbench...",
  "app.fallbackSmoke": "Fallback smoke",
  "nav.dashboard": "Dashboard",
  "nav.topics": "Topics",
  "nav.creation": "Creation",
  "nav.publish": "Publish",
  "nav.review": "Review",
  "nav.knowledge": "Knowledge",
  "header.eyebrow": "Content operations workbench",
  "header.noProject": "No project selected",
  "header.noProjectHint": "Promote a topic to show project context here.",
  "metrics.candidateTopics": "{count} candidate topics",
  "metrics.activeProjects": "{count} active projects",
  "metrics.publishedRecords": "{count} publish records",
  "metrics.knowledgeItems": "{count} knowledge items",
  "dashboard.title": "Dashboard",
  "dashboard.columnDistribution": "Column distribution",
  "dashboard.workflowHealth": "Workflow health",
  "dashboard.topics": "Topics",
  "dashboard.drafts": "Drafts",
  "dashboard.published": "Published",
  "topics.title": "Topics",
  "topics.column": "Column",
  "topics.generate": "Generate topics",
  "topics.generating": "Generating...",
  "topics.promote": "Promote to project",
  "topics.promoted": "Promoted",
  "topics.empty": "No topic candidates yet.",
  "topics.generateFailed": "Could not generate topics. Try again.",
  "creation.title": "Creation",
  "creation.empty": "Promote a topic before entering creation.",
  "creation.draftVersion": "Draft v{version}",
  "creation.sources": "Sources",
  "creation.generateDraft": "Generate draft package",
  "creation.generatePlatform": "Generate Xiaohongshu package",
  "creation.archive": "Archive project",
  "creation.generating": "Generating...",
  "creation.archiving": "Archiving...",
  "creation.draftFailed": "Could not generate draft package. Try again.",
  "creation.platformFailed": "Could not generate Xiaohongshu package. Try again.",
  "creation.archiveFailed": "Could not archive project. Try again.",
  "creation.archiveTitle": "Archive",
  "creation.archived": "Archived",
  "creation.notArchived": "Not archived yet.",
  "package.title": "Xiaohongshu Package",
  "package.noPackage": "No Xiaohongshu package yet.",
  "package.fieldTitle": "Title",
  "package.body": "Body",
  "package.tags": "Tags",
  "package.coverText": "Cover text",
  "package.requiredAssets": "Required assets",
  "package.checks": "Checks",
  "publish.title": "Publish",
  "publish.empty": "Generate a Xiaohongshu package before recording publish information.",
  "publish.manual": "Manual publish",
  "publish.publishedAt": "Published at",
  "publish.url": "Publish URL",
  "publish.note": "Publish note",
  "publish.save": "Save publish record",
  "publish.saving": "Saving...",
  "publish.saved": "Published",
  "publish.noUrl": "No URL recorded",
  "publish.saveFailed": "Could not save publish record. Try again.",
  "metrics.importTitle": "Metrics import",
  "metrics.importCsv": "Import metrics CSV",
  "metrics.importing": "Importing...",
  "metrics.saveImported": "Save imported metrics",
  "metrics.saving": "Saving...",
  "metrics.importFailed": "Could not import metrics CSV. Try again.",
  "metrics.saveFailed": "Could not save imported metrics. Try again.",
  "metrics.previewMatched": "{count} matched rows in this import",
  "metrics.previewInvalid": "{count} invalid rows",
  "metrics.row": "Row {row}: {value}",
  "metrics.views": "Views",
  "metrics.likes": "Likes",
  "metrics.favorites": "Favorites",
  "metrics.comments": "Comments",
  "metrics.shares": "Shares",
  "metrics.snapshot": "Snapshot",
  "review.title": "Review",
  "review.empty": "Record a publish entry before generating a review report.",
  "review.generate": "Generate review report",
  "review.generating": "Generating...",
  "review.generateFailed": "Could not generate review report. Try again.",
  "review.reportVersion": "Review Report v{version}",
  "review.generatedAt": "Generated {time}",
  "review.highlights": "Highlights",
  "review.underperforming": "Underperforming signals",
  "review.causes": "Likely causes",
  "review.nextActions": "Next actions",
  "review.extractKnowledge": "Extract knowledge",
  "review.extracting": "Extracting...",
  "review.knowledgeExtracted": "Knowledge extracted",
  "review.archiveRequired": "Archive this project before extracting review knowledge.",
  "review.extractFailed": "Could not extract review knowledge. Try again.",
  "knowledge.title": "Knowledge",
  "knowledge.empty": "No archived knowledge yet.",
  "common.status": "Status",
  "common.priority": "Priority {priority}",
  "common.heat": "Heat",
  "common.fit": "Fit",
  "common.difficulty": "Difficulty"
};
```

- [ ] **Step 6: Add the i18n implementation**

Create `apps/desktop/src/renderer/i18n/index.ts`:

```ts
import { useCallback } from "react";
import { useUiStore } from "../stores/ui-store";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export type Locale = "zh" | "en";
export type TranslationKey = keyof typeof zh;

const translations: Record<Locale, Partial<Record<TranslationKey, string>>> = { zh, en };

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text = translations[locale][key] || translations.en[key] || key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }
  }

  return text;
}

export function useTranslation(): (key: TranslationKey, params?: Record<string, string | number>) => string {
  const locale = useUiStore((state) => state.locale);

  return useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );
}
```

- [ ] **Step 7: Add the UI store**

Create `apps/desktop/src/renderer/stores/ui-store.ts`:

```ts
import { create } from "zustand";
import type { Locale } from "../i18n";

type UiStoreState = {
  locale: Locale;
  isSidebarCollapsed: boolean;
  setLocale: (locale: Locale) => void;
  toggleSidebar: () => void;
  reset: () => void;
};

const initialState = {
  locale: "zh" as Locale,
  isSidebarCollapsed: false
};

export const useUiStore = create<UiStoreState>((set) => ({
  ...initialState,
  setLocale: (locale) => set({ locale }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  reset: () => set(initialState)
}));
```

- [ ] **Step 8: Run the i18n test to verify it passes**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/i18n/index.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/desktop/package.json package-lock.json apps/desktop/src/renderer/i18n apps/desktop/src/renderer/stores/ui-store.ts
git commit -m "feat: add renderer i18n foundation"
```

---

## Task 2: Build Content Loop Store And Date Helpers

**Files:**
- Create: `apps/desktop/src/renderer/datetime.ts`
- Create: `apps/desktop/src/renderer/stores/content-loop-store.ts`
- Create: `apps/desktop/src/renderer/stores/content-loop-store.test.ts`
- Modify: `apps/desktop/src/renderer/test-setup.ts`

- [ ] **Step 1: Write the failing date helper test inside the store test**

Create `apps/desktop/src/renderer/stores/content-loop-store.test.ts`:

```ts
import type { PersistedContentLoopState } from "@robert-station/local-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDatetimeLocalValue, toPublishTimestamp } from "../datetime";
import { useContentLoopStore } from "./content-loop-store";

describe("datetime helpers", () => {
  it("formats local datetime input values and falls back to now for invalid publish values", () => {
    const value = formatDatetimeLocalValue(new Date("2026-05-19T15:30:00.000Z"));
    expect(value).toMatch(/2026-05-19T/);
    expect(toPublishTimestamp("not-a-date")).toMatch(/T/);
  });
});

describe("content loop store", () => {
  beforeEach(() => {
    useContentLoopStore.getState().reset();
  });

  it("loads persisted content loop state through the IPC loader", async () => {
    await useContentLoopStore.getState().load();

    expect(window.robertStation.contentLoop.load).toHaveBeenCalledOnce();
    expect(useContentLoopStore.getState().contentLoop?.topics.length).toBeGreaterThan(0);
  });

  it("promotes a topic, selects the promoted project, and opens creation", async () => {
    await useContentLoopStore.getState().load();
    await useContentLoopStore.getState().promoteTopic("topic_ai_local-workstation");

    const state = useContentLoopStore.getState();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
    expect(state.screen).toBe("creation");
    expect(state.selectedProject?.title).toBe("How to build a personal AI workstation for daily content work");
  });

  it("ignores stale successful review generation after the selected publish record changes", async () => {
    await useContentLoopStore.getState().load();
    await useContentLoopStore.getState().promoteTopic("topic_ai_local-workstation");
    await useContentLoopStore.getState().generatePlatformPackage("project_topic-ai-local-workstation");
    await useContentLoopStore.getState().recordManualPublish("platform-package_project-topic-ai-local-workstation_xiaohongshu", {
      publishedAt: "2026-05-19T15:30:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "demo"
    });

    const firstPublishRecordId = useContentLoopStore.getState().selectedPublishRecord?.id ?? "";
    const staleState = useContentLoopStore.getState().contentLoop as PersistedContentLoopState;
    const deferred = createDeferred<PersistedContentLoopState>();
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => deferred.promise);

    const generation = useContentLoopStore.getState().generateReviewReport(firstPublishRecordId);
    useContentLoopStore.getState().selectPublishRecord("publish-record-other");
    deferred.resolve({
      ...staleState,
      reviewReports: [
        {
          id: "review-report_stale",
          workspaceId: "workspace_robert-station",
          contentProjectId: staleState.selectedProjectId,
          publishRecordId: firstPublishRecordId,
          version: 1,
          summary: "Stale report",
          highlights: ["stale"],
          underperformingSignals: ["stale"],
          likelyCauses: ["stale"],
          nextActions: ["stale"],
          createdAt: "2026-05-20T09:00:00.000Z",
          updatedAt: "2026-05-20T09:00:00.000Z"
        }
      ]
    });
    await generation;

    expect(useContentLoopStore.getState().contentLoop?.reviewReports.some((report) => report.summary === "Stale report")).toBe(false);
  });
});

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}
```

- [ ] **Step 2: Run the store test to verify it fails**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/stores/content-loop-store.test.ts
```

Expected: FAIL because `datetime.ts` and `content-loop-store.ts` do not exist yet.

- [ ] **Step 3: Add datetime helpers**

Create `apps/desktop/src/renderer/datetime.ts`:

```ts
export function formatDatetimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toDatetimeLocalValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatDatetimeLocalValue(new Date());
  }

  return formatDatetimeLocalValue(date);
}

export function toPublishTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}
```

- [ ] **Step 4: Add content-loop store types and selectors**

Create `apps/desktop/src/renderer/stores/content-loop-store.ts` with this first section:

```ts
import type { ContentColumnSlug, ManualPublishInput } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import { create } from "zustand";
import {
  archivePersistedProject,
  extractPersistedReviewKnowledge,
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedReviewReport,
  generatePersistedTopics,
  importPersistedMetricCsv,
  loadPersistedContentLoop,
  promotePersistedTopic,
  recordPersistedManualPublish,
  savePersistedMetricImport
} from "../content-loop-loader";

export type TaskScreen = "dashboard" | "topics" | "creation" | "publish" | "review" | "knowledge";
export type ReviewKnowledgeResult = { kind: "success" | "blocked"; textKey: "review.knowledgeExtracted" | "review.archiveRequired" };

type AsyncFlags = {
  isLoading: boolean;
  isGeneratingTopics: boolean;
  isGeneratingDraftPackage: boolean;
  isGeneratingPlatformPackage: boolean;
  isArchivingProject: boolean;
  isSavingPublishRecord: boolean;
  isImportingMetrics: boolean;
  isSavingMetricImport: boolean;
  isGeneratingReviewReport: boolean;
  isExtractingReviewKnowledge: boolean;
};

type ErrorState = {
  topicGenerationError: string | null;
  draftPackageError: string | null;
  platformPackageError: string | null;
  archiveError: string | null;
  publishRecordError: string | null;
  metricImportError: string | null;
  metricSaveError: string | null;
  reviewReportError: string | null;
  reviewKnowledgeError: string | null;
};

type ManualPublishDraft = {
  publishedAt: string;
  url: string;
  note: string;
};

type ContentLoopStoreState = AsyncFlags & ErrorState & {
  screen: TaskScreen;
  contentLoop: PersistedContentLoopState | null;
  topicGenerationColumn: ContentColumnSlug;
  selectedPublishRecordId: string | null;
  selectedReviewReportId: string | null;
  manualPublishDraft: ManualPublishDraft;
  reviewKnowledgeResult: ReviewKnowledgeResult | null;
  candidateTopicCount: number;
  activeProjectCount: number;
  selectedProject: PersistedContentLoopState["projects"][number] | null;
  selectedDraft: PersistedContentLoopState["drafts"][number] | null;
  selectedXiaohongshuPackage: PersistedContentLoopState["platformPackages"][number] | null;
  selectedPublishRecord: PersistedContentLoopState["publishRecords"][number] | null;
  selectedLatestMetricSnapshot: PersistedContentLoopState["metricSnapshots"][number] | null;
  selectedLatestReviewReport: PersistedContentLoopState["reviewReports"][number] | null;
  selectedArchiveRecord: PersistedContentLoopState["archiveRecords"][number] | null;
  matchedMetricImportPreviewRows: NonNullable<PersistedContentLoopState["metricImportPreview"]>["rows"];
  invalidMetricImportPreviewRows: NonNullable<PersistedContentLoopState["metricImportPreview"]>["rows"];
  setScreen: (screen: TaskScreen) => void;
  setTopicGenerationColumn: (columnSlug: ContentColumnSlug) => void;
  setManualPublishDraft: (draft: Partial<ManualPublishDraft>) => void;
  selectProject: (projectId: string | null) => void;
  selectPublishRecord: (publishRecordId: string | null) => void;
  load: () => Promise<void>;
  promoteTopic: (topicId: string) => Promise<void>;
  generateTopics: () => Promise<void>;
  generateDraftPackage: (projectId: string) => Promise<void>;
  generatePlatformPackage: (projectId: string) => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;
  recordManualPublish: (platformPackageId: string, input?: Omit<ManualPublishInput, "platformPackageId">) => Promise<void>;
  importMetricCsv: () => Promise<void>;
  saveMetricImport: () => Promise<void>;
  generateReviewReport: (publishRecordId: string) => Promise<void>;
  extractReviewKnowledge: (reviewReportId: string) => Promise<void>;
  reset: () => void;
};
```

- [ ] **Step 5: Add derived state helpers**

Append these helpers in `content-loop-store.ts`:

```ts
const emptyFlags: AsyncFlags = {
  isLoading: false,
  isGeneratingTopics: false,
  isGeneratingDraftPackage: false,
  isGeneratingPlatformPackage: false,
  isArchivingProject: false,
  isSavingPublishRecord: false,
  isImportingMetrics: false,
  isSavingMetricImport: false,
  isGeneratingReviewReport: false,
  isExtractingReviewKnowledge: false
};

const emptyErrors: ErrorState = {
  topicGenerationError: null,
  draftPackageError: null,
  platformPackageError: null,
  archiveError: null,
  publishRecordError: null,
  metricImportError: null,
  metricSaveError: null,
  reviewReportError: null,
  reviewKnowledgeError: null
};

const emptyManualPublishDraft: ManualPublishDraft = {
  publishedAt: "",
  url: "",
  note: ""
};

function deriveState(
  state: Pick<ContentLoopStoreState, "contentLoop" | "selectedPublishRecordId" | "selectedReviewReportId">
): Partial<ContentLoopStoreState> {
  const contentLoop = state.contentLoop;

  if (!contentLoop) {
    return {
      candidateTopicCount: 0,
      activeProjectCount: 0,
      selectedProject: null,
      selectedDraft: null,
      selectedXiaohongshuPackage: null,
      selectedPublishRecord: null,
      selectedLatestMetricSnapshot: null,
      selectedLatestReviewReport: null,
      selectedArchiveRecord: null,
      matchedMetricImportPreviewRows: [],
      invalidMetricImportPreviewRows: []
    };
  }

  const selectedProject = contentLoop.projects.find((project) => project.id === contentLoop.selectedProjectId) ?? null;
  const selectedDraft = selectedProject
    ? contentLoop.drafts.find((draft) => draft.contentProjectId === selectedProject.id) ?? null
    : null;
  const selectedXiaohongshuPackage = selectedProject
    ? contentLoop.platformPackages.find(
        (platformPackage) =>
          platformPackage.contentProjectId === selectedProject.id && platformPackage.platform === "xiaohongshu"
      ) ?? null
    : null;
  const publishRecords = selectedXiaohongshuPackage
    ? contentLoop.publishRecords.filter((record) => record.platformPackageId === selectedXiaohongshuPackage.id)
    : [];
  const selectedPublishRecord =
    publishRecords.find((record) => record.id === state.selectedPublishRecordId) ?? publishRecords[0] ?? null;
  const selectedMetricSnapshots = selectedPublishRecord
    ? contentLoop.metricSnapshots.filter((snapshot) => snapshot.publishRecordId === selectedPublishRecord.id)
    : [];
  const selectedReviewReports = selectedPublishRecord
    ? contentLoop.reviewReports.filter((report) => report.publishRecordId === selectedPublishRecord.id)
    : [];
  const selectedLatestReviewReport =
    selectedReviewReports.find((report) => report.id === state.selectedReviewReportId) ?? selectedReviewReports[0] ?? null;

  return {
    candidateTopicCount: contentLoop.topics.filter((topic) => topic.status === "candidate").length,
    activeProjectCount: contentLoop.projects.length,
    selectedProject,
    selectedDraft,
    selectedXiaohongshuPackage,
    selectedPublishRecord,
    selectedLatestMetricSnapshot: selectedMetricSnapshots[0] ?? null,
    selectedLatestReviewReport,
    selectedArchiveRecord: selectedProject
      ? contentLoop.archiveRecords.find((archiveRecord) => archiveRecord.contentProjectId === selectedProject.id) ?? null
      : null,
    matchedMetricImportPreviewRows: contentLoop.metricImportPreview?.rows.filter((row) => row.status === "matched") ?? [],
    invalidMetricImportPreviewRows: contentLoop.metricImportPreview?.rows.filter((row) => row.status === "invalid") ?? []
  };
}

function withDerivedState(
  state: Partial<ContentLoopStoreState> & Pick<ContentLoopStoreState, "contentLoop">
): Partial<ContentLoopStoreState> {
  return {
    ...state,
    ...deriveState({
      contentLoop: state.contentLoop,
      selectedPublishRecordId: state.selectedPublishRecordId ?? null,
      selectedReviewReportId: state.selectedReviewReportId ?? null
    })
  };
}
```

- [ ] **Step 6: Add store implementation**

Append this implementation in `content-loop-store.ts`:

```ts
const initialState = {
  ...emptyFlags,
  ...emptyErrors,
  screen: "dashboard" as TaskScreen,
  contentLoop: null,
  topicGenerationColumn: "ai" as ContentColumnSlug,
  selectedPublishRecordId: null,
  selectedReviewReportId: null,
  manualPublishDraft: emptyManualPublishDraft,
  reviewKnowledgeResult: null,
  ...deriveState({ contentLoop: null, selectedPublishRecordId: null, selectedReviewReportId: null })
};

export const useContentLoopStore = create<ContentLoopStoreState>((set, get) => ({
  ...initialState,
  setScreen: (screen) => set({ screen }),
  setTopicGenerationColumn: (topicGenerationColumn) => set({ topicGenerationColumn }),
  setManualPublishDraft: (draft) =>
    set((state) => ({ manualPublishDraft: { ...state.manualPublishDraft, ...draft } })),
  selectProject: (projectId) =>
    set((state) => {
      const contentLoop = state.contentLoop ? { ...state.contentLoop, selectedProjectId: projectId } : null;
      return withDerivedState({
        contentLoop,
        selectedPublishRecordId: null,
        selectedReviewReportId: null,
        reviewKnowledgeResult: null,
        ...emptyErrors
      });
    }),
  selectPublishRecord: (selectedPublishRecordId) =>
    set((state) => withDerivedState({
      contentLoop: state.contentLoop,
      selectedPublishRecordId,
      selectedReviewReportId: null,
      isGeneratingReviewReport: false,
      isExtractingReviewKnowledge: false,
      reviewKnowledgeResult: null,
      reviewReportError: null,
      reviewKnowledgeError: null
    })),
  load: async () => {
    set({ isLoading: true });
    try {
      const contentLoop = await loadPersistedContentLoop();
      set(withDerivedState({ contentLoop, isLoading: false }));
    } catch {
      set({ isLoading: false });
    }
  },
  promoteTopic: async (topicId) => {
    const contentLoop = await promotePersistedTopic(topicId);
    set(withDerivedState({ contentLoop, screen: "creation" }));
  },
  generateTopics: async () => {
    set({ isGeneratingTopics: true, topicGenerationError: null });
    try {
      const contentLoop = await generatePersistedTopics(get().topicGenerationColumn);
      set(withDerivedState({ contentLoop, isGeneratingTopics: false }));
    } catch {
      set({ isGeneratingTopics: false, topicGenerationError: "topics.generateFailed" });
    }
  },
  generateDraftPackage: async (projectId) => {
    set({ isGeneratingDraftPackage: true, draftPackageError: null });
    try {
      const contentLoop = await generatePersistedDraftPackage(projectId);
      set(withDerivedState({ contentLoop, isGeneratingDraftPackage: false }));
    } catch {
      set({ isGeneratingDraftPackage: false, draftPackageError: "creation.draftFailed" });
    }
  },
  generatePlatformPackage: async (projectId) => {
    set({ isGeneratingPlatformPackage: true, platformPackageError: null });
    try {
      const contentLoop = await generatePersistedPlatformPackage(projectId, "xiaohongshu");
      set(withDerivedState({ contentLoop, isGeneratingPlatformPackage: false, screen: "publish" }));
    } catch {
      set({ isGeneratingPlatformPackage: false, platformPackageError: "creation.platformFailed" });
    }
  },
  archiveProject: async (projectId) => {
    set({ isArchivingProject: true, archiveError: null });
    try {
      const contentLoop = await archivePersistedProject(projectId);
      set(withDerivedState({ contentLoop, isArchivingProject: false }));
    } catch {
      set({ isArchivingProject: false, archiveError: "creation.archiveFailed" });
    }
  },
  recordManualPublish: async (platformPackageId, input) => {
    set({ isSavingPublishRecord: true, publishRecordError: null });
    try {
      const draft = get().manualPublishDraft;
      const contentLoop = await recordPersistedManualPublish(input ?? {
        platformPackageId,
        publishedAt: draft.publishedAt,
        url: draft.url,
        note: draft.note
      });
      set(withDerivedState({ contentLoop, isSavingPublishRecord: false, screen: "review" }));
    } catch {
      set({ isSavingPublishRecord: false, publishRecordError: "publish.saveFailed" });
    }
  },
  importMetricCsv: async () => {
    set({ isImportingMetrics: true, metricImportError: null, metricSaveError: null });
    try {
      const contentLoop = await importPersistedMetricCsv();
      set(withDerivedState({ contentLoop, isImportingMetrics: false }));
    } catch {
      set({ isImportingMetrics: false, metricImportError: "metrics.importFailed" });
    }
  },
  saveMetricImport: async () => {
    set({ isSavingMetricImport: true, metricSaveError: null });
    try {
      const contentLoop = await savePersistedMetricImport();
      set(withDerivedState({ contentLoop, isSavingMetricImport: false }));
    } catch {
      set({ isSavingMetricImport: false, metricSaveError: "metrics.saveFailed" });
    }
  },
  generateReviewReport: async (publishRecordId) => {
    set({
      selectedPublishRecordId: publishRecordId,
      isGeneratingReviewReport: true,
      reviewReportError: null
    });
    try {
      const contentLoop = await generatePersistedReviewReport(publishRecordId);
      if (get().selectedPublishRecordId === publishRecordId) {
        set(withDerivedState({ contentLoop, isGeneratingReviewReport: false }));
      }
    } catch {
      if (get().selectedPublishRecordId === publishRecordId) {
        set({ isGeneratingReviewReport: false, reviewReportError: "review.generateFailed" });
      }
    }
  },
  extractReviewKnowledge: async (reviewReportId) => {
    set({
      selectedReviewReportId: reviewReportId,
      isExtractingReviewKnowledge: true,
      reviewKnowledgeResult: null,
      reviewKnowledgeError: null
    });
    try {
      const contentLoop = await extractPersistedReviewKnowledge(reviewReportId);
      if (get().selectedReviewReportId === reviewReportId) {
        const reportProjectId = contentLoop.reviewReports.find((report) => report.id === reviewReportId)?.contentProjectId ?? null;
        const hasReviewKnowledge = contentLoop.knowledgeItems.some(
          (item) =>
            item.contentProjectId === reportProjectId &&
            item.tags.includes("review") &&
            item.tags.includes("performance")
        );
        set(withDerivedState({
          contentLoop,
          isExtractingReviewKnowledge: false,
          reviewKnowledgeResult: hasReviewKnowledge
            ? { kind: "success", textKey: "review.knowledgeExtracted" }
            : { kind: "blocked", textKey: "review.archiveRequired" }
        }));
      }
    } catch {
      if (get().selectedReviewReportId === reviewReportId) {
        set({ isExtractingReviewKnowledge: false, reviewKnowledgeError: "review.extractFailed" });
      }
    }
  },
  reset: () => set(initialState)
}));
```

- [ ] **Step 7: Reset stores in test setup**

Modify `apps/desktop/src/renderer/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import type { ContentColumnSlug, ManualPublishInput, Platform } from "@robert-station/core";
import { InMemoryContentLoopRepository } from "@robert-station/local-store";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useContentLoopStore } from "./stores/content-loop-store";
import { useUiStore } from "./stores/ui-store";
```

Then update the `afterEach` block:

```ts
afterEach(() => {
  cleanup();
  useContentLoopStore.getState().reset();
  useUiStore.getState().reset();
  vi.restoreAllMocks();
});
```

- [ ] **Step 8: Run the store test to verify it passes**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/stores/content-loop-store.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/desktop/src/renderer/datetime.ts apps/desktop/src/renderer/stores/content-loop-store.ts apps/desktop/src/renderer/stores/content-loop-store.test.ts apps/desktop/src/renderer/test-setup.ts
git commit -m "feat: add content loop renderer store"
```

---

## Task 3: Add Shared Components And Desktop Shell

**Files:**
- Create: `apps/desktop/src/renderer/components/shared/Button.tsx`
- Create: `apps/desktop/src/renderer/components/shared/EmptyState.tsx`
- Create: `apps/desktop/src/renderer/components/shared/FieldGroup.tsx`
- Create: `apps/desktop/src/renderer/components/shared/Panel.tsx`
- Create: `apps/desktop/src/renderer/components/shared/StatusBadge.tsx`
- Create: `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
- Create: `apps/desktop/src/renderer/components/layout/WorkspaceHeader.tsx`
- Create: `apps/desktop/src/renderer/components/layout/AppShell.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Write the failing shell test in `App.test.tsx`**

At the top of `apps/desktop/src/renderer/App.test.tsx`, keep current imports. Replace the first test with:

```tsx
  it("renders the Chinese taskflow shell after loading persisted state", async () => {
    render(<App />);

    expect(screen.getByText("正在加载内容工作台...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "总览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "总览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发布" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复盘" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText("4 个候选选题")).toBeInTheDocument();
    expect(screen.getByText("0 个活跃项目")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "renders the Chinese taskflow shell"
```

Expected: FAIL because the current shell still renders English copy and the new components do not exist.

- [ ] **Step 3: Add shared button**

Create `apps/desktop/src/renderer/components/shared/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
};

export function Button({ children, className, icon, variant = "primary", ...props }: ButtonProps): ReactElement {
  const classes = ["button", `button--${variant}`, className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
```

- [ ] **Step 4: Add shared display primitives**

Create `apps/desktop/src/renderer/components/shared/Panel.tsx`:

```tsx
import type { HTMLAttributes, ReactElement, ReactNode } from "react";

type PanelTone = "raised" | "recessed";

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  tone?: PanelTone;
};

export function Panel({ children, className, tone = "raised", ...props }: PanelProps): ReactElement {
  const classes = ["panel", `panel--${tone}`, className].filter(Boolean).join(" ");

  return (
    <section className={classes} {...props}>
      {children}
    </section>
  );
}
```

Create `apps/desktop/src/renderer/components/shared/EmptyState.tsx`:

```tsx
import type { ReactElement } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ description, title }: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
```

Create `apps/desktop/src/renderer/components/shared/FieldGroup.tsx`:

```tsx
import type { InputHTMLAttributes, ReactElement } from "react";

type FieldGroupProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FieldGroup({ label, ...props }: FieldGroupProps): ReactElement {
  return (
    <label className="field-group">
      <span>{label}</span>
      <input aria-label={label} {...props} />
    </label>
  );
}
```

Create `apps/desktop/src/renderer/components/shared/StatusBadge.tsx`:

```tsx
import type { ReactElement } from "react";

type StatusBadgeProps = {
  children: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps): ReactElement {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
```

- [ ] **Step 5: Add sidebar**

Create `apps/desktop/src/renderer/components/layout/Sidebar.tsx`:

```tsx
import { BarChart3, BookOpen, FilePenLine, Lightbulb, Send, Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import { useTranslation, type TranslationKey } from "../../i18n";
import { useContentLoopStore, type TaskScreen } from "../../stores/content-loop-store";

const navItems: Array<{ screen: TaskScreen; labelKey: TranslationKey; icon: typeof BarChart3 }> = [
  { screen: "dashboard", labelKey: "nav.dashboard", icon: BarChart3 },
  { screen: "topics", labelKey: "nav.topics", icon: Lightbulb },
  { screen: "creation", labelKey: "nav.creation", icon: FilePenLine },
  { screen: "publish", labelKey: "nav.publish", icon: Send },
  { screen: "review", labelKey: "nav.review", icon: Sparkles },
  { screen: "knowledge", labelKey: "nav.knowledge", icon: BookOpen }
];

export function Sidebar(): ReactElement {
  const t = useTranslation();
  const screen = useContentLoopStore((state) => state.screen);
  const setScreen = useContentLoopStore((state) => state.setScreen);

  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="brand-lockup">
        <div className="brand-mark">RS</div>
        <div>
          <strong>Robert Station</strong>
          <span>{t("header.eyebrow")}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-current={screen === item.screen ? "page" : undefined}
              className={screen === item.screen ? "nav-button nav-button--active" : "nav-button"}
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              type="button"
            >
              <Icon aria-hidden="true" size={17} />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 6: Add workspace header**

Create `apps/desktop/src/renderer/components/layout/WorkspaceHeader.tsx`:

```tsx
import type { ReactElement } from "react";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { StatusBadge } from "../shared/StatusBadge";

export function WorkspaceHeader(): ReactElement {
  const t = useTranslation();
  const candidateTopicCount = useContentLoopStore((state) => state.candidateTopicCount);
  const activeProjectCount = useContentLoopStore((state) => state.activeProjectCount);
  const contentLoop = useContentLoopStore((state) => state.contentLoop);
  const selectedProject = useContentLoopStore((state) => state.selectedProject);

  return (
    <header className="workspace-header">
      <div className="workspace-header__context">
        <p className="eyebrow">{t("header.eyebrow")}</p>
        {selectedProject ? (
          <>
            <h1>{selectedProject.title}</h1>
            <div className="workspace-header__badges">
              <StatusBadge tone="info">{selectedProject.columnSlug}</StatusBadge>
              <StatusBadge tone="success">{selectedProject.status}</StatusBadge>
            </div>
          </>
        ) : (
          <>
            <h1>{t("header.noProject")}</h1>
            <p>{t("header.noProjectHint")}</p>
          </>
        )}
      </div>
      <div className="workspace-metrics" aria-label="内容循环指标">
        <span>{t("metrics.candidateTopics", { count: candidateTopicCount })}</span>
        <span>{t("metrics.activeProjects", { count: activeProjectCount })}</span>
        <span>{t("metrics.publishedRecords", { count: contentLoop?.publishRecords.length ?? 0 })}</span>
        <span>{t("metrics.knowledgeItems", { count: contentLoop?.knowledgeItems.length ?? 0 })}</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Add temporary dashboard screen and shell**

Create `apps/desktop/src/renderer/components/screens/DashboardScreen.tsx`:

```tsx
import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ReactElement } from "react";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { Panel } from "../shared/Panel";

export function DashboardScreen(): ReactElement {
  const t = useTranslation();
  const contentLoop = useContentLoopStore((state) => state.contentLoop);

  return (
    <section className="screen-stack" aria-label={t("dashboard.title")}>
      <div className="screen-heading">
        <h2>{t("dashboard.title")}</h2>
      </div>
      <div className="summary-grid" aria-label={t("dashboard.columnDistribution")}>
        {DEFAULT_COLUMNS.map((column) => (
          <Panel className="column-card" key={column.slug}>
            <div className="column-card__header">
              <h3>{column.name}</h3>
              <span>{t("common.priority", { priority: column.priority })}</span>
            </div>
            <p>{column.description}</p>
            <dl>
              <div>
                <dt>{t("dashboard.topics")}</dt>
                <dd>{contentLoop?.topics.filter((topic) => topic.columnSlug === column.slug).length ?? 0}</dd>
              </div>
              <div>
                <dt>{t("dashboard.drafts")}</dt>
                <dd>{contentLoop?.drafts.length ?? 0}</dd>
              </div>
              <div>
                <dt>{t("dashboard.published")}</dt>
                <dd>{contentLoop?.publishRecords.length ?? 0}</dd>
              </div>
            </dl>
          </Panel>
        ))}
      </div>
    </section>
  );
}
```

Create `apps/desktop/src/renderer/components/layout/AppShell.tsx`:

```tsx
import type { ReactElement } from "react";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { DashboardScreen } from "../screens/DashboardScreen";
import { Sidebar } from "./Sidebar";
import { WorkspaceHeader } from "./WorkspaceHeader";

export function AppShell(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <WorkspaceHeader />
        <div className="workspace-content">{screen === "dashboard" ? <DashboardScreen /> : <DashboardScreen />}</div>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Replace `App.tsx` with store bootstrap**

Replace `apps/desktop/src/renderer/App.tsx` with:

```tsx
import type { ReactElement } from "react";
import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { useTranslation } from "./i18n";
import { useContentLoopStore } from "./stores/content-loop-store";

export function App(): ReactElement {
  const t = useTranslation();
  const contentLoop = useContentLoopStore((state) => state.contentLoop);
  const isLoading = useContentLoopStore((state) => state.isLoading);
  const load = useContentLoopStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (!contentLoop || isLoading) {
    return (
      <main className="loading-shell">
        <p>{t("app.loading")}</p>
      </main>
    );
  }

  return <AppShell />;
}
```

- [ ] **Step 9: Run the shell test to verify it passes**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "renders the Chinese taskflow shell"
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/components
git commit -m "feat: add taskflow desktop shell"
```

---

## Task 4: Migrate Topic And Creation Screens

**Files:**
- Create: `apps/desktop/src/renderer/components/screens/TopicScreen.tsx`
- Create: `apps/desktop/src/renderer/components/screens/CreationScreen.tsx`
- Modify: `apps/desktop/src/renderer/components/layout/AppShell.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Update topic and creation tests to Chinese labels**

In `apps/desktop/src/renderer/App.test.tsx`, update these existing flows:

```tsx
fireEvent.click(screen.getByRole("button", { name: "选题" }));
fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));
expect(await screen.findByRole("heading", { name: "创作" })).toBeInTheDocument();
expect(screen.getByText("1 个活跃项目")).toBeInTheDocument();
```

Update generation labels:

```tsx
fireEvent.change(screen.getByLabelText("栏目"), { target: { value: "finance" } });
fireEvent.click(screen.getByRole("button", { name: "生成选题" }));
expect(await screen.findByRole("alert")).toHaveTextContent("选题生成失败，请重试。");
fireEvent.click(screen.getByRole("button", { name: "生成草稿包" }));
expect(await screen.findByText("草稿 v2")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));
expect(await screen.findByRole("heading", { name: "小红书包" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the updated topic/creation tests to verify they fail**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "promotes a topic|generates topics|generates a draft|generates and displays a Xiaohongshu package"
```

Expected: FAIL because topic and creation screens are not implemented in the shell.

- [ ] **Step 3: Add topic screen**

Create `apps/desktop/src/renderer/components/screens/TopicScreen.tsx`:

```tsx
import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ReactElement } from "react";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";

export function TopicScreen(): ReactElement {
  const t = useTranslation();
  const contentLoop = useContentLoopStore((state) => state.contentLoop);
  const topicGenerationColumn = useContentLoopStore((state) => state.topicGenerationColumn);
  const isGeneratingTopics = useContentLoopStore((state) => state.isGeneratingTopics);
  const topicGenerationError = useContentLoopStore((state) => state.topicGenerationError);
  const setTopicGenerationColumn = useContentLoopStore((state) => state.setTopicGenerationColumn);
  const generateTopics = useContentLoopStore((state) => state.generateTopics);
  const promoteTopic = useContentLoopStore((state) => state.promoteTopic);

  return (
    <section className="screen-stack" aria-label={t("topics.title")}>
      <div className="screen-heading">
        <h2>{t("topics.title")}</h2>
        <div className="topic-toolbar">
          <label>
            <span>{t("topics.column")}</span>
            <select
              aria-label={t("topics.column")}
              onChange={(event) => setTopicGenerationColumn(event.target.value as typeof topicGenerationColumn)}
              value={topicGenerationColumn}
            >
              {DEFAULT_COLUMNS.map((column) => (
                <option key={column.slug} value={column.slug}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isGeneratingTopics} onClick={() => void generateTopics()}>
            {isGeneratingTopics ? t("topics.generating") : t("topics.generate")}
          </Button>
        </div>
        {topicGenerationError ? (
          <p className="inline-error" role="alert">
            {t(topicGenerationError as never)}
          </p>
        ) : null}
      </div>
      {contentLoop?.topics.length ? (
        <section className="topic-grid" aria-label="选题候选">
          {contentLoop.topics.map((topic) => (
            <Panel aria-label={topic.title} className="topic-card" key={topic.id}>
              <div className="topic-card__meta">
                <StatusBadge tone="info">{topic.columnSlug}</StatusBadge>
                <StatusBadge tone={topic.status === "promoted" ? "success" : "neutral"}>{topic.status}</StatusBadge>
              </div>
              <h3>{topic.title}</h3>
              <p>{topic.hook}</p>
              <dl className="score-grid">
                <div>
                  <dt>{t("common.heat")}</dt>
                  <dd>{topic.score.heat}</dd>
                </div>
                <div>
                  <dt>{t("common.fit")}</dt>
                  <dd>{topic.score.fit}</dd>
                </div>
                <div>
                  <dt>{t("common.difficulty")}</dt>
                  <dd>{topic.score.difficulty}</dd>
                </div>
              </dl>
              <Button disabled={topic.status === "promoted"} onClick={() => void promoteTopic(topic.id)}>
                {topic.status === "promoted" ? t("topics.promoted") : t("topics.promote")}
              </Button>
            </Panel>
          ))}
        </section>
      ) : (
        <EmptyState title={t("topics.empty")} />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add creation screen**

Create `apps/desktop/src/renderer/components/screens/CreationScreen.tsx`:

```tsx
import type { ReactElement } from "react";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { Panel } from "../shared/Panel";

export function CreationScreen(): ReactElement {
  const t = useTranslation();
  const contentLoop = useContentLoopStore((state) => state.contentLoop);
  const selectedProject = useContentLoopStore((state) => state.selectedProject);
  const selectedDraft = useContentLoopStore((state) => state.selectedDraft);
  const selectedXiaohongshuPackage = useContentLoopStore((state) => state.selectedXiaohongshuPackage);
  const selectedArchiveRecord = useContentLoopStore((state) => state.selectedArchiveRecord);
  const isGeneratingDraftPackage = useContentLoopStore((state) => state.isGeneratingDraftPackage);
  const isGeneratingPlatformPackage = useContentLoopStore((state) => state.isGeneratingPlatformPackage);
  const isArchivingProject = useContentLoopStore((state) => state.isArchivingProject);
  const draftPackageError = useContentLoopStore((state) => state.draftPackageError);
  const platformPackageError = useContentLoopStore((state) => state.platformPackageError);
  const archiveError = useContentLoopStore((state) => state.archiveError);
  const generateDraftPackage = useContentLoopStore((state) => state.generateDraftPackage);
  const generatePlatformPackage = useContentLoopStore((state) => state.generatePlatformPackage);
  const archiveProject = useContentLoopStore((state) => state.archiveProject);

  if (!selectedProject || !selectedDraft) {
    return <EmptyState title={t("creation.empty")} />;
  }

  return (
    <section className="creation-studio" aria-label={t("creation.title")}>
      <div className="screen-heading creation-actions">
        <h2>{t("creation.title")}</h2>
        <Button disabled={isGeneratingDraftPackage} onClick={() => void generateDraftPackage(selectedProject.id)}>
          {isGeneratingDraftPackage ? t("creation.generating") : t("creation.generateDraft")}
        </Button>
        <Button disabled={isGeneratingPlatformPackage} onClick={() => void generatePlatformPackage(selectedProject.id)}>
          {isGeneratingPlatformPackage ? t("creation.generating") : t("creation.generatePlatform")}
        </Button>
        <Button disabled={isArchivingProject} onClick={() => void archiveProject(selectedProject.id)} variant="secondary">
          {isArchivingProject ? t("creation.archiving") : t("creation.archive")}
        </Button>
        {[draftPackageError, platformPackageError, archiveError].filter(Boolean).map((error) => (
          <p className="inline-error" key={error} role="alert">
            {t(error as never)}
          </p>
        ))}
      </div>
      <Panel className="draft-panel">
        <p className="eyebrow">{t("creation.draftVersion", { version: selectedDraft.version })}</p>
        <h3>{selectedDraft.title}</h3>
        {selectedDraft.body.split("\n\n").map((block) => renderDraftBlock(block))}
      </Panel>
      <Panel className="source-panel" tone="recessed">
        <h3>{t("creation.sources")}</h3>
        {contentLoop?.sourceReferences
          .filter((source) => source.topicId === selectedProject.sourceTopicId || source.contentProjectId === selectedProject.id)
          .map((source) => (
            <article key={source.id}>
              <h4>{source.title}</h4>
              <p>{source.note}</p>
            </article>
          ))}
      </Panel>
      <Panel className="publish-package-panel" aria-label={t("package.title")}>
        <h3>{t("package.title")}</h3>
        {selectedXiaohongshuPackage ? (
          <>
            <PackageSection title={t("package.fieldTitle")} value={selectedXiaohongshuPackage.title} />
            <PackageSection title={t("package.body")} value={selectedXiaohongshuPackage.body} />
            <PackageSection title={t("package.tags")} value={selectedXiaohongshuPackage.tags.join(" ")} />
            <PackageSection title={t("package.coverText")} value={selectedXiaohongshuPackage.coverText} />
            <section>
              <h4>{t("package.requiredAssets")}</h4>
              <ul>{selectedXiaohongshuPackage.requiredAssets.map((asset) => <li key={asset}>{asset}</li>)}</ul>
            </section>
            <section>
              <h4>{t("package.checks")}</h4>
              <ul>
                {selectedXiaohongshuPackage.checks.map((check) => (
                  <li key={check.name}>
                    <strong>{check.status}</strong> {check.name}: {check.message}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <EmptyState title={t("package.noPackage")} />
        )}
      </Panel>
      <Panel className="archive-status-panel">
        <h3>{t("creation.archiveTitle")}</h3>
        {selectedArchiveRecord ? (
          <>
            <strong>{t("creation.archived")}</strong>
            <p>{selectedArchiveRecord.summary}</p>
          </>
        ) : (
          <p>{t("creation.notArchived")}</p>
        )}
      </Panel>
    </section>
  );
}

function renderDraftBlock(block: string): ReactElement {
  const [firstLine, ...rest] = block.split("\n");
  const sectionTitle = firstLine ?? "";
  const isSection = rest.length > 0 && /^[A-Z][A-Za-z ]+$/.test(sectionTitle);

  if (isSection) {
    return (
      <section className="draft-section" key={block}>
        <h4>{sectionTitle}</h4>
        {rest.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
    );
  }

  return <p key={block}>{block}</p>;
}

function PackageSection({ title, value }: { title: string; value: string }): ReactElement {
  return (
    <section>
      <h4>{title}</h4>
      <p>{value}</p>
    </section>
  );
}
```

- [ ] **Step 5: Route screens in AppShell**

Modify `apps/desktop/src/renderer/components/layout/AppShell.tsx` imports:

```tsx
import { CreationScreen } from "../screens/CreationScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { TopicScreen } from "../screens/TopicScreen";
```

Replace the workspace content expression:

```tsx
<div className="workspace-content">
  {screen === "dashboard" ? <DashboardScreen /> : null}
  {screen === "topics" ? <TopicScreen /> : null}
  {screen === "creation" ? <CreationScreen /> : null}
  {screen === "publish" ? <CreationScreen /> : null}
  {screen === "review" ? <CreationScreen /> : null}
  {screen === "knowledge" ? <DashboardScreen /> : null}
</div>
```

- [ ] **Step 6: Run topic and creation tests**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "promotes a topic|generates topics|generates a draft|generates and displays a Xiaohongshu package"
```

Expected: PASS for those focused flows.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/components/layout/AppShell.tsx apps/desktop/src/renderer/components/screens/TopicScreen.tsx apps/desktop/src/renderer/components/screens/CreationScreen.tsx
git commit -m "feat: migrate topic and creation screens"
```

---

## Task 5: Migrate Publish And Review Screens

**Files:**
- Create: `apps/desktop/src/renderer/components/screens/PublishScreen.tsx`
- Create: `apps/desktop/src/renderer/components/screens/ReviewScreen.tsx`
- Modify: `apps/desktop/src/renderer/components/layout/AppShell.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Update publish/review tests to Chinese task pages**

In `apps/desktop/src/renderer/App.test.tsx`, update the publish helper:

```tsx
await screen.findByRole("heading", { name: "小红书包" });
fireEvent.click(screen.getByRole("button", { name: "发布" }));
fireEvent.change(screen.getByLabelText("发布链接"), {
  target: { value: publishUrl }
});
fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));
await screen.findByText("已发布");
```

Update review actions:

```tsx
fireEvent.click(screen.getByRole("button", { name: "复盘" }));
fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
expect(await screen.findByText("复盘报告 v1")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "沉淀为知识" }));
expect(await screen.findByRole("status")).toHaveTextContent("知识已沉淀");
```

Update metrics labels:

```tsx
fireEvent.click(screen.getByRole("button", { name: "导入指标 CSV" }));
expect(await screen.findByText("本次导入匹配 1 行")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "保存导入指标" }));
expect(await screen.findByText("浏览")).toBeInTheDocument();
```

- [ ] **Step 2: Run the updated publish/review tests to verify they fail**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "saves a manual publish|imports and saves metrics|generates and displays a review|extracts review knowledge"
```

Expected: FAIL because publish and review screens are not implemented yet.

- [ ] **Step 3: Add publish screen**

Create `apps/desktop/src/renderer/components/screens/PublishScreen.tsx`:

```tsx
import type { ReactElement } from "react";
import { formatDatetimeLocalValue, toDatetimeLocalValue } from "../../datetime";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { FieldGroup } from "../shared/FieldGroup";
import { Panel } from "../shared/Panel";

export function PublishScreen(): ReactElement {
  const t = useTranslation();
  const selectedXiaohongshuPackage = useContentLoopStore((state) => state.selectedXiaohongshuPackage);
  const selectedPublishRecord = useContentLoopStore((state) => state.selectedPublishRecord);
  const selectedLatestMetricSnapshot = useContentLoopStore((state) => state.selectedLatestMetricSnapshot);
  const matchedRows = useContentLoopStore((state) => state.matchedMetricImportPreviewRows);
  const invalidRows = useContentLoopStore((state) => state.invalidMetricImportPreviewRows);
  const manualPublishDraft = useContentLoopStore((state) => state.manualPublishDraft);
  const setManualPublishDraft = useContentLoopStore((state) => state.setManualPublishDraft);
  const isSavingPublishRecord = useContentLoopStore((state) => state.isSavingPublishRecord);
  const isImportingMetrics = useContentLoopStore((state) => state.isImportingMetrics);
  const isSavingMetricImport = useContentLoopStore((state) => state.isSavingMetricImport);
  const publishRecordError = useContentLoopStore((state) => state.publishRecordError);
  const metricImportError = useContentLoopStore((state) => state.metricImportError);
  const metricSaveError = useContentLoopStore((state) => state.metricSaveError);
  const recordManualPublish = useContentLoopStore((state) => state.recordManualPublish);
  const importMetricCsv = useContentLoopStore((state) => state.importMetricCsv);
  const saveMetricImport = useContentLoopStore((state) => state.saveMetricImport);

  if (!selectedXiaohongshuPackage) {
    return <EmptyState title={t("publish.empty")} />;
  }

  const publishedAt = manualPublishDraft.publishedAt || formatDatetimeLocalValue(new Date());

  return (
    <section className="screen-stack" aria-label={t("publish.title")}>
      <div className="screen-heading">
        <h2>{t("publish.title")}</h2>
      </div>
      <Panel className="manual-publish-panel" aria-label={t("publish.manual")}>
        <h3>{t("publish.manual")}</h3>
        <FieldGroup
          label={t("publish.publishedAt")}
          onChange={(event) => setManualPublishDraft({ publishedAt: event.target.value })}
          type="datetime-local"
          value={selectedPublishRecord?.publishedAt ? toDatetimeLocalValue(selectedPublishRecord.publishedAt) : publishedAt}
        />
        <FieldGroup
          label={t("publish.url")}
          onChange={(event) => setManualPublishDraft({ url: event.target.value })}
          type="url"
          value={manualPublishDraft.url || selectedPublishRecord?.url || ""}
        />
        <FieldGroup
          label={t("publish.note")}
          onChange={(event) => setManualPublishDraft({ note: event.target.value })}
          type="text"
          value={manualPublishDraft.note || selectedPublishRecord?.note || ""}
        />
        <Button disabled={isSavingPublishRecord} onClick={() => void recordManualPublish(selectedXiaohongshuPackage.id)}>
          {isSavingPublishRecord ? t("publish.saving") : t("publish.save")}
        </Button>
        {publishRecordError ? <p className="inline-error" role="alert">{t(publishRecordError as never)}</p> : null}
      </Panel>
      {selectedPublishRecord ? (
        <Panel className="publish-record-summary">
          <strong>{t("publish.saved")}</strong>
          <p>{selectedPublishRecord.publishedAt}</p>
          <p>{selectedPublishRecord.url || t("publish.noUrl")}</p>
          {selectedPublishRecord.note ? <p>{selectedPublishRecord.note}</p> : null}
          {selectedLatestMetricSnapshot ? <MetricSnapshot /> : null}
        </Panel>
      ) : null}
      {selectedPublishRecord ? (
        <Panel className="metrics-import-panel" aria-label={t("metrics.importTitle")}>
          <h3>{t("metrics.importTitle")}</h3>
          <Button disabled={isImportingMetrics} onClick={() => void importMetricCsv()}>
            {isImportingMetrics ? t("metrics.importing") : t("metrics.importCsv")}
          </Button>
          {metricImportError ? <p className="inline-error" role="alert">{t(metricImportError as never)}</p> : null}
          {matchedRows.length || invalidRows.length ? (
            <div className="metric-import-preview">
              <p>{t("metrics.previewMatched", { count: matchedRows.length })}</p>
              <p>{t("metrics.previewInvalid", { count: invalidRows.length })}</p>
              {matchedRows.map((row) => <p key={row.rowNumber}>{t("metrics.row", { row: row.rowNumber, value: row.url || row.publishRecordId || "" })}</p>)}
              {invalidRows.map((row) => <p key={row.rowNumber}>{t("metrics.row", { row: row.rowNumber, value: row.error || "" })}</p>)}
              {matchedRows.length > 0 ? (
                <Button disabled={isImportingMetrics || isSavingMetricImport} onClick={() => void saveMetricImport()}>
                  {isSavingMetricImport ? t("metrics.saving") : t("metrics.saveImported")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {metricSaveError ? <p className="inline-error" role="alert">{t(metricSaveError as never)}</p> : null}
        </Panel>
      ) : null}
    </section>
  );
}

function MetricSnapshot(): ReactElement | null {
  const t = useTranslation();
  const snapshot = useContentLoopStore((state) => state.selectedLatestMetricSnapshot);

  if (!snapshot) {
    return null;
  }

  return (
    <dl className="metric-snapshot-summary">
      <div><dt>{t("metrics.views")}</dt><dd>{snapshot.views}</dd></div>
      <div><dt>{t("metrics.likes")}</dt><dd>{snapshot.likes}</dd></div>
      <div><dt>{t("metrics.favorites")}</dt><dd>{snapshot.favorites}</dd></div>
      <div><dt>{t("metrics.comments")}</dt><dd>{snapshot.comments}</dd></div>
      <div><dt>{t("metrics.shares")}</dt><dd>{snapshot.shares}</dd></div>
      <div><dt>{t("metrics.snapshot")}</dt><dd>{snapshot.snapshotAt}</dd></div>
    </dl>
  );
}
```

- [ ] **Step 4: Add review screen**

Create `apps/desktop/src/renderer/components/screens/ReviewScreen.tsx`:

```tsx
import type { ReactElement } from "react";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { Panel } from "../shared/Panel";

export function ReviewScreen(): ReactElement {
  const t = useTranslation();
  const selectedPublishRecord = useContentLoopStore((state) => state.selectedPublishRecord);
  const selectedLatestReviewReport = useContentLoopStore((state) => state.selectedLatestReviewReport);
  const isGeneratingReviewReport = useContentLoopStore((state) => state.isGeneratingReviewReport);
  const isExtractingReviewKnowledge = useContentLoopStore((state) => state.isExtractingReviewKnowledge);
  const reviewReportError = useContentLoopStore((state) => state.reviewReportError);
  const reviewKnowledgeResult = useContentLoopStore((state) => state.reviewKnowledgeResult);
  const reviewKnowledgeError = useContentLoopStore((state) => state.reviewKnowledgeError);
  const generateReviewReport = useContentLoopStore((state) => state.generateReviewReport);
  const extractReviewKnowledge = useContentLoopStore((state) => state.extractReviewKnowledge);

  if (!selectedPublishRecord) {
    return <EmptyState title={t("review.empty")} />;
  }

  return (
    <section className="screen-stack" aria-label={t("review.title")}>
      <div className="screen-heading">
        <h2>{t("review.title")}</h2>
        <Button disabled={isGeneratingReviewReport} onClick={() => void generateReviewReport(selectedPublishRecord.id)}>
          {isGeneratingReviewReport ? t("review.generating") : t("review.generate")}
        </Button>
        {reviewReportError ? <p className="inline-error" role="alert">{t(reviewReportError as never)}</p> : null}
      </div>
      {selectedLatestReviewReport ? (
        <Panel className="review-report-card">
          <p className="eyebrow">{t("review.reportVersion", { version: selectedLatestReviewReport.version })}</p>
          <p>{t("review.generatedAt", { time: selectedLatestReviewReport.createdAt })}</p>
          <p>{selectedLatestReviewReport.summary}</p>
          <ReportList title={t("review.highlights")} items={selectedLatestReviewReport.highlights} />
          <ReportList title={t("review.underperforming")} items={selectedLatestReviewReport.underperformingSignals} />
          <ReportList title={t("review.causes")} items={selectedLatestReviewReport.likelyCauses} />
          <ReportList title={t("review.nextActions")} items={selectedLatestReviewReport.nextActions} />
          <Button disabled={isExtractingReviewKnowledge} onClick={() => void extractReviewKnowledge(selectedLatestReviewReport.id)}>
            {isExtractingReviewKnowledge ? t("review.extracting") : t("review.extractKnowledge")}
          </Button>
          {reviewKnowledgeResult?.kind === "success" ? <p role="status">{t(reviewKnowledgeResult.textKey)}</p> : null}
          {reviewKnowledgeResult?.kind === "blocked" ? <p className="inline-error" role="alert">{t(reviewKnowledgeResult.textKey)}</p> : null}
          {reviewKnowledgeError ? <p className="inline-error" role="alert">{t(reviewKnowledgeError as never)}</p> : null}
        </Panel>
      ) : null}
    </section>
  );
}

function ReportList({ items, title }: { items: string[]; title: string }): ReactElement {
  return (
    <section>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
```

- [ ] **Step 5: Route publish and review screens**

Modify `apps/desktop/src/renderer/components/layout/AppShell.tsx` imports:

```tsx
import { PublishScreen } from "../screens/PublishScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
```

Replace temporary routing:

```tsx
{screen === "publish" ? <PublishScreen /> : null}
{screen === "review" ? <ReviewScreen /> : null}
```

- [ ] **Step 6: Run publish/review tests**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "saves a manual publish|imports and saves metrics|generates and displays a review|extracts review knowledge"
```

Expected: PASS for those focused flows.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/components/layout/AppShell.tsx apps/desktop/src/renderer/components/screens/PublishScreen.tsx apps/desktop/src/renderer/components/screens/ReviewScreen.tsx
git commit -m "feat: migrate publish and review screens"
```

---

## Task 6: Migrate Knowledge Screen And Complete Tests

**Files:**
- Create: `apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx`
- Modify: `apps/desktop/src/renderer/components/layout/AppShell.tsx`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Update knowledge tests to Chinese labels**

In `apps/desktop/src/renderer/App.test.tsx`, update knowledge navigation:

```tsx
fireEvent.click(screen.getByRole("button", { name: "知识库" }));
expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
```

Update archive labels:

```tsx
fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
await screen.findByText("已归档");
expect(await screen.findByRole("alert")).toHaveTextContent("项目归档失败，请重试。");
```

- [ ] **Step 2: Run the full renderer test file to verify remaining failures**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: FAIL only for remaining knowledge/archive label or routing mismatches.

- [ ] **Step 3: Add knowledge screen**

Create `apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx`:

```tsx
import type { ReactElement } from "react";
import { useTranslation } from "../../i18n";
import { useContentLoopStore } from "../../stores/content-loop-store";
import { EmptyState } from "../shared/EmptyState";
import { Panel } from "../shared/Panel";
import { StatusBadge } from "../shared/StatusBadge";

export function KnowledgeScreen(): ReactElement {
  const t = useTranslation();
  const knowledgeItems = useContentLoopStore((state) => state.contentLoop?.knowledgeItems ?? []);

  return (
    <section className="screen-stack knowledge-list" aria-label={t("knowledge.title")}>
      <div className="screen-heading">
        <h2>{t("knowledge.title")}</h2>
      </div>
      {knowledgeItems.length === 0 ? (
        <EmptyState title={t("knowledge.empty")} />
      ) : (
        knowledgeItems.map((knowledgeItem) => (
          <Panel className="knowledge-card" key={knowledgeItem.id}>
            <p className="eyebrow">{knowledgeItem.columnSlug}</p>
            <h3>{knowledgeItem.title}</h3>
            <div className="knowledge-card__tags">
              {knowledgeItem.tags.map((tag) => (
                <StatusBadge key={tag} tone="info">{tag}</StatusBadge>
              ))}
            </div>
            <p>{knowledgeItem.lesson}</p>
            <p>{knowledgeItem.evidence}</p>
          </Panel>
        ))
      )}
    </section>
  );
}
```

- [ ] **Step 4: Route knowledge screen**

Modify `apps/desktop/src/renderer/components/layout/AppShell.tsx` imports:

```tsx
import { KnowledgeScreen } from "../screens/KnowledgeScreen";
```

Replace temporary knowledge routing:

```tsx
{screen === "knowledge" ? <KnowledgeScreen /> : null}
```

- [ ] **Step 5: Run full renderer tests**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/src/renderer/App.test.tsx apps/desktop/src/renderer/components/layout/AppShell.tsx apps/desktop/src/renderer/components/screens/KnowledgeScreen.tsx
git commit -m "feat: migrate knowledge screen"
```

---

## Task 7: Apply Warm Desktop Styling

**Files:**
- Modify: `apps/desktop/src/renderer/styles.css`
- Modify: `apps/desktop/src/renderer/App.test.tsx`

- [ ] **Step 1: Add style smoke assertion**

In the shell test in `apps/desktop/src/renderer/App.test.tsx`, add:

```tsx
expect(screen.getByRole("main")).toHaveClass("app-shell");
```

- [ ] **Step 2: Run style smoke test to verify it fails**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "renders the Chinese taskflow shell"
```

Expected: FAIL because the CSS has not been replaced with warm desktop tokens.

- [ ] **Step 3: Replace global tokens and shell styles**

Replace the top of `apps/desktop/src/renderer/styles.css`:

```css
:root {
  --color-surface: #faf9f5;
  --color-surface-low: #f4f4f0;
  --color-surface-raised: #ffffff;
  --color-text-primary: #1b1c1a;
  --color-text-secondary: #5f5d58;
  --color-text-tertiary: #8a8580;
  --color-border-subtle: #e4e0d8;
  --color-brand: #8f482f;
  --color-brand-soft: #ffdbd0;
  --color-success: #677b4e;
  --color-danger: #ab2b3f;
  --color-info: #2d628f;
  color: var(--color-text-primary);
  background: var(--color-surface);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Microsoft YaHei", "PingFang SC", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.loading-shell {
  align-items: center;
  color: var(--color-text-secondary);
  display: flex;
  justify-content: center;
  min-height: 100vh;
}

.app-shell {
  background: var(--color-surface);
  color: var(--color-text-primary);
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  background: var(--color-surface-low);
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 18px 14px;
}

.brand-lockup {
  align-items: center;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.brand-mark {
  align-items: center;
  background: linear-gradient(180deg, var(--color-brand), #6f3825);
  border-radius: 10px;
  color: #ffffff;
  display: flex;
  font-weight: 800;
  height: 40px;
  justify-content: center;
  width: 40px;
}

.brand-lockup strong,
.brand-lockup span {
  display: block;
}

.brand-lockup span {
  color: var(--color-text-tertiary);
  font-size: 12px;
  margin-top: 2px;
}

.sidebar-nav {
  display: grid;
  gap: 6px;
}

.nav-button {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 10px;
  min-height: 36px;
  padding: 8px 10px;
  text-align: left;
}

.nav-button:hover,
.nav-button--active {
  background: #f0ede8;
  color: var(--color-text-primary);
}

.workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.workspace-header {
  align-items: flex-start;
  background: var(--color-surface);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 24px 28px 18px;
}

.workspace-header__context {
  min-width: 0;
}

.workspace-header h1 {
  font-size: 24px;
  line-height: 1.2;
  margin: 0;
}

.workspace-header p {
  color: var(--color-text-secondary);
  margin: 6px 0 0;
}

.workspace-header__badges,
.workspace-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-metrics {
  justify-content: flex-end;
}

.workspace-metrics span {
  background: var(--color-surface-low);
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
  padding: 8px 10px;
}

.workspace-content {
  min-width: 0;
  padding: 0 28px 28px;
}
```

- [ ] **Step 4: Add component and screen styles**

Append or replace the remaining `styles.css` with:

```css
.eyebrow {
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 800;
  margin: 0 0 6px;
  text-transform: uppercase;
}

.screen-stack {
  display: grid;
  gap: 16px;
}

.screen-heading {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}

.screen-heading h2 {
  font-size: 22px;
  margin: 0;
}

.panel {
  border-radius: 12px;
  display: grid;
  gap: 14px;
  padding: 18px;
}

.panel--raised {
  background: var(--color-surface-raised);
}

.panel--recessed {
  background: var(--color-surface-low);
}

.button {
  align-items: center;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-weight: 700;
  gap: 8px;
  justify-content: center;
  min-height: 36px;
  padding: 8px 12px;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.button--primary {
  background: linear-gradient(180deg, var(--color-brand), #6f3825);
  color: #ffffff;
}

.button--secondary {
  background: var(--color-surface-low);
  color: var(--color-text-primary);
}

.button--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.status-badge {
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 8px;
}

.status-badge--neutral {
  background: var(--color-surface-low);
  color: var(--color-text-secondary);
}

.status-badge--success {
  background: #e7eddd;
  color: var(--color-success);
}

.status-badge--warning {
  background: var(--color-brand-soft);
  color: var(--color-brand);
}

.status-badge--danger {
  background: #f7dce0;
  color: var(--color-danger);
}

.status-badge--info {
  background: #e0ebf4;
  color: var(--color-info);
}

.summary-grid,
.topic-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.column-card__header,
.topic-card__meta {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.column-card h3,
.topic-card h3,
.draft-panel h3,
.publish-package-panel h3,
.source-panel h3,
.manual-publish-panel h3,
.metrics-import-panel h3,
.review-report-card h3,
.knowledge-card h3 {
  font-size: 17px;
  margin: 0;
}

.column-card p,
.topic-card p,
.publish-package-panel p,
.source-panel p,
.review-report-card p,
.knowledge-card p {
  color: var(--color-text-secondary);
  margin: 0;
}

.column-card dl,
.score-grid,
.metric-snapshot-summary {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.column-card dl div,
.score-grid div,
.metric-snapshot-summary div {
  background: var(--color-surface-low);
  border-radius: 8px;
  padding: 10px;
}

dt {
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 800;
}

dd {
  font-weight: 800;
  margin: 4px 0 0;
}

.topic-toolbar,
.creation-actions {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.topic-toolbar label,
.field-group {
  color: var(--color-text-secondary);
  display: grid;
  font-size: 13px;
  font-weight: 800;
  gap: 6px;
}

.topic-toolbar select,
.field-group input {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  color: var(--color-text-primary);
  font: inherit;
  min-width: 0;
  padding: 9px 10px;
}

.inline-error {
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 800;
  margin: 0;
}

.creation-studio {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 340px;
}

.creation-actions,
.publish-package-panel,
.archive-status-panel {
  grid-column: 1 / -1;
}

.draft-section {
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 12px;
}

.draft-section h4,
.publish-package-panel h4,
.source-panel h4 {
  margin: 0 0 6px;
}

.manual-publish-panel,
.metrics-import-panel,
.review-report-card {
  align-items: start;
}

.publish-record-summary,
.metric-import-preview {
  background: var(--color-surface-low);
  border-radius: 10px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.knowledge-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-state {
  background: var(--color-surface-low);
  border-radius: 12px;
  color: var(--color-text-secondary);
  display: grid;
  gap: 6px;
  padding: 22px;
}

.empty-state strong {
  color: var(--color-text-primary);
}

.empty-state p {
  margin: 0;
}

@media (max-width: 820px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    padding: 12px;
  }

  .sidebar-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .workspace-header {
    display: grid;
    padding: 18px;
  }

  .workspace-metrics {
    justify-content: flex-start;
  }

  .workspace-content {
    padding: 0 18px 18px;
  }

  .creation-studio,
  .summary-grid,
  .topic-grid,
  .column-card dl,
  .score-grid,
  .metric-snapshot-summary {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run style smoke test**

Run:

```bash
npm --workspace @robert-station/desktop test -- apps/desktop/src/renderer/App.test.tsx -t "renders the Chinese taskflow shell"
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/src/renderer/styles.css apps/desktop/src/renderer/App.test.tsx
git commit -m "style: apply warm taskflow desktop UI"
```

---

## Task 8: Final Verification And Fixes

**Files:**
- Modify as needed only for failures found by verification.

- [ ] **Step 1: Run renderer tests**

Run:

```bash
npm --workspace @robert-station/desktop test
```

Expected: PASS. If a test fails, read the exact failure, fix the smallest related renderer file, and rerun the same command.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS. If a package test unrelated to the renderer fails, inspect whether the renderer changes changed shared behavior. Do not modify core/local-store unless the failure proves a renderer-facing type contract changed.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS. Fix strict TypeScript issues without loosening types.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` has no output. `git status --short` shows only intentional files if there are uncommitted verification fixes.

- [ ] **Step 6: Commit final verification fixes if any**

If verification required fixes, run:

```bash
git add apps/desktop/src/renderer apps/desktop/package.json package-lock.json
git commit -m "fix: stabilize taskflow renderer redesign"
```

Expected: commit succeeds. If no fixes were needed, skip this step.

---

## Self-Review

- Spec coverage:
  - Taskflow navigation is covered by Tasks 3-6.
  - Zustand stores are covered by Tasks 1-2.
  - i18n with Simplified Chinese default is covered by Task 1 and task screen migrations.
  - cc-haha-inspired warm visual system is covered by Task 7.
  - Existing IPC/core/local-store behavior is preserved by moving calls behind store actions in Task 2.
  - Renderer tests and full verification are covered by Tasks 1-8.
- Red-flag scan:
  - No vague markers or open-ended testing steps remain.
- Type consistency:
  - `TaskScreen`, store action names, i18n key names, and component imports are introduced before use.
  - Manual publish and review stale-response behavior remain in `content-loop-store.ts`.
