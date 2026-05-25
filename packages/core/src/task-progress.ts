import { createEntityId } from "./ids";
import type { TaskRun, TaskRunKind, TaskRunPhase, TaskRunStatus } from "./types";

export interface CreateTaskRunInput {
  workspaceId: string;
  kind: TaskRunKind;
  label: string;
  totalCount: number;
  now?: Date;
}

export interface AdvanceTaskRunInput {
  phase: TaskRunPhase;
  completedCount?: number;
  totalCount?: number;
  message?: string;
  now?: Date;
}

export function createTaskRun(input: CreateTaskRunInput): TaskRun {
  const timestamp = (input.now ?? new Date()).toISOString();

  return {
    id: createEntityId("task", `${input.kind}-robert-station-export`),
    workspaceId: input.workspaceId,
    kind: input.kind,
    label: input.label,
    phase: "queued",
    status: "queued",
    completedCount: 0,
    totalCount: input.totalCount,
    message: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function advanceTaskRun(task: TaskRun, input: AdvanceTaskRunInput): TaskRun {
  return {
    ...task,
    phase: input.phase,
    status: statusForPhase(input.phase),
    completedCount: input.completedCount ?? task.completedCount,
    totalCount: input.totalCount ?? task.totalCount,
    message: input.message ?? task.message,
    updatedAt: (input.now ?? new Date()).toISOString()
  };
}

export function failTaskRun(task: TaskRun, message: string, now = new Date()): TaskRun {
  return {
    ...task,
    phase: "failed",
    status: "failed",
    message,
    updatedAt: now.toISOString()
  };
}

function statusForPhase(phase: TaskRunPhase): TaskRunStatus {
  if (phase === "completed") {
    return "completed";
  }

  if (phase === "failed") {
    return "failed";
  }

  if (phase === "queued") {
    return "queued";
  }

  return "running";
}
