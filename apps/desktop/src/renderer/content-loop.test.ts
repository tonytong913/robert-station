import { describe, expect, it } from "vitest";
import { initializeContentLoopState, promoteTopicToProject } from "./content-loop";

describe("renderer content loop state", () => {
  it("starts with candidate topics and no projects", () => {
    const state = initializeContentLoopState();

    expect(state.topics).toHaveLength(4);
    expect(state.projects).toHaveLength(0);
    expect(state.drafts).toHaveLength(0);
    expect(state.selectedProjectId).toBeNull();
  });

  it("promotes a topic into the selected project", () => {
    const state = initializeContentLoopState();
    const firstTopic = state.topics[0];
    expect(firstTopic).toBeDefined();

    if (!firstTopic) {
      throw new Error("Expected the initialized state to include one topic.");
    }

    const topicId = firstTopic.id;
    const nextState = promoteTopicToProject(state, topicId);
    const firstProject = nextState.projects[0];
    expect(firstProject).toBeDefined();

    expect(nextState.topics.find((topic) => topic.id === topicId)?.status).toBe("promoted");
    expect(nextState.projects).toHaveLength(1);
    expect(nextState.drafts).toHaveLength(1);
    expect(nextState.selectedProjectId).toBe(firstProject?.id);
  });
});
