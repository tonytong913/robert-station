import { describe, expect, it, vi } from "vitest";
import { InMemoryContentLoopRepository } from "./content-loop-repository";

describe("InMemoryContentLoopRepository", () => {
  it("loads the seeded content loop state", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const state = await repository.loadContentLoop();

    expect(state.topics).toHaveLength(4);
    expect(state.projects).toHaveLength(0);
    expect(state.drafts).toHaveLength(0);
    expect(state.platformPackages).toHaveLength(0);
    expect(state.publishRecords).toHaveLength(0);
    expect(state.archiveRecords).toHaveLength(0);
    expect(state.knowledgeItems).toHaveLength(0);
    expect(state.selectedProjectId).toBeNull();
  });

  it("promotes a topic and persists the updated state in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const topicId = before.topics[0]?.id;

    if (!topicId) {
      throw new Error("Expected seeded repository to include a first topic.");
    }

    const afterPromote = await repository.promoteTopic(topicId);
    const afterReload = await repository.loadContentLoop();

    expect(afterPromote.projects).toHaveLength(1);
    expect(afterPromote.drafts).toHaveLength(1);
    expect(afterPromote.topics.find((topic) => topic.id === topicId)?.status).toBe("promoted");
    expect(afterReload).toEqual(afterPromote);
  });

  it("generates mock topics in memory without duplicating repeated requests", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");

    const afterGenerate = await repository.generateTopics("ai");
    const afterRepeat = await repository.generateTopics("ai");

    expect(afterGenerate.topics).toHaveLength(6);
    expect(afterGenerate.sourceReferences).toHaveLength(6);
    expect(afterGenerate.topics.some((topic) => topic.id === "topic_ai_mock-workflow-automations")).toBe(true);
    expect(afterRepeat.topics).toHaveLength(6);
    expect(afterRepeat.sourceReferences).toHaveLength(6);
  });

  it("generates the next draft package in memory for a promoted project", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterGenerate = await repository.generateDraftPackage(projectId);

    expect(afterGenerate.drafts.filter((draft) => draft.contentProjectId === projectId)).toHaveLength(2);
    expect(afterGenerate.drafts[0]?.version).toBe(2);
    expect(afterGenerate.drafts[0]?.body).toContain("Title Options");
    expect(afterGenerate.selectedProjectId).toBe(projectId);
  });

  it("generates a Xiaohongshu platform package in memory for the latest draft", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    const afterDraft = await repository.generateDraftPackage(projectId);
    const latestDraft = afterDraft.drafts.find((draft) => draft.contentProjectId === projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");

    expect(afterPackage.platformPackages).toHaveLength(1);
    expect(afterPackage.platformPackages[0]?.platform).toBe("xiaohongshu");
    expect(afterPackage.platformPackages[0]?.contentProjectId).toBe(projectId);
    expect(afterPackage.platformPackages[0]?.draftVersionId).toBe(latestDraft?.id);
    expect(afterPackage.platformPackages[0]?.tags).toContain("#ai");
    expect(afterPackage.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory platform package for repeated generation on the same draft", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterFirstPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterSecondPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");

    expect(afterFirstPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages).toHaveLength(1);
    expect(afterSecondPackage.platformPackages[0]?.id).toBe(afterFirstPackage.platformPackages[0]?.id);
  });

  it("does not insert a platform package when the project is missing", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const before = await repository.loadContentLoop();
    const afterGenerate = await repository.generatePlatformPackage("project_missing", "xiaohongshu");

    expect(afterGenerate).toEqual(before);
  });

  it("records a manual publish in memory and marks the project as published", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "Published manually."
    });

    expect(afterPublish.publishRecords).toHaveLength(1);
    expect(afterPublish.publishRecords[0]?.platformPackageId).toBe(packageId);
    expect(afterPublish.projects.find((project) => project.id === projectId)?.status).toBe("published");
    expect(afterPublish.selectedProjectId).toBe(projectId);
  });

  it("replaces the same in-memory publish record and preserves createdAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    const afterPackage = await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const packageId = afterPackage.platformPackages[0]?.id;

    if (!packageId) {
      throw new Error("Expected a generated platform package.");
    }

    const afterFirstPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T15:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/first"
    });
    const afterSecondPublish = await repository.recordManualPublish({
      platformPackageId: packageId,
      publishedAt: "2026-05-19T16:00:00.000Z",
      url: "https://www.xiaohongshu.com/explore/second"
    });

    expect(afterSecondPublish.publishRecords).toHaveLength(1);
    expect(afterSecondPublish.publishRecords[0]?.id).toBe(afterFirstPublish.publishRecords[0]?.id);
    expect(afterSecondPublish.publishRecords[0]?.createdAt).toBe(afterFirstPublish.publishRecords[0]?.createdAt);
    expect(afterSecondPublish.publishRecords[0]?.url).toBe("https://www.xiaohongshu.com/explore/second");
  });

  it("orders multiple in-memory publish records newest first by publishedAt", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterFirstPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const firstProjectId = afterFirstPromote.selectedProjectId;

    if (!firstProjectId) {
      throw new Error("Expected first promoted project to be selected.");
    }

    await repository.generateDraftPackage(firstProjectId);
    const afterFirstPackage = await repository.generatePlatformPackage(firstProjectId, "xiaohongshu");
    const firstPackageId = afterFirstPackage.platformPackages.find(
      (platformPackage) => platformPackage.contentProjectId === firstProjectId
    )?.id;

    if (!firstPackageId) {
      throw new Error("Expected a generated platform package for the first project.");
    }

    const afterSecondPromote = await repository.promoteTopic("topic_finance-family-dashboard");
    const secondProjectId = afterSecondPromote.selectedProjectId;

    if (!secondProjectId) {
      throw new Error("Expected second promoted project to be selected.");
    }

    await repository.generateDraftPackage(secondProjectId);
    const afterSecondPackage = await repository.generatePlatformPackage(secondProjectId, "xiaohongshu");
    const secondPackageId = afterSecondPackage.platformPackages.find(
      (platformPackage) => platformPackage.contentProjectId === secondProjectId
    )?.id;

    if (!secondPackageId) {
      throw new Error("Expected a generated platform package for the second project.");
    }

    await repository.recordManualPublish({
      platformPackageId: firstPackageId,
      publishedAt: "2026-05-19T17:00:00.000Z"
    });
    const afterSecondPublish = await repository.recordManualPublish({
      platformPackageId: secondPackageId,
      publishedAt: "2026-05-19T15:00:00.000Z"
    });

    expect(afterSecondPublish.publishRecords).toHaveLength(2);
    expect(afterSecondPublish.publishRecords[0]?.publishedAt).toBe("2026-05-19T17:00:00.000Z");
    expect(afterSecondPublish.publishRecords[1]?.publishedAt).toBe("2026-05-19T15:00:00.000Z");
  });

  it("archives a generated platform package in memory", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    await repository.generatePlatformPackage(projectId, "xiaohongshu");
    const afterArchive = await repository.archiveProject(projectId);

    expect(afterArchive.archiveRecords).toHaveLength(1);
    expect(afterArchive.knowledgeItems).toHaveLength(1);
    expect(afterArchive.projects.find((project) => project.id === projectId)?.status).toBe("archived");
    expect(afterArchive.selectedProjectId).toBe(projectId);
  });

  it("replaces archive records and knowledge items when archiving the same project twice", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const afterPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const projectId = afterPromote.selectedProjectId;

    if (!projectId) {
      throw new Error("Expected promoted project to be selected.");
    }

    await repository.generateDraftPackage(projectId);
    await repository.generatePlatformPackage(projectId, "xiaohongshu");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-05-19T01:00:00.000Z"));
      const afterFirstArchive = await repository.archiveProject(projectId);

      vi.setSystemTime(new Date("2026-05-19T02:00:00.000Z"));
      const afterSecondArchive = await repository.archiveProject(projectId);

      expect(afterSecondArchive.archiveRecords).toHaveLength(1);
      expect(afterSecondArchive.knowledgeItems).toHaveLength(1);
      expect(afterSecondArchive.archiveRecords[0]?.id).toBe(afterFirstArchive.archiveRecords[0]?.id);
      expect(afterSecondArchive.knowledgeItems[0]?.id).toBe(afterFirstArchive.knowledgeItems[0]?.id);
      expect(afterSecondArchive.archiveRecords[0]?.createdAt).toBe(afterFirstArchive.archiveRecords[0]?.createdAt);
      expect(afterSecondArchive.knowledgeItems[0]?.createdAt).toBe(afterFirstArchive.knowledgeItems[0]?.createdAt);
    } finally {
      vi.useRealTimers();
    }
  });
});
