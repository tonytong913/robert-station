import {
  isAgentDraftPackage,
  isGenerateTopicsOutput,
  type ContentAgentRuntime,
  type GenerateDraftInput,
  type GenerateDraftOutput,
  type GenerateTopicsOutput
} from "@robert-station/agent-runtime";
import {
  advanceTaskRun,
  createContentProjectFromTopic,
  createContentLoopExport,
  createEntityId,
  createManualPublishRecord,
  createManualSourceReference,
  createTopicFromSourceReference,
  createMetricImportPreview,
  createMetricSnapshotsFromPreview,
  createSampleContentLoopSeed,
  createTaskRun,
  filterSourceReferences,
  generateMockArchivePackage,
  generateMockDraftPackage,
  generateMockReviewKnowledgeItem,
  generateMockReviewReport,
  generateMockTopics,
  generateMockXiaohongshuPackage
} from "@robert-station/core";
import type {
  ArchiveRecord,
  AdvanceTaskRunInput,
  ContentColumnSlug,
  ContentLoopSeed,
  ContentLoopExportFile,
  ContentLoopExportFormat,
  ContentProject,
  CreateTaskRunInput,
  DraftVersion,
  KnowledgeItem,
  ManualSourceReferenceInput,
  ManualPublishInput,
  MetricCsvImportInput,
  MetricImportPreview,
  MetricSnapshot,
  Platform,
  PlatformPackage,
  PublishRecord,
  ReviewReport,
  SourceReference,
  SourceReferenceFilter,
  TaskRun,
  Topic
} from "@robert-station/core";

export interface PersistedContentLoopState {
  topics: Topic[];
  sourceReferences: SourceReference[];
  projects: ContentProject[];
  drafts: DraftVersion[];
  platformPackages: PlatformPackage[];
  publishRecords: PublishRecord[];
  metricSnapshots: MetricSnapshot[];
  metricImportPreview: MetricImportPreview | null;
  reviewReports: ReviewReport[];
  archiveRecords: ArchiveRecord[];
  knowledgeItems: KnowledgeItem[];
  taskRuns: TaskRun[];
  selectedProjectId: string | null;
}

export interface ContentLoopRepository {
  loadContentLoop(): Promise<PersistedContentLoopState>;
  generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState>;
  generateDraftPackage(projectId: string): Promise<PersistedContentLoopState>;
  generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState>;
  recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState>;
  previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState>;
  saveMetricImport(): Promise<PersistedContentLoopState>;
  generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState>;
  extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState>;
  archiveProject(projectId: string): Promise<PersistedContentLoopState>;
  promoteTopic(topicId: string): Promise<PersistedContentLoopState>;
  addSourceReference(input: ManualSourceReferenceInput): Promise<PersistedContentLoopState>;
  filterSourceReferences(filter: SourceReferenceFilter): Promise<PersistedContentLoopState>;
  createTopicFromSourceReference(sourceReferenceId: string): Promise<PersistedContentLoopState>;
  markSourceReferenceUsed(sourceReferenceId: string, contentProjectId: string): Promise<PersistedContentLoopState>;
  createContentLoopExport(format: ContentLoopExportFormat): Promise<ContentLoopExportFile>;
  startTaskRun(input: CreateTaskRunInput): Promise<PersistedContentLoopState>;
  advanceTaskRun(taskRunId: string, input: AdvanceTaskRunInput): Promise<PersistedContentLoopState>;
}

export interface ContentLoopRepositoryOptions {
  agentRuntime?: ContentAgentRuntime;
}

export class InMemoryContentLoopRepository implements ContentLoopRepository {
  private state: PersistedContentLoopState;

  private constructor(
    initialState: PersistedContentLoopState,
    private readonly options: ContentLoopRepositoryOptions = {}
  ) {
    this.state = cloneState(initialState);
  }

  static createSeeded(
    workspaceId: string,
    options: ContentLoopRepositoryOptions = {}
  ): InMemoryContentLoopRepository {
    const seed = createSampleContentLoopSeed(workspaceId);

    return new InMemoryContentLoopRepository({
      topics: seed.topics,
      sourceReferences: seed.sourceReferences,
      projects: [],
      drafts: [],
      platformPackages: [],
      publishRecords: [],
      metricSnapshots: [],
      metricImportPreview: null,
      reviewReports: [],
      archiveRecords: [],
      knowledgeItems: [],
      taskRuns: [],
      selectedProjectId: null
    }, options);
  }

  async loadContentLoop(): Promise<PersistedContentLoopState> {
    return cloneState(this.state);
  }

  async generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
    const workspaceId = this.state.topics[0]?.workspaceId ?? "workspace_robert-station";
    const now = new Date();
    let generated: ContentLoopSeed;

    try {
      const runtimeOutput = await this.options.agentRuntime?.generateTopics({ columnSlug, workspaceId, now });
      generated = runtimeOutput && isGenerateTopicsOutput(runtimeOutput)
        ? createTopicsFromAgentOutput({ columnSlug, workspaceId, now, output: runtimeOutput })
        : generateMockTopics({ columnSlug, workspaceId, now });
    } catch {
      generated = generateMockTopics({ columnSlug, workspaceId, now });
    }
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

  async generateDraftPackage(projectId: string): Promise<PersistedContentLoopState> {
    const project = this.state.projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      return cloneState(this.state);
    }

    const topic = project.sourceTopicId
      ? this.state.topics.find((candidate) => candidate.id === project.sourceTopicId) ?? null
      : null;
    const sourceReferences = this.state.sourceReferences.filter(
      (source) => source.topicId === project.sourceTopicId || source.contentProjectId === project.id
    );
    const nextVersion =
      Math.max(
        0,
        ...this.state.drafts.filter((draft) => draft.contentProjectId === project.id).map((draft) => draft.version)
      ) + 1;
    const now = new Date();
    const draftInput: GenerateDraftInput = {
      project,
      topic,
      sourceReferences,
      nextVersion,
      now
    };
    let draft: DraftVersion;

    try {
      const runtimeOutput = await this.options.agentRuntime?.generateDraft(draftInput);
      draft = runtimeOutput && isAgentDraftPackage(runtimeOutput.package)
        ? createDraftFromAgentOutput(draftInput, runtimeOutput)
        : generateMockDraftPackage(draftInput);
    } catch {
      draft = generateMockDraftPackage(draftInput);
    }

    this.state = {
      ...this.state,
      drafts: [draft, ...this.state.drafts],
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }

  async addSourceReference(input: ManualSourceReferenceInput): Promise<PersistedContentLoopState> {
    const sourceReference = createManualSourceReference(input);

    this.state = {
      ...this.state,
      sourceReferences: [
        sourceReference,
        ...this.state.sourceReferences.filter((source) => source.id !== sourceReference.id)
      ]
    };

    return cloneState(this.state);
  }

  async filterSourceReferences(filter: SourceReferenceFilter): Promise<PersistedContentLoopState> {
    return {
      ...cloneState(this.state),
      sourceReferences: filterSourceReferences(this.state.sourceReferences, filter)
    };
  }

  async createTopicFromSourceReference(sourceReferenceId: string): Promise<PersistedContentLoopState> {
    const sourceReference = this.state.sourceReferences.find((source) => source.id === sourceReferenceId);

    if (!sourceReference) {
      return cloneState(this.state);
    }

    const result = createTopicFromSourceReference(sourceReference);

    this.state = {
      ...this.state,
      topics: [result.topic, ...this.state.topics.filter((topic) => topic.id !== result.topic.id)],
      sourceReferences: this.state.sourceReferences.map((source) =>
        source.id === sourceReferenceId ? result.sourceReference : source
      )
    };

    return cloneState(this.state);
  }

  async markSourceReferenceUsed(
    sourceReferenceId: string,
    contentProjectId: string
  ): Promise<PersistedContentLoopState> {
    this.state = {
      ...this.state,
      sourceReferences: this.state.sourceReferences.map((source) =>
        source.id === sourceReferenceId ? { ...source, contentProjectId, usageStatus: "used", updatedAt: new Date().toISOString() } : source
      )
    };

    return cloneState(this.state);
  }

  async createContentLoopExport(format: ContentLoopExportFormat): Promise<ContentLoopExportFile> {
    return createContentLoopExport(
      {
        sources: this.state.sourceReferences,
        projects: this.state.projects,
        reviewReports: this.state.reviewReports,
        knowledgeItems: this.state.knowledgeItems
      },
      format
    );
  }

  async startTaskRun(input: CreateTaskRunInput): Promise<PersistedContentLoopState> {
    const taskRun = createTaskRun(input);

    this.state = {
      ...this.state,
      taskRuns: [taskRun, ...this.state.taskRuns.filter((candidate) => candidate.id !== taskRun.id)]
    };

    return cloneState(this.state);
  }

  async advanceTaskRun(taskRunId: string, input: AdvanceTaskRunInput): Promise<PersistedContentLoopState> {
    this.state = {
      ...this.state,
      taskRuns: this.state.taskRuns.map((taskRun) =>
        taskRun.id === taskRunId ? advanceTaskRun(taskRun, input) : taskRun
      )
    };

    return cloneState(this.state);
  }

  async generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState> {
    if (platform !== "xiaohongshu") {
      return cloneState(this.state);
    }

    const project = this.state.projects.find((candidate) => candidate.id === projectId);
    const draft = this.state.drafts
      .filter((candidate) => candidate.contentProjectId === projectId)
      .sort((left, right) => right.version - left.version || right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!project || !draft) {
      return cloneState(this.state);
    }

    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft,
      now: new Date()
    });

    this.state = {
      ...this.state,
      platformPackages: [
        platformPackage,
        ...this.state.platformPackages.filter((candidate) => candidate.id !== platformPackage.id)
      ],
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }

  async recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState> {
    const platformPackage = this.state.platformPackages.find((candidate) => candidate.id === input.platformPackageId);

    if (!platformPackage) {
      return cloneState(this.state);
    }

    const publishRecord = createManualPublishRecord({
      platformPackage,
      input,
      now: new Date()
    });
    const existing = this.state.publishRecords.find((candidate) => candidate.id === publishRecord.id);
    const persistedPublishRecord = {
      ...publishRecord,
      createdAt: existing?.createdAt ?? publishRecord.createdAt
    };

    this.state = {
      ...this.state,
      projects: this.state.projects.map((project) =>
        project.id === platformPackage.contentProjectId
          ? { ...project, status: "published", updatedAt: persistedPublishRecord.updatedAt }
          : project
      ),
      publishRecords: [
        persistedPublishRecord,
        ...this.state.publishRecords.filter((candidate) => candidate.id !== persistedPublishRecord.id)
      ].sort(comparePublishRecords),
      selectedProjectId: platformPackage.contentProjectId
    };

    return cloneState(this.state);
  }

  async previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState> {
    this.state = {
      ...this.state,
      metricImportPreview: createMetricImportPreview({
        input,
        publishRecords: this.state.publishRecords,
        now: new Date()
      })
    };

    return cloneState(this.state);
  }

  async saveMetricImport(): Promise<PersistedContentLoopState> {
    if (!this.state.metricImportPreview) {
      return cloneState(this.state);
    }

    const snapshots = createMetricSnapshotsFromPreview({
      preview: this.state.metricImportPreview,
      publishRecords: this.state.publishRecords,
      now: new Date()
    });
    const existingSnapshotsById = new Map(this.state.metricSnapshots.map((snapshot) => [snapshot.id, snapshot]));
    const persistedSnapshots = snapshots.map((snapshot) => ({
      ...snapshot,
      createdAt: existingSnapshotsById.get(snapshot.id)?.createdAt ?? snapshot.createdAt
    }));
    const snapshotIds = new Set(persistedSnapshots.map((snapshot) => snapshot.id));

    this.state = {
      ...this.state,
      metricSnapshots: [
        ...persistedSnapshots,
        ...this.state.metricSnapshots.filter((snapshot) => !snapshotIds.has(snapshot.id))
      ].sort(compareMetricSnapshots),
      metricImportPreview: null
    };

    return cloneState(this.state);
  }

  async generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState> {
    const publishRecord = this.state.publishRecords.find((candidate) => candidate.id === publishRecordId);

    if (!publishRecord) {
      return cloneState(this.state);
    }

    const project = this.state.projects.find((candidate) => candidate.id === publishRecord.contentProjectId);

    if (!project) {
      return cloneState(this.state);
    }

    const platformPackage =
      this.state.platformPackages.find((candidate) => candidate.id === publishRecord.platformPackageId) ?? null;
    const metricSnapshot =
      this.state.metricSnapshots
        .filter((candidate) => candidate.publishRecordId === publishRecord.id)
        .sort(compareMetricSnapshots)[0] ?? null;
    const version =
      Math.max(
        0,
        ...(this.state.reviewReports ?? [])
          .filter((candidate) => candidate.publishRecordId === publishRecord.id)
          .map((candidate) => candidate.version)
      ) + 1;
    const reviewReport = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot,
      version,
      now: new Date()
    });

    this.state = {
      ...this.state,
      projects: this.state.projects.map((candidate) =>
        candidate.id === project.id ? { ...candidate, status: "reviewed", updatedAt: reviewReport.updatedAt } : candidate
      ),
      reviewReports: [reviewReport, ...(this.state.reviewReports ?? [])].sort(compareReviewReports),
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }

  async extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState> {
    const reviewReport = this.state.reviewReports.find((candidate) => candidate.id === reviewReportId);

    if (!reviewReport) {
      return cloneState(this.state);
    }

    const project = this.state.projects.find((candidate) => candidate.id === reviewReport.contentProjectId);
    const archiveRecord = this.state.archiveRecords.find(
      (candidate) => candidate.contentProjectId === reviewReport.contentProjectId
    );

    if (!project || !archiveRecord) {
      return cloneState(this.state);
    }

    const metricSnapshot = reviewReport.metricSnapshotId
      ? this.state.metricSnapshots.find((candidate) => candidate.id === reviewReport.metricSnapshotId) ?? null
      : null;
    const generatedKnowledgeItem = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport,
      metricSnapshot,
      now: new Date()
    });
    const knowledgeItem = {
      ...generatedKnowledgeItem,
      createdAt:
        this.state.knowledgeItems.find((candidate) => candidate.id === generatedKnowledgeItem.id)?.createdAt ??
        generatedKnowledgeItem.createdAt
    };

    this.state = {
      ...this.state,
      knowledgeItems: [
        knowledgeItem,
        ...this.state.knowledgeItems.filter((candidate) => candidate.id !== knowledgeItem.id)
      ],
      selectedProjectId: project.id
    };

    return cloneState(this.state);
  }

  async archiveProject(projectId: string): Promise<PersistedContentLoopState> {
    const project = this.state.projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      return cloneState(this.state);
    }

    const topic = project.sourceTopicId
      ? this.state.topics.find((candidate) => candidate.id === project.sourceTopicId) ?? null
      : null;
    const draft =
      this.state.drafts
        .filter((candidate) => candidate.contentProjectId === project.id)
        .sort((left, right) => right.version - left.version || right.updatedAt.localeCompare(left.updatedAt))[0] ??
      null;
    const platformPackage =
      this.state.platformPackages
        .filter((candidate) => candidate.contentProjectId === project.id)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))[0] ??
      null;
    const sourceReferences = this.state.sourceReferences.filter(
      (source) => source.topicId === project.sourceTopicId || source.contentProjectId === project.id
    );
    const archivePackage = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences,
      now: new Date()
    });
    const archivedProject: ContentProject = {
      ...project,
      status: "archived",
      updatedAt: archivePackage.archiveRecord.updatedAt
    };
    const archiveRecord = {
      ...archivePackage.archiveRecord,
      createdAt:
        this.state.archiveRecords.find((candidate) => candidate.id === archivePackage.archiveRecord.id)?.createdAt ??
        archivePackage.archiveRecord.createdAt
    };
    const knowledgeItem = {
      ...archivePackage.knowledgeItem,
      createdAt:
        this.state.knowledgeItems.find((candidate) => candidate.id === archivePackage.knowledgeItem.id)?.createdAt ??
        archivePackage.knowledgeItem.createdAt
    };

    this.state = {
      ...this.state,
      projects: this.state.projects.map((candidate) => (candidate.id === project.id ? archivedProject : candidate)),
      archiveRecords: [archiveRecord, ...this.state.archiveRecords.filter((candidate) => candidate.id !== archiveRecord.id)],
      knowledgeItems: [
        knowledgeItem,
        ...this.state.knowledgeItems.filter((candidate) => candidate.id !== knowledgeItem.id)
      ],
      selectedProjectId: project.id
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

export function createTopicsFromAgentOutput(input: {
  columnSlug: ContentColumnSlug;
  workspaceId: string;
  now: Date;
  output: GenerateTopicsOutput;
}): ContentLoopSeed {
  const timestamp = input.now.toISOString();
  const topics = input.output.candidates.map((candidate, index) => ({
    id: createEntityId("topic", `${input.columnSlug}-runtime-${index + 1}-${candidate.title}`),
    workspaceId: input.workspaceId,
    columnSlug: input.columnSlug,
    title: candidate.title,
    hook: candidate.hook,
    audience: candidate.audience,
    targetPlatforms: [...candidate.targetPlatforms],
    status: "candidate" as const,
    score: { ...candidate.score },
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const sourceReferences = input.output.candidates.flatMap((candidate, index) => {
    const topic = topics[index];

    if (!topic) {
      return [];
    }

    return [...candidate.sourceNotes, ...candidate.riskNotes, ...candidate.verificationNotes].map(
      (note, noteIndex) => ({
        id: createEntityId("source", `${topic.id}-${noteIndex + 1}`),
        workspaceId: input.workspaceId,
        topicId: topic.id,
        kind: noteIndex < candidate.sourceNotes.length ? "note" as const : "risk" as const,
        title: `${candidate.title} 的 runtime 资料`,
        note,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    );
  });

  return { topics, sourceReferences };
}

export function createDraftFromAgentOutput(input: GenerateDraftInput, output: GenerateDraftOutput): DraftVersion {
  const timestamp = (input.now ?? new Date()).toISOString();
  const draftPackage = output.package;

  return {
    id: createEntityId("draft", `${input.project.id}-${input.nextVersion}`),
    workspaceId: input.project.workspaceId,
    contentProjectId: input.project.id,
    version: input.nextVersion,
    title: input.project.title,
    body: [
      "简报",
      draftPackage.brief,
      "",
      "标题选项",
      ...draftPackage.titleOptions.map((title, index) => `${index + 1}. ${title}`),
      "",
      "正文草稿",
      draftPackage.bodyDraft,
      "",
      "封面文案",
      draftPackage.coverCopy,
      "",
      "标签建议",
      ...draftPackage.tags,
      "",
      "视觉方向",
      draftPackage.visualDirection,
      "",
      "待核实",
      ...draftPackage.pendingVerification.map((line, index) => `${index + 1}. ${line}`)
    ].join("\n"),
    createdBy: "assistant",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function comparePublishRecords(left: PublishRecord, right: PublishRecord): number {
  return (
    right.publishedAt.localeCompare(left.publishedAt) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareMetricSnapshots(left: MetricSnapshot, right: MetricSnapshot): number {
  return (
    right.snapshotAt.localeCompare(left.snapshotAt) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareReviewReports(left: ReviewReport, right: ReviewReport): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.version - left.version ||
    left.id.localeCompare(right.id)
  );
}
