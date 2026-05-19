import {
  createContentProjectFromTopic,
  createSampleContentLoopSeed,
  DEFAULT_COLUMNS
} from "@robert-station/core";
import type { ContentProject, DraftVersion, SourceReference, Topic } from "@robert-station/core";

const WORKSPACE_ID = "workspace_robert-station";

export interface ContentLoopState {
  topics: Topic[];
  sourceReferences: SourceReference[];
  projects: ContentProject[];
  drafts: DraftVersion[];
  selectedProjectId: string | null;
}

export function initializeContentLoopState(): ContentLoopState {
  const seed = createSampleContentLoopSeed(WORKSPACE_ID);

  return {
    topics: seed.topics,
    sourceReferences: seed.sourceReferences,
    projects: [],
    drafts: [],
    selectedProjectId: null
  };
}

export function promoteTopicToProject(state: ContentLoopState, topicId: string): ContentLoopState {
  const topic = state.topics.find((candidate) => candidate.id === topicId);

  if (!topic || topic.status === "promoted") {
    return state;
  }

  const column = DEFAULT_COLUMNS.find((candidate) => candidate.slug === topic.columnSlug);
  const primaryColumnId = column ? `column_${column.slug}` : "column_ai";
  const result = createContentProjectFromTopic(topic, primaryColumnId);

  return {
    ...state,
    topics: state.topics.map((candidate) => (candidate.id === topicId ? result.updatedTopic : candidate)),
    projects: [result.project, ...state.projects],
    drafts: [result.draft, ...state.drafts],
    selectedProjectId: result.project.id
  };
}
