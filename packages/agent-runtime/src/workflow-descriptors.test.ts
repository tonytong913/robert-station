import { describe, expect, it } from "vitest";
import { getContentWorkflowDescriptor, listContentWorkflowDescriptors } from "./index";

describe("content workflow descriptors", () => {
  it("lists channel modality column workflow descriptors", () => {
    const descriptors = listContentWorkflowDescriptors();

    expect(descriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "xiaohongshu-image-text-ai",
          channel: "xiaohongshu",
          modality: "image_text",
          columnSlug: "ai"
        }),
        expect.objectContaining({
          id: "wechat-official-account-long-form-finance",
          channel: "wechat_official_account",
          modality: "long_form_article",
          columnSlug: "finance"
        }),
        expect.objectContaining({
          id: "douyin-short-video-fitness",
          channel: "douyin",
          modality: "short_video",
          columnSlug: "fitness"
        })
      ])
    );
  });

  it("returns descriptor with ordered workflow stages", () => {
    const descriptor = getContentWorkflowDescriptor({
      channel: "wechat_channels",
      modality: "short_video",
      columnSlug: "parenting"
    });

    expect(descriptor?.stages.map((stage) => stage.kind)).toEqual([
      "topic",
      "source",
      "risk_check",
      "script",
      "channel_package",
      "human_review"
    ]);
    expect(descriptor?.riskLevel).toBe("high");
  });

  it("returns undefined for unsupported workflow combinations", () => {
    const descriptor = getContentWorkflowDescriptor({
      channel: "toutiao",
      modality: "light_app",
      columnSlug: "fitness"
    });

    expect(descriptor).toBeUndefined();
  });
});
