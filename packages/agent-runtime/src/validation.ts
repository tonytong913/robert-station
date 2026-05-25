import type { AgentDraftPackage, GenerateTopicsOutput } from "./types";

const SUPPORTED_PLATFORMS = new Set(["xiaohongshu", "douyin", "wechat_channels", "bilibili"]);

export function isGenerateTopicsOutput(value: unknown): value is GenerateTopicsOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const output = value as Partial<GenerateTopicsOutput>;
  return Array.isArray(output.candidates) && output.candidates.every(isAgentTopicCandidate);
}

export function isAgentDraftPackage(value: unknown): value is AgentDraftPackage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draftPackage = value as Partial<AgentDraftPackage>;
  return (
    typeof draftPackage.brief === "string" &&
    draftPackage.brief.length > 0 &&
    isStringArray(draftPackage.titleOptions) &&
    draftPackage.titleOptions.length > 0 &&
    typeof draftPackage.bodyDraft === "string" &&
    draftPackage.bodyDraft.length > 0 &&
    typeof draftPackage.coverCopy === "string" &&
    draftPackage.coverCopy.length > 0 &&
    isStringArray(draftPackage.tags) &&
    isStringArray(draftPackage.pendingVerification) &&
    typeof draftPackage.visualDirection === "string" &&
    draftPackage.visualDirection.length > 0
  );
}

function isAgentTopicCandidate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    candidate.title.length > 0 &&
    typeof candidate.hook === "string" &&
    candidate.hook.length > 0 &&
    typeof candidate.audience === "string" &&
    candidate.audience.length > 0 &&
    Array.isArray(candidate.targetPlatforms) &&
    candidate.targetPlatforms.every((platform) => typeof platform === "string" && SUPPORTED_PLATFORMS.has(platform)) &&
    isTopicScore(candidate.score) &&
    isStringArray(candidate.sourceNotes) &&
    isStringArray(candidate.riskNotes) &&
    isStringArray(candidate.verificationNotes)
  );
}

function isTopicScore(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const score = value as Record<string, unknown>;
  return (
    typeof score.heat === "number" &&
    typeof score.fit === "number" &&
    typeof score.difficulty === "number" &&
    typeof score.personaConsistency === "number"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
