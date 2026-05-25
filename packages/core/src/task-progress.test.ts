import { describe, expect, it } from "vitest";
import { advanceTaskRun, createTaskRun, failTaskRun } from "./task-progress";

const now = new Date("2026-05-25T08:00:00.000Z");
const later = new Date("2026-05-25T08:01:00.000Z");

describe("task progress", () => {
  it("creates a queued task run with progress metadata", () => {
    const task = createTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "export",
      label: "导出资料库",
      totalCount: 3,
      now
    });

    expect(task).toMatchObject({
      id: "task_export-robert-station-export",
      workspaceId: "workspace_robert-station",
      kind: "export",
      label: "导出资料库",
      phase: "queued",
      status: "queued",
      completedCount: 0,
      totalCount: 3,
      message: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
  });

  it("advances a task run through a running phase", () => {
    const task = createTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "source_import",
      label: "导入参考资料",
      totalCount: 2,
      now
    });

    const running = advanceTaskRun(task, {
      phase: "parsing",
      completedCount: 1,
      message: "已解析 1 条资料",
      now: later
    });

    expect(running).toMatchObject({
      phase: "parsing",
      status: "running",
      completedCount: 1,
      totalCount: 2,
      message: "已解析 1 条资料",
      updatedAt: later.toISOString()
    });
  });

  it("marks a task as completed when advanced to completed phase", () => {
    const task = createTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "generation",
      label: "生成选题",
      totalCount: 1,
      now
    });

    const completed = advanceTaskRun(task, {
      phase: "completed",
      completedCount: 1,
      now: later
    });

    expect(completed.status).toBe("completed");
    expect(completed.completedCount).toBe(1);
  });

  it("marks a task as failed with an error message", () => {
    const task = createTaskRun({
      workspaceId: "workspace_robert-station",
      kind: "source_import",
      label: "导入参考资料",
      totalCount: 2,
      now
    });

    const failed = failTaskRun(task, "链接无法读取", later);

    expect(failed).toMatchObject({
      phase: "failed",
      status: "failed",
      message: "链接无法读取",
      updatedAt: later.toISOString()
    });
  });
});
