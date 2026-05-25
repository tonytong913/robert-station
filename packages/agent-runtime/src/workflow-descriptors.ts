import type { ContentColumnSlug, Platform } from "@robert-station/core";

export type ContentWorkflowChannel = Platform | "wechat_official_account" | "toutiao";
export type ContentWorkflowModality = "image_text" | "short_video" | "long_form_article" | "light_app";
export type ContentWorkflowRiskLevel = "low" | "medium" | "high";
export type ContentWorkflowStageKind =
  | "topic"
  | "source"
  | "risk_check"
  | "draft"
  | "script"
  | "prototype"
  | "channel_package"
  | "human_review";

export interface ContentWorkflowStage {
  kind: ContentWorkflowStageKind;
  label: string;
}

export interface ContentWorkflowDescriptor {
  id: string;
  channel: ContentWorkflowChannel;
  modality: ContentWorkflowModality;
  columnSlug: ContentColumnSlug;
  riskLevel: ContentWorkflowRiskLevel;
  stages: ContentWorkflowStage[];
}

export interface ContentWorkflowDescriptorRequest {
  channel: ContentWorkflowChannel;
  modality: ContentWorkflowModality;
  columnSlug: ContentColumnSlug;
}

const IMAGE_TEXT_STAGES: ContentWorkflowStage[] = [
  { kind: "topic", label: "Topic discovery" },
  { kind: "source", label: "Source collection" },
  { kind: "risk_check", label: "Risk and verification check" },
  { kind: "draft", label: "Image/text draft" },
  { kind: "channel_package", label: "Channel package" },
  { kind: "human_review", label: "Human review" }
];

const SHORT_VIDEO_STAGES: ContentWorkflowStage[] = [
  { kind: "topic", label: "Topic discovery" },
  { kind: "source", label: "Source collection" },
  { kind: "risk_check", label: "Risk and verification check" },
  { kind: "script", label: "Script and shot plan" },
  { kind: "channel_package", label: "Channel package" },
  { kind: "human_review", label: "Human review" }
];

const LONG_FORM_STAGES: ContentWorkflowStage[] = [
  { kind: "topic", label: "Topic discovery" },
  { kind: "source", label: "Source collection" },
  { kind: "risk_check", label: "Risk and verification check" },
  { kind: "draft", label: "Long-form article draft" },
  { kind: "channel_package", label: "Channel package" },
  { kind: "human_review", label: "Human review" }
];

const LIGHT_APP_STAGES: ContentWorkflowStage[] = [
  { kind: "topic", label: "Topic discovery" },
  { kind: "source", label: "Source collection" },
  { kind: "risk_check", label: "Risk and verification check" },
  { kind: "prototype", label: "Light app prototype brief" },
  { kind: "human_review", label: "Human review" }
];

const DESCRIPTORS: ContentWorkflowDescriptor[] = [
  createDescriptor("xiaohongshu", "image_text", "ai", "medium", IMAGE_TEXT_STAGES),
  createDescriptor("xiaohongshu", "image_text", "finance", "high", IMAGE_TEXT_STAGES),
  createDescriptor("xiaohongshu", "image_text", "parenting", "high", IMAGE_TEXT_STAGES),
  createDescriptor("douyin", "short_video", "fitness", "medium", SHORT_VIDEO_STAGES),
  createDescriptor("wechat_channels", "short_video", "parenting", "high", SHORT_VIDEO_STAGES),
  createDescriptor("wechat_official_account", "long_form_article", "finance", "high", LONG_FORM_STAGES),
  createDescriptor("wechat_official_account", "long_form_article", "ai", "medium", LONG_FORM_STAGES),
  createDescriptor("bilibili", "short_video", "ai", "medium", SHORT_VIDEO_STAGES),
  createDescriptor("toutiao", "long_form_article", "parenting", "high", LONG_FORM_STAGES),
  createDescriptor("xiaohongshu", "light_app", "ai", "medium", LIGHT_APP_STAGES)
];

export function listContentWorkflowDescriptors(): ContentWorkflowDescriptor[] {
  return DESCRIPTORS.map(cloneDescriptor);
}

export function getContentWorkflowDescriptor(
  request: ContentWorkflowDescriptorRequest
): ContentWorkflowDescriptor | undefined {
  const descriptor = DESCRIPTORS.find(
    (candidate) =>
      candidate.channel === request.channel &&
      candidate.modality === request.modality &&
      candidate.columnSlug === request.columnSlug
  );

  return descriptor ? cloneDescriptor(descriptor) : undefined;
}

function createDescriptor(
  channel: ContentWorkflowChannel,
  modality: ContentWorkflowModality,
  columnSlug: ContentColumnSlug,
  riskLevel: ContentWorkflowRiskLevel,
  stages: ContentWorkflowStage[]
): ContentWorkflowDescriptor {
  return {
    id: `${channel}-${modalitySlug(modality)}-${columnSlug}`.replaceAll("_", "-"),
    channel,
    modality,
    columnSlug,
    riskLevel,
    stages
  };
}

function modalitySlug(modality: ContentWorkflowModality): string {
  return modality === "long_form_article" ? "long_form" : modality;
}

function cloneDescriptor(descriptor: ContentWorkflowDescriptor): ContentWorkflowDescriptor {
  return {
    ...descriptor,
    stages: descriptor.stages.map((stage) => ({ ...stage }))
  };
}
