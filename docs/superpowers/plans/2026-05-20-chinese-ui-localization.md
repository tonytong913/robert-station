# Chinese UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the visible desktop renderer UI into Chinese without changing persisted domain values or generated content.

**Architecture:** Keep localization in `apps/desktop/src/renderer/App.tsx` as display-only mappings and helper functions. Preserve screen identifiers, status values, slugs, IPC payloads, generated draft/report text, and persisted data as-is.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

---

### Task 1: Renderer UI Copy

**Files:**
- Modify: `apps/desktop/src/renderer/App.test.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Write the failing test**

Update existing renderer assertions and accessible-name lookups to expect Chinese UI labels such as `加载内容工作流...`, `选题池`, `生成选题`, `创作工作台`, `小红书发布包`, `保存发布记录`, `导入数据 CSV`, `复盘报告 v1`, and Chinese error messages.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm --workspace @robert-station/desktop test -- App.test.tsx`

Expected: FAIL because `App.tsx` still renders English UI copy.

- [ ] **Step 3: Write minimal implementation**

Add display mappings and helpers in `App.tsx`, then replace visible strings, `aria-label` values, button text, empty states, headings, and inline errors with Chinese copy. Do not translate user/generated content, URLs, platform ids, status ids, or IPC arguments.

- [ ] **Step 4: Run verification**

Run:
```bash
npm --workspace @robert-station/desktop test -- App.test.tsx
npm run typecheck
npm test
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit and push**

Stage only localization files and this plan:
```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/App.test.tsx docs/superpowers/plans/2026-05-20-chinese-ui-localization.md
git commit -m "feat: localize desktop ui to Chinese"
git push
```
