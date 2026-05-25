import { createEntityId } from "./ids";
import type { ContentProject, DraftVersion, SourceReference, Topic } from "./types";

interface GenerateMockDraftPackageRequest {
  project: ContentProject;
  topic?: Topic | null;
  sourceReferences: SourceReference[];
  nextVersion: number;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function generateMockDraftPackage(request: GenerateMockDraftPackageRequest): DraftVersion {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const sourceNotes = request.sourceReferences.map((source) => source.note).filter((note) => note.length > 0);
  const hook = request.topic?.hook ?? "讲清楚核心问题，并给出一个可复用的解决方案。";
  const audience = request.topic?.audience ?? "希望获得实用、可复用改进方法的读者。";
  const columnLabel = request.topic?.columnSlug ?? request.project.primaryColumnId.replace(/^column_/, "");
  const verificationLines =
    sourceNotes.length > 0 ? sourceNotes : ["发布前请核实示例、论断和平台规则。"];

  return {
    id: createEntityId("draft", `${request.project.id}-${request.nextVersion}`),
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    version: request.nextVersion,
    title: request.project.title,
    body: [
      "简报",
      `受众： ${audience}`,
      `角度： ${hook}`,
      `栏目： ${columnLabel}`,
      "",
      "标题选项",
      `1. ${request.project.title}`,
      `2. ${request.project.title}：一个实用工作流`,
      "3. 我把它改造成可复用系统后的变化",
      "",
      "正文草稿",
      `用具体问题开场：${hook}`,
      "用三步解释可复用工作流：收集输入、用清晰的助手角色处理、归档输出以便复用。",
      "加入一条个人操作笔记，让草稿更具体而不是泛泛而谈。",
      "用一个读者今天就能尝试的动作收尾。",
      "",
      "封面文案",
      "让工作流可视化",
      "",
      "标签建议",
      `#${columnLabel}`,
      "#workflow",
      "#creator-system",
      "#content-ops",
      "",
      "视觉方向",
      "使用清晰的清单或前后对比工作流图。封面文字保持短且易读。",
      "",
      "待核实",
      ...verificationLines.map((line, index) => `${index + 1}. ${line}`)
    ].join("\n"),
    createdBy: "assistant",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
