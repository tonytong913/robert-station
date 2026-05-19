import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  generateMockTopics
} from "@robert-station/core";
import type { ContentColumnSlug, ContentProject, DraftVersion, SourceReference, Topic } from "@robert-station/core";

export interface PersistedContentLoopState {
  topics: Topic[];
  sourceReferences: SourceReference[];
  projects: ContentProject[];
  drafts: DraftVersion[];
  selectedProjectId: string | null;
}

export interface ContentLoopRepository {
  loadContentLoop(): Promise<PersistedContentLoopState>;
  generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState>;
  promoteTopic(topicId: string): Promise<PersistedContentLoopState>;
}

export class InMemoryContentLoopRepository implements ContentLoopRepository {
  private state: PersistedContentLoopState;

  private constructor(initialState: PersistedContentLoopState) {
    this.state = cloneState(initialState);
  }

  static createSeeded(workspaceId: string): InMemoryContentLoopRepository {
    const seed = createSampleContentLoopSeed(workspaceId);

    return new InMemoryContentLoopRepository({
      topics: seed.topics,
      sourceReferences: seed.sourceReferences,
      projects: [],
      drafts: [],
      selectedProjectId: null
    });
  }

  async loadContentLoop(): Promise<PersistedContentLoopState> {
    return cloneState(this.state);
  }

  async generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
    const generated = generateMockTopics({
      columnSlug,
      workspaceId: this.state.topics[0]?.workspaceId ?? "workspace_robert-station",
      now: new Date()
    });
    const existingTopicIds = new Set(this.state.topics.map((topic) => topic.id));
    const existingSourceIds = new Set(this.state.sourceReferences.map((source) => source.id));

    this.state = {
      ...this.state,
      topics: [...this.state.topics, ...generated.topics.filter((topic) => !existingTopicIds.has(topic.id))],
      sourceReferences: [
        ...this.state.sourceReferences,
        ...generated.sourceReferences.filter((source) => !existingSourceIds.has(source.id))
      ]
    };

    return cloneState(this.state);
  }

  async promoteTopic(topicId: string): Promise<PersistedContentLoopState> {
    const topic = this.state.topics.find((candidate) => candidate.id === topicId);

    if (!topic || topic.status === "promoted") {
      return cloneState(this.state);
    }

    const result = createContentProjectFromTopic(topic, `column_${topic.columnSlug}`);
    this.state = {
      ...this.state,
      topics: this.state.topics.map((candidate) => (candidate.id === topicId ? result.updatedTopic : candidate)),
      projects: [result.project, ...this.state.projects],
      drafts: [result.draft, ...this.state.drafts],
      selectedProjectId: result.project.id
    };

    return cloneState(this.state);
  }
}

function cloneState(state: PersistedContentLoopState): PersistedContentLoopState {
  return structuredClone(state);
}
