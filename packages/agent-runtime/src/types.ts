import type {
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  Platform,
  SourceReference,
  Topic,
  TopicScore
} from "@robert-station/core";

export interface GenerateTopicsInput {
  columnSlug: ContentColumnSlug;
  workspaceId: string;
  now?: Date;
}

export interface AgentTopicCandidate {
  title: string;
  hook: string;
  audience: string;
  targetPlatforms: Platform[];
  score: TopicScore;
  sourceNotes: string[];
  riskNotes: string[];
  verificationNotes: string[];
}

export interface GenerateTopicsOutput {
  candidates: AgentTopicCandidate[];
}

export interface GenerateDraftInput {
  project: ContentProject;
  topic: Topic | null;
  sourceReferences: SourceReference[];
  nextVersion: number;
  now?: Date;
}

export interface AgentDraftPackage {
  brief: string;
  titleOptions: string[];
  bodyDraft: string;
  coverCopy: string;
  tags: string[];
  visualDirection: string;
  pendingVerification: string[];
}

export interface GenerateDraftOutput {
  package: AgentDraftPackage;
}

export interface ContentAgentRuntime {
  generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput>;
  generateDraft(input: GenerateDraftInput): Promise<GenerateDraftOutput>;
}

export type AgentDraftMapper = (input: GenerateDraftInput, output: GenerateDraftOutput) => DraftVersion;
