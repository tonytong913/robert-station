import { describe, expect, it } from "vitest";
import { InMemoryContentLoopRepository } from "./content-loop-repository";

describe("InMemoryContentLoopRepository", () => {
  it("loads the seeded content loop state", async () => {
    const repository = InMemoryContentLoopRepository.createSeeded("workspace_robert-station");
    const state = await repository.loadContentLoop();

    expect(state.topics).toHaveLength(4);
    expect(state.projects).toHaveLength(0);
    expect(state.drafts).toHaveLength(0);
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
});
