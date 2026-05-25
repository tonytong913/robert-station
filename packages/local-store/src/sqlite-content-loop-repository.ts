import { DatabaseSync } from "node:sqlite";
import {
  isAgentDraftPackage,
  isGenerateTopicsOutput,
  type ContentAgentRuntime,
  type GenerateDraftInput
} from "@robert-station/agent-runtime";
import {
  advanceTaskRun,
  createContentProjectFromTopic,
  createContentLoopExport,
  createDefaultWorkspaceSeed,
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
  ContentProjectStatus,
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
  PlatformPackageCheck,
  PublishRecord,
  ReviewReport,
  SourceReference,
  SourceReferenceFilter,
  SourceExtractionStatus,
  SourceReferenceKind,
  SourceUsageStatus,
  TaskRun,
  TaskRunKind,
  TaskRunPhase,
  TaskRunStatus,
  Topic,
  TopicScore,
  TopicStatus
} from "@robert-station/core";
import {
  createCompletedGenerationTask,
  createDraftFromAgentOutput,
  createTopicsFromAgentOutput,
  type ContentLoopRepository,
  type PersistedContentLoopState
} from "./content-loop-repository";
import { getSqliteSchemaStatements } from "./schema";

const WORKSPACE_NAME = "Robert Station";
const WORKSPACE_ID = "workspace_robert-station";

interface SqliteContentLoopRepositoryOptions {
  databasePath: string;
  agentRuntime?: ContentAgentRuntime;
}

interface TopicRow {
  id: string;
  workspace_id: string;
  column_slug: string;
  title: string;
  hook: string;
  audience: string;
  target_platforms_json: string;
  status: string;
  score_json: string;
  created_at: string;
  updated_at: string;
}

interface SourceReferenceRow {
  id: string;
  workspace_id: string;
  column_slug: string | null;
  topic_id: string | null;
  content_project_id: string | null;
  kind: string;
  title: string;
  url: string | null;
  platform: string | null;
  author: string | null;
  published_at: string | null;
  extraction_status: string;
  usage_status: string;
  excerpt: string;
  tags_json: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface ContentProjectRow {
  id: string;
  workspace_id: string;
  primary_column_id: string;
  source_topic_id: string | null;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DraftVersionRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  version: number;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PlatformPackageRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  draft_version_id: string;
  platform: string;
  title: string;
  body: string;
  tags_json: string;
  cover_text: string;
  required_assets_json: string;
  checks_json: string;
  created_at: string;
  updated_at: string;
}

interface PublishRecordRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  platform_package_id: string;
  platform: string;
  status: string;
  published_at: string;
  url: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface MetricSnapshotRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  publish_record_id: string;
  platform: string;
  source_file_name: string;
  snapshot_at: string;
  views: number;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  note: string;
  created_at: string;
  updated_at: string;
}

interface ReviewReportRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  publish_record_id: string;
  metric_snapshot_id: string | null;
  version: number;
  summary: string;
  highlights_json: string;
  underperforming_signals_json: string;
  likely_causes_json: string;
  next_actions_json: string;
  created_at: string;
  updated_at: string;
}

interface ArchiveRecordRow {
  id: string;
  workspace_id: string;
  content_project_id: string;
  draft_version_id: string | null;
  platform_package_id: string | null;
  title: string;
  summary: string;
  source_count: number;
  package_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeItemRow {
  id: string;
  workspace_id: string;
  archive_record_id: string;
  content_project_id: string;
  column_slug: string;
  title: string;
  lesson: string;
  evidence: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

interface TaskRunRow {
  id: string;
  workspace_id: string;
  kind: string;
  label: string;
  phase: string;
  status: string;
  completed_count: number;
  total_count: number;
  message: string;
  created_at: string;
  updated_at: string;
}

export class SqliteContentLoopRepository implements ContentLoopRepository {
  private metricImportPreview: MetricImportPreview | null = null;

  private constructor(
    private readonly database: DatabaseSync,
    private readonly options: Omit<SqliteContentLoopRepositoryOptions, "databasePath"> = {}
  ) {}

  static open(options: SqliteContentLoopRepositoryOptions): SqliteContentLoopRepository {
    const database = new DatabaseSync(options.databasePath);

    try {
      const repository = new SqliteContentLoopRepository(
        database,
        options.agentRuntime ? { agentRuntime: options.agentRuntime } : {}
      );
      repository.initialize();
      return repository;
    } catch (error) {
      try {
        database.close();
      } catch {
        // Preserve the initialization failure.
      }
      throw error;
    }
  }

  async loadContentLoop(): Promise<PersistedContentLoopState> {
    return this.loadState();
  }

  async generateTopics(columnSlug: ContentColumnSlug): Promise<PersistedContentLoopState> {
    const now = this.createPromotionDate();
    let generated: ContentLoopSeed;
    let diagnosticMessage: string;

    try {
      const runtimeOutput = await this.options.agentRuntime?.generateTopics({
        columnSlug,
        workspaceId: WORKSPACE_ID,
        now
      });
      generated = runtimeOutput && isGenerateTopicsOutput(runtimeOutput)
        ? createTopicsFromAgentOutput({ columnSlug, workspaceId: WORKSPACE_ID, now, output: runtimeOutput })
        : generateMockTopics({ columnSlug, workspaceId: WORKSPACE_ID, now });
      diagnosticMessage = runtimeOutput && isGenerateTopicsOutput(runtimeOutput)
        ? "Agent runtime generated topics."
        : "Fell back to mock topic generator.";
    } catch {
      generated = generateMockTopics({ columnSlug, workspaceId: WORKSPACE_ID, now });
      diagnosticMessage = "Fell back to mock topic generator.";
    }
    const diagnosticTask = createCompletedGenerationTask({
      workspaceId: WORKSPACE_ID,
      label: `Generate ${columnSlug} topics`,
      message: diagnosticMessage,
      now
    });

    this.runTransaction(() => {
      for (const topic of generated.topics) {
        this.insertTopicIfMissing(topic);
      }

      for (const sourceReference of generated.sourceReferences) {
        this.insertSourceReferenceIfMissing(sourceReference);
      }

      this.upsertTaskRun(diagnosticTask);
    });

    return this.loadState();
  }

  async generateDraftPackage(projectId: string): Promise<PersistedContentLoopState> {
    const project = this.getContentProject(projectId);

    if (!project) {
      return this.loadState();
    }

    const topic = project.sourceTopicId ? this.getTopic(project.sourceTopicId) : null;
    const sourceReferences = this.getSourceReferencesForProject(project);
    const draftInput: GenerateDraftInput = {
      project,
      topic,
      sourceReferences,
      nextVersion: this.getNextDraftVersion(project.id),
      now: this.createPromotionDate()
    };
    let draft: DraftVersion;
    let diagnosticMessage: string;

    try {
      const runtimeOutput = await this.options.agentRuntime?.generateDraft(draftInput);
      draft = runtimeOutput && isAgentDraftPackage(runtimeOutput.package)
        ? createDraftFromAgentOutput(draftInput, runtimeOutput)
        : generateMockDraftPackage(draftInput);
      diagnosticMessage = runtimeOutput && isAgentDraftPackage(runtimeOutput.package)
        ? "Agent runtime generated draft."
        : "Fell back to mock draft generator.";
    } catch {
      draft = generateMockDraftPackage(draftInput);
      diagnosticMessage = "Fell back to mock draft generator.";
    }
    const diagnosticTask = createCompletedGenerationTask({
      workspaceId: project.workspaceId,
      label: `Generate draft for ${project.title}`,
      message: diagnosticMessage,
      now: draftInput.now ?? this.createPromotionDate()
    });

    this.runTransaction(() => {
      this.upsertDraftVersion(draft);
      this.upsertTaskRun(diagnosticTask);
    });

    return this.loadState(project.id);
  }

  async addSourceReference(input: ManualSourceReferenceInput): Promise<PersistedContentLoopState> {
    const sourceReference = createManualSourceReference(input);

    this.upsertSourceReference(sourceReference);

    return this.loadState();
  }

  async filterSourceReferences(filter: SourceReferenceFilter): Promise<PersistedContentLoopState> {
    const state = this.loadState();

    return {
      ...state,
      sourceReferences: filterSourceReferences(state.sourceReferences, filter)
    };
  }

  async createTopicFromSourceReference(sourceReferenceId: string): Promise<PersistedContentLoopState> {
    const row = this.database
      .prepare("SELECT * FROM source_references WHERE id = ?;")
      .get(sourceReferenceId) as SourceReferenceRow | undefined;

    if (!row) {
      return this.loadState();
    }

    const result = createTopicFromSourceReference(mapSourceReferenceRow(row), this.createPromotionDate());

    this.runTransaction(() => {
      this.upsertTopic(result.topic);
      this.upsertSourceReference(result.sourceReference);
    });

    return this.loadState();
  }

  async markSourceReferenceUsed(
    sourceReferenceId: string,
    contentProjectId: string
  ): Promise<PersistedContentLoopState> {
    const row = this.database
      .prepare("SELECT * FROM source_references WHERE id = ?;")
      .get(sourceReferenceId) as SourceReferenceRow | undefined;

    if (!row) {
      return this.loadState();
    }

    this.upsertSourceReference({
      ...mapSourceReferenceRow(row),
      contentProjectId,
      usageStatus: "used",
      updatedAt: this.createPromotionDate().toISOString()
    });

    return this.loadState();
  }

  async createContentLoopExport(format: ContentLoopExportFormat): Promise<ContentLoopExportFile> {
    const state = this.loadState();

    return createContentLoopExport(
      {
        sources: state.sourceReferences,
        projects: state.projects,
        reviewReports: state.reviewReports,
        knowledgeItems: state.knowledgeItems
      },
      format
    );
  }

  async startTaskRun(input: CreateTaskRunInput): Promise<PersistedContentLoopState> {
    const taskRun = createTaskRun(input);

    this.upsertTaskRun(taskRun);

    return this.loadState();
  }

  async advanceTaskRun(taskRunId: string, input: AdvanceTaskRunInput): Promise<PersistedContentLoopState> {
    const row = this.database.prepare("SELECT * FROM task_runs WHERE id = ?;").get(taskRunId) as TaskRunRow | undefined;

    if (!row) {
      return this.loadState();
    }

    this.upsertTaskRun(advanceTaskRun(mapTaskRunRow(row), input));

    return this.loadState();
  }

  async generatePlatformPackage(projectId: string, platform: Platform): Promise<PersistedContentLoopState> {
    if (platform !== "xiaohongshu") {
      return this.loadState();
    }

    const project = this.getContentProject(projectId);
    const draft = this.getLatestDraftForProject(projectId);

    if (!project || !draft) {
      return this.loadState();
    }

    const platformPackage = generateMockXiaohongshuPackage({
      project,
      draft,
      now: this.createPromotionDate()
    });

    this.runTransaction(() => {
      this.upsertPlatformPackage(platformPackage);
    });

    return this.loadState(project.id);
  }

  async recordManualPublish(input: ManualPublishInput): Promise<PersistedContentLoopState> {
    const platformPackage = this.getPlatformPackage(input.platformPackageId);

    if (!platformPackage) {
      return this.loadState();
    }

    const publishRecord = createManualPublishRecord({
      platformPackage,
      input,
      now: this.createPromotionDate()
    });
    const project = this.getContentProject(platformPackage.contentProjectId);
    const publishedProject: ContentProject | null = project
      ? { ...project, status: "published", updatedAt: publishRecord.updatedAt }
      : null;

    this.runTransaction(() => {
      if (publishedProject) {
        this.upsertContentProject(publishedProject);
      }
      this.upsertPublishRecord(publishRecord);
    });

    return this.loadState(platformPackage.contentProjectId);
  }

  async previewMetricCsvImport(input: MetricCsvImportInput): Promise<PersistedContentLoopState> {
    const publishRecords = this.database
      .prepare("SELECT * FROM publish_records ORDER BY published_at DESC, updated_at DESC, id ASC;")
      .all() as unknown as PublishRecordRow[];

    this.metricImportPreview = createMetricImportPreview({
      input,
      publishRecords: publishRecords.map(mapPublishRecordRow),
      now: this.createPromotionDate()
    });

    return this.loadState();
  }

  async saveMetricImport(): Promise<PersistedContentLoopState> {
    if (!this.metricImportPreview) {
      return this.loadState();
    }

    const publishRecords = this.database
      .prepare("SELECT * FROM publish_records ORDER BY published_at DESC, updated_at DESC, id ASC;")
      .all() as unknown as PublishRecordRow[];
    const snapshots = createMetricSnapshotsFromPreview({
      preview: this.metricImportPreview,
      publishRecords: publishRecords.map(mapPublishRecordRow),
      now: this.createPromotionDate()
    });

    this.runTransaction(() => {
      for (const snapshot of snapshots) {
        this.upsertMetricSnapshot(snapshot);
      }
    });
    this.metricImportPreview = null;

    return this.loadState();
  }

  async generateReviewReport(publishRecordId: string): Promise<PersistedContentLoopState> {
    const state = this.loadState();
    const publishRecord = state.publishRecords.find((candidate) => candidate.id === publishRecordId);

    if (!publishRecord) {
      return state;
    }

    const project = state.projects.find((candidate) => candidate.id === publishRecord.contentProjectId);

    if (!project) {
      return state;
    }

    const platformPackage =
      state.platformPackages.find((candidate) => candidate.id === publishRecord.platformPackageId) ?? null;
    const metricSnapshot =
      state.metricSnapshots
        .filter((candidate) => candidate.publishRecordId === publishRecord.id)
        .sort(compareMetricSnapshots)[0] ?? null;
    const version =
      Math.max(
        0,
        ...state.reviewReports
          .filter((candidate) => candidate.publishRecordId === publishRecord.id)
          .map((candidate) => candidate.version)
      ) + 1;
    const reviewReport = generateMockReviewReport({
      project,
      publishRecord,
      platformPackage,
      metricSnapshot,
      version,
      now: this.createPromotionDate()
    });

    this.runTransaction(() => {
      this.upsertContentProject({ ...project, status: "reviewed", updatedAt: reviewReport.updatedAt });
      this.insertReviewReport(reviewReport);
    });

    return this.loadState(project.id);
  }

  async extractReviewKnowledge(reviewReportId: string): Promise<PersistedContentLoopState> {
    const state = this.loadState();
    const reviewReport = state.reviewReports.find((candidate) => candidate.id === reviewReportId);

    if (!reviewReport) {
      return state;
    }

    const project = state.projects.find((candidate) => candidate.id === reviewReport.contentProjectId);
    const archiveRecord = state.archiveRecords.find(
      (candidate) => candidate.contentProjectId === reviewReport.contentProjectId
    );

    if (!project || !archiveRecord) {
      return state;
    }

    const metricSnapshot = reviewReport.metricSnapshotId
      ? state.metricSnapshots.find((candidate) => candidate.id === reviewReport.metricSnapshotId) ?? null
      : null;
    const generatedKnowledgeItem = generateMockReviewKnowledgeItem({
      project,
      archiveRecord,
      reviewReport,
      metricSnapshot,
      now: this.createPromotionDate()
    });
    const knowledgeItem = {
      ...generatedKnowledgeItem,
      createdAt:
        state.knowledgeItems.find((candidate) => candidate.id === generatedKnowledgeItem.id)?.createdAt ??
        generatedKnowledgeItem.createdAt
    };

    this.upsertKnowledgeItem(knowledgeItem);

    return this.loadState(project.id);
  }

  async archiveProject(projectId: string): Promise<PersistedContentLoopState> {
    const project = this.getContentProject(projectId);

    if (!project) {
      return this.loadState();
    }

    const topic = project.sourceTopicId ? this.getTopic(project.sourceTopicId) : null;
    const draft = this.getLatestDraftForProject(project.id);
    const platformPackage = this.getLatestPlatformPackageForProject(project.id);
    const sourceReferences = this.getSourceReferencesForProject(project);
    const archivePackage = generateMockArchivePackage({
      project,
      topic,
      draft,
      platformPackage,
      sourceReferences,
      now: this.createPromotionDate()
    });
    const archivedProject: ContentProject = {
      ...project,
      status: "archived",
      updatedAt: archivePackage.archiveRecord.updatedAt
    };

    this.runTransaction(() => {
      this.upsertContentProject(archivedProject);
      this.upsertArchiveRecord(archivePackage.archiveRecord);
      this.upsertKnowledgeItem(archivePackage.knowledgeItem);
    });

    return this.loadState(project.id);
  }

  async promoteTopic(topicId: string): Promise<PersistedContentLoopState> {
    const topic = this.getTopic(topicId);

    if (!topic || topic.status === "promoted") {
      return this.loadState();
    }

    const result = createContentProjectFromTopic(topic, `column_${topic.columnSlug}`, this.createPromotionDate());

    this.runTransaction(() => {
      this.upsertTopic(result.updatedTopic);
      this.upsertContentProject(result.project);
      this.upsertDraftVersion(result.draft);
    });

    return this.loadState();
  }

  close(): void {
    this.database.close();
  }

  private initialize(): void {
    this.database.exec("PRAGMA foreign_keys = ON;");

    for (const statement of getSqliteSchemaStatements()) {
      this.database.exec(statement);
    }

    const row = this.database.prepare("SELECT COUNT(*) AS count FROM topics;").get() as { count: number };
    if (row.count === 0) {
      this.seed();
    }
  }

  private seed(): void {
    const workspaceSeed = createDefaultWorkspaceSeed(WORKSPACE_NAME);
    const contentLoopSeed = createSampleContentLoopSeed(WORKSPACE_ID);

    this.runTransaction(() => {
      this.database
        .prepare(
          `INSERT OR IGNORE INTO workspaces (id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?);`
        )
        .run(
          workspaceSeed.workspace.id,
          workspaceSeed.workspace.name,
          workspaceSeed.workspace.createdAt,
          workspaceSeed.workspace.updatedAt
        );

      const insertColumn = this.database.prepare(
        `INSERT OR IGNORE INTO columns (id, workspace_id, slug, name, description, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
      );
      for (const column of workspaceSeed.columns) {
        insertColumn.run(
          column.id,
          column.workspaceId,
          column.slug,
          column.name,
          column.description,
          column.priority,
          column.createdAt,
          column.updatedAt
        );
      }

      for (const topic of contentLoopSeed.topics) {
        this.upsertTopic(topic);
      }

      for (const sourceReference of contentLoopSeed.sourceReferences) {
        this.upsertSourceReference(sourceReference);
      }
    });
  }

  private loadState(selectedProjectId?: string): PersistedContentLoopState {
    const topics = this.database
      .prepare("SELECT * FROM topics ORDER BY created_at ASC, id ASC;")
      .all() as unknown as TopicRow[];
    const sourceReferences = this.database
      .prepare("SELECT * FROM source_references ORDER BY created_at ASC, id ASC;")
      .all() as unknown as SourceReferenceRow[];
    const projects = this.database
      .prepare("SELECT * FROM content_projects ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as ContentProjectRow[];
    const drafts = this.database
      .prepare("SELECT * FROM draft_versions ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as DraftVersionRow[];
    const platformPackages = this.database
      .prepare("SELECT * FROM platform_packages ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as PlatformPackageRow[];
    const publishRecords = this.database
      .prepare("SELECT * FROM publish_records ORDER BY published_at DESC, updated_at DESC, id ASC;")
      .all() as unknown as PublishRecordRow[];
    const metricSnapshots = this.database
      .prepare("SELECT * FROM metric_snapshots ORDER BY snapshot_at DESC, updated_at DESC, id ASC;")
      .all() as unknown as MetricSnapshotRow[];
    const reviewReports = this.database
      .prepare("SELECT * FROM review_reports ORDER BY updated_at DESC, version DESC, id ASC;")
      .all() as unknown as ReviewReportRow[];
    const archiveRecords = this.database
      .prepare("SELECT * FROM archive_records ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as ArchiveRecordRow[];
    const knowledgeItems = this.database
      .prepare("SELECT * FROM knowledge_items ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as KnowledgeItemRow[];
    const taskRuns = this.database
      .prepare("SELECT * FROM task_runs ORDER BY updated_at DESC, created_at DESC, id ASC;")
      .all() as unknown as TaskRunRow[];
    const selectedProject = selectedProjectId
      ? { id: selectedProjectId }
      : (this.database
          .prepare("SELECT id FROM content_projects ORDER BY updated_at DESC, created_at DESC, id ASC LIMIT 1;")
          .get() as { id: string } | undefined);

    return {
      topics: topics.map(mapTopicRow),
      sourceReferences: sourceReferences.map(mapSourceReferenceRow),
      projects: projects.map(mapContentProjectRow),
      drafts: drafts.map(mapDraftVersionRow),
      platformPackages: platformPackages.map(mapPlatformPackageRow),
      publishRecords: publishRecords.map(mapPublishRecordRow),
      metricSnapshots: metricSnapshots.map(mapMetricSnapshotRow),
      metricImportPreview: this.metricImportPreview ? cloneMetricImportPreview(this.metricImportPreview) : null,
      reviewReports: reviewReports.map(mapReviewReportRow),
      archiveRecords: archiveRecords.map(mapArchiveRecordRow),
      knowledgeItems: knowledgeItems.map(mapKnowledgeItemRow),
      taskRuns: taskRuns.map(mapTaskRunRow),
      selectedProjectId: selectedProject?.id ?? null
    };
  }

  private getTopic(topicId: string): Topic | null {
    const row = this.database.prepare("SELECT * FROM topics WHERE id = ?;").get(topicId) as TopicRow | undefined;
    return row ? mapTopicRow(row) : null;
  }

  private getContentProject(projectId: string): ContentProject | null {
    const row = this.database
      .prepare("SELECT * FROM content_projects WHERE id = ?;")
      .get(projectId) as ContentProjectRow | undefined;
    return row ? mapContentProjectRow(row) : null;
  }

  private getPlatformPackage(packageId: string): PlatformPackage | null {
    const row = this.database
      .prepare("SELECT * FROM platform_packages WHERE id = ?;")
      .get(packageId) as PlatformPackageRow | undefined;

    return row ? mapPlatformPackageRow(row) : null;
  }

  private getSourceReferencesForProject(project: ContentProject): SourceReference[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM source_references
         WHERE topic_id = ? OR content_project_id = ?
         ORDER BY created_at ASC, id ASC;`
      )
      .all(project.sourceTopicId ?? null, project.id) as unknown as SourceReferenceRow[];

    return rows.map(mapSourceReferenceRow);
  }

  private getNextDraftVersion(projectId: string): number {
    const row = this.database
      .prepare("SELECT MAX(version) AS version FROM draft_versions WHERE content_project_id = ?;")
      .get(projectId) as { version: number | null };

    return (row.version ?? 0) + 1;
  }

  private getLatestDraftForProject(projectId: string): DraftVersion | null {
    const row = this.database
      .prepare(
        `SELECT * FROM draft_versions
         WHERE content_project_id = ?
         ORDER BY version DESC, updated_at DESC, id ASC
         LIMIT 1;`
      )
      .get(projectId) as DraftVersionRow | undefined;

    return row ? mapDraftVersionRow(row) : null;
  }

  private getLatestPlatformPackageForProject(projectId: string): PlatformPackage | null {
    const row = this.database
      .prepare(
        `SELECT * FROM platform_packages
         WHERE content_project_id = ?
         ORDER BY updated_at DESC, created_at DESC, id ASC
         LIMIT 1;`
      )
      .get(projectId) as PlatformPackageRow | undefined;

    return row ? mapPlatformPackageRow(row) : null;
  }

  private runTransaction(work: () => void): void {
    let beginSucceeded = false;

    try {
      this.database.exec("BEGIN;");
      beginSucceeded = true;
      work();
      this.database.exec("COMMIT;");
    } catch (error) {
      this.rollbackIfActive(beginSucceeded);
      throw error;
    }
  }

  private rollbackIfActive(beginSucceeded: boolean): void {
    if (!beginSucceeded) {
      return;
    }

    try {
      const isTransactionActive = "isTransaction" in this.database ? this.database.isTransaction : beginSucceeded;
      if (isTransactionActive) {
        this.database.exec("ROLLBACK;");
      }
    } catch {
      // Preserve the original transaction failure.
    }
  }

  private createPromotionDate(): Date {
    const row = this.database
      .prepare(
        `SELECT MAX(updated_at) AS updated_at
         FROM (
           SELECT updated_at FROM topics
           UNION ALL
           SELECT updated_at FROM content_projects
           UNION ALL
           SELECT updated_at FROM draft_versions
           UNION ALL
           SELECT updated_at FROM platform_packages
           UNION ALL
           SELECT updated_at FROM publish_records
           UNION ALL
           SELECT snapshot_at AS updated_at FROM metric_snapshots
           UNION ALL
           SELECT updated_at FROM metric_snapshots
           UNION ALL
           SELECT updated_at FROM review_reports
           UNION ALL
           SELECT updated_at FROM archive_records
           UNION ALL
           SELECT updated_at FROM knowledge_items
           UNION ALL
           SELECT updated_at FROM source_references
           UNION ALL
           SELECT updated_at FROM task_runs
         );`
      )
      .get() as { updated_at: string | null };
    const latestPersistedTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const nextTime = Math.max(Date.now(), latestPersistedTime + 1);

    return new Date(nextTime);
  }

  private upsertTopic(topic: Topic): void {
    this.database
      .prepare(
        `INSERT INTO topics (
          id, workspace_id, column_slug, title, hook, audience, target_platforms_json,
          status, score_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          column_slug = excluded.column_slug,
          title = excluded.title,
          hook = excluded.hook,
          audience = excluded.audience,
          target_platforms_json = excluded.target_platforms_json,
          status = excluded.status,
          score_json = excluded.score_json,
          updated_at = excluded.updated_at;`
      )
      .run(
        topic.id,
        topic.workspaceId,
        topic.columnSlug,
        topic.title,
        topic.hook,
        topic.audience,
        JSON.stringify(topic.targetPlatforms),
        topic.status,
        JSON.stringify(topic.score),
        topic.createdAt,
        topic.updatedAt
      );
  }

  private insertTopicIfMissing(topic: Topic): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO topics (
          id, workspace_id, column_slug, title, hook, audience, target_platforms_json,
          status, score_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run(
        topic.id,
        topic.workspaceId,
        topic.columnSlug,
        topic.title,
        topic.hook,
        topic.audience,
        JSON.stringify(topic.targetPlatforms),
        topic.status,
        JSON.stringify(topic.score),
        topic.createdAt,
        topic.updatedAt
      );
  }

  private upsertSourceReference(sourceReference: SourceReference): void {
    this.database
      .prepare(
        `INSERT INTO source_references (
          id, workspace_id, column_slug, topic_id, content_project_id, kind, title, url,
          platform, author, published_at, extraction_status, usage_status, excerpt,
          tags_json, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          column_slug = excluded.column_slug,
          topic_id = excluded.topic_id,
          content_project_id = excluded.content_project_id,
          kind = excluded.kind,
          title = excluded.title,
          url = excluded.url,
          platform = excluded.platform,
          author = excluded.author,
          published_at = excluded.published_at,
          extraction_status = excluded.extraction_status,
          usage_status = excluded.usage_status,
          excerpt = excluded.excerpt,
          tags_json = excluded.tags_json,
          note = excluded.note,
          updated_at = excluded.updated_at;`
      )
      .run(
        sourceReference.id,
        sourceReference.workspaceId,
        sourceReference.columnSlug ?? null,
        sourceReference.topicId ?? null,
        sourceReference.contentProjectId ?? null,
        sourceReference.kind,
        sourceReference.title,
        sourceReference.url ?? null,
        sourceReference.platform ?? null,
        sourceReference.author ?? null,
        sourceReference.publishedAt ?? null,
        sourceReference.extractionStatus ?? "manual",
        sourceReference.usageStatus ?? "unused",
        sourceReference.excerpt ?? "",
        JSON.stringify(sourceReference.tags ?? []),
        sourceReference.note,
        sourceReference.createdAt,
        sourceReference.updatedAt
      );
  }

  private insertSourceReferenceIfMissing(sourceReference: SourceReference): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO source_references (
          id, workspace_id, column_slug, topic_id, content_project_id, kind, title, url,
          platform, author, published_at, extraction_status, usage_status, excerpt,
          tags_json, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run(
        sourceReference.id,
        sourceReference.workspaceId,
        sourceReference.columnSlug ?? null,
        sourceReference.topicId ?? null,
        sourceReference.contentProjectId ?? null,
        sourceReference.kind,
        sourceReference.title,
        sourceReference.url ?? null,
        sourceReference.platform ?? null,
        sourceReference.author ?? null,
        sourceReference.publishedAt ?? null,
        sourceReference.extractionStatus ?? "manual",
        sourceReference.usageStatus ?? "unused",
        sourceReference.excerpt ?? "",
        JSON.stringify(sourceReference.tags ?? []),
        sourceReference.note,
        sourceReference.createdAt,
        sourceReference.updatedAt
      );
  }

  private upsertContentProject(project: ContentProject): void {
    this.database
      .prepare(
        `INSERT INTO content_projects (
          id, workspace_id, primary_column_id, source_topic_id, title, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          primary_column_id = excluded.primary_column_id,
          source_topic_id = excluded.source_topic_id,
          title = excluded.title,
          status = excluded.status,
          updated_at = excluded.updated_at;`
      )
      .run(
        project.id,
        project.workspaceId,
        project.primaryColumnId,
        project.sourceTopicId ?? null,
        project.title,
        project.status,
        project.createdAt,
        project.updatedAt
      );
  }

  private upsertDraftVersion(draft: DraftVersion): void {
    this.database
      .prepare(
        `INSERT INTO draft_versions (
          id, workspace_id, content_project_id, version, title, body, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          version = excluded.version,
          title = excluded.title,
          body = excluded.body,
          created_by = excluded.created_by,
          updated_at = excluded.updated_at;`
      )
      .run(
        draft.id,
        draft.workspaceId,
        draft.contentProjectId,
        draft.version,
        draft.title,
        draft.body,
        draft.createdBy,
        draft.createdAt,
        draft.updatedAt
      );
  }

  private upsertPlatformPackage(platformPackage: PlatformPackage): void {
    this.database
      .prepare(
        `INSERT INTO platform_packages (
          id, workspace_id, content_project_id, draft_version_id, platform, title, body,
          tags_json, cover_text, required_assets_json, checks_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          draft_version_id = excluded.draft_version_id,
          platform = excluded.platform,
          title = excluded.title,
          body = excluded.body,
          tags_json = excluded.tags_json,
          cover_text = excluded.cover_text,
          required_assets_json = excluded.required_assets_json,
          checks_json = excluded.checks_json,
          updated_at = excluded.updated_at;`
      )
      .run(
        platformPackage.id,
        platformPackage.workspaceId,
        platformPackage.contentProjectId,
        platformPackage.draftVersionId,
        platformPackage.platform,
        platformPackage.title,
        platformPackage.body,
        JSON.stringify(platformPackage.tags),
        platformPackage.coverText,
        JSON.stringify(platformPackage.requiredAssets),
        JSON.stringify(platformPackage.checks),
        platformPackage.createdAt,
        platformPackage.updatedAt
      );
  }

  private upsertPublishRecord(publishRecord: PublishRecord): void {
    this.database
      .prepare(
        `INSERT INTO publish_records (
          id, workspace_id, content_project_id, platform_package_id, platform, status,
          published_at, url, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          platform_package_id = excluded.platform_package_id,
          platform = excluded.platform,
          status = excluded.status,
          published_at = excluded.published_at,
          url = excluded.url,
          note = excluded.note,
          updated_at = excluded.updated_at;`
      )
      .run(
        publishRecord.id,
        publishRecord.workspaceId,
        publishRecord.contentProjectId,
        publishRecord.platformPackageId,
        publishRecord.platform,
        publishRecord.status,
        publishRecord.publishedAt,
        publishRecord.url,
        publishRecord.note,
        publishRecord.createdAt,
        publishRecord.updatedAt
      );
  }

  private upsertMetricSnapshot(snapshot: MetricSnapshot): void {
    this.database
      .prepare(
        `INSERT INTO metric_snapshots (
          id, workspace_id, content_project_id, publish_record_id, platform, source_file_name,
          snapshot_at, views, likes, favorites, comments, shares, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          publish_record_id = excluded.publish_record_id,
          platform = excluded.platform,
          source_file_name = excluded.source_file_name,
          snapshot_at = excluded.snapshot_at,
          views = excluded.views,
          likes = excluded.likes,
          favorites = excluded.favorites,
          comments = excluded.comments,
          shares = excluded.shares,
          note = excluded.note,
          updated_at = excluded.updated_at;`
      )
      .run(
        snapshot.id,
        snapshot.workspaceId,
        snapshot.contentProjectId,
        snapshot.publishRecordId,
        snapshot.platform,
        snapshot.sourceFileName,
        snapshot.snapshotAt,
        snapshot.views,
        snapshot.likes,
        snapshot.favorites,
        snapshot.comments,
        snapshot.shares,
        snapshot.note,
        snapshot.createdAt,
        snapshot.updatedAt
      );
  }

  private insertReviewReport(reviewReport: ReviewReport): void {
    this.database
      .prepare(
        `INSERT INTO review_reports (
          id, workspace_id, content_project_id, publish_record_id, metric_snapshot_id,
          version, summary, highlights_json, underperforming_signals_json, likely_causes_json,
          next_actions_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run(
        reviewReport.id,
        reviewReport.workspaceId,
        reviewReport.contentProjectId,
        reviewReport.publishRecordId,
        reviewReport.metricSnapshotId ?? null,
        reviewReport.version,
        reviewReport.summary,
        JSON.stringify(reviewReport.highlights),
        JSON.stringify(reviewReport.underperformingSignals),
        JSON.stringify(reviewReport.likelyCauses),
        JSON.stringify(reviewReport.nextActions),
        reviewReport.createdAt,
        reviewReport.updatedAt
      );
  }

  private upsertArchiveRecord(archiveRecord: ArchiveRecord): void {
    this.database
      .prepare(
        `INSERT INTO archive_records (
          id, workspace_id, content_project_id, draft_version_id, platform_package_id, title,
          summary, source_count, package_count, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          content_project_id = excluded.content_project_id,
          draft_version_id = excluded.draft_version_id,
          platform_package_id = excluded.platform_package_id,
          title = excluded.title,
          summary = excluded.summary,
          source_count = excluded.source_count,
          package_count = excluded.package_count,
          status = excluded.status,
          updated_at = excluded.updated_at;`
      )
      .run(
        archiveRecord.id,
        archiveRecord.workspaceId,
        archiveRecord.contentProjectId,
        archiveRecord.draftVersionId ?? null,
        archiveRecord.platformPackageId ?? null,
        archiveRecord.title,
        archiveRecord.summary,
        archiveRecord.sourceCount,
        archiveRecord.packageCount,
        archiveRecord.status,
        archiveRecord.createdAt,
        archiveRecord.updatedAt
      );
  }

  private upsertKnowledgeItem(knowledgeItem: KnowledgeItem): void {
    this.database
      .prepare(
        `INSERT INTO knowledge_items (
          id, workspace_id, archive_record_id, content_project_id, column_slug, title,
          lesson, evidence, tags_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          archive_record_id = excluded.archive_record_id,
          content_project_id = excluded.content_project_id,
          column_slug = excluded.column_slug,
          title = excluded.title,
          lesson = excluded.lesson,
          evidence = excluded.evidence,
          tags_json = excluded.tags_json,
          updated_at = excluded.updated_at;`
      )
      .run(
        knowledgeItem.id,
        knowledgeItem.workspaceId,
        knowledgeItem.archiveRecordId,
        knowledgeItem.contentProjectId,
        knowledgeItem.columnSlug,
        knowledgeItem.title,
        knowledgeItem.lesson,
        knowledgeItem.evidence,
        JSON.stringify(knowledgeItem.tags),
        knowledgeItem.createdAt,
        knowledgeItem.updatedAt
      );
  }

  private upsertTaskRun(taskRun: TaskRun): void {
    this.database
      .prepare(
        `INSERT INTO task_runs (
          id, workspace_id, kind, label, phase, status, completed_count,
          total_count, message, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          kind = excluded.kind,
          label = excluded.label,
          phase = excluded.phase,
          status = excluded.status,
          completed_count = excluded.completed_count,
          total_count = excluded.total_count,
          message = excluded.message,
          updated_at = excluded.updated_at;`
      )
      .run(
        taskRun.id,
        taskRun.workspaceId,
        taskRun.kind,
        taskRun.label,
        taskRun.phase,
        taskRun.status,
        taskRun.completedCount,
        taskRun.totalCount,
        taskRun.message,
        taskRun.createdAt,
        taskRun.updatedAt
      );
  }
}

function mapTopicRow(row: TopicRow): Topic {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    columnSlug: row.column_slug as ContentColumnSlug,
    title: row.title,
    hook: row.hook,
    audience: row.audience,
    targetPlatforms: JSON.parse(row.target_platforms_json) as Platform[],
    status: row.status as TopicStatus,
    score: JSON.parse(row.score_json) as TopicScore,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSourceReferenceRow(row: SourceReferenceRow): SourceReference {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ...(row.column_slug ? { columnSlug: row.column_slug as ContentColumnSlug } : {}),
    ...(row.topic_id ? { topicId: row.topic_id } : {}),
    ...(row.content_project_id ? { contentProjectId: row.content_project_id } : {}),
    kind: row.kind as SourceReferenceKind,
    title: row.title,
    ...(row.url ? { url: row.url } : {}),
    ...(row.platform ? { platform: row.platform as Platform } : {}),
    ...(row.author ? { author: row.author } : {}),
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    extractionStatus: row.extraction_status as SourceExtractionStatus,
    usageStatus: row.usage_status as SourceUsageStatus,
    ...(row.excerpt ? { excerpt: row.excerpt } : {}),
    tags: JSON.parse(row.tags_json) as string[],
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTaskRunRow(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind as TaskRunKind,
    label: row.label,
    phase: row.phase as TaskRunPhase,
    status: row.status as TaskRunStatus,
    completedCount: row.completed_count,
    totalCount: row.total_count,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapContentProjectRow(row: ContentProjectRow): ContentProject {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    primaryColumnId: row.primary_column_id,
    ...(row.source_topic_id ? { sourceTopicId: row.source_topic_id } : {}),
    title: row.title,
    status: row.status as ContentProjectStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDraftVersionRow(row: DraftVersionRow): DraftVersion {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    version: row.version,
    title: row.title,
    body: row.body,
    createdBy: row.created_by as DraftVersion["createdBy"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlatformPackageRow(row: PlatformPackageRow): PlatformPackage {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    draftVersionId: row.draft_version_id,
    platform: row.platform as Platform,
    title: row.title,
    body: row.body,
    tags: JSON.parse(row.tags_json) as string[],
    coverText: row.cover_text,
    requiredAssets: JSON.parse(row.required_assets_json) as string[],
    checks: JSON.parse(row.checks_json) as PlatformPackageCheck[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublishRecordRow(row: PublishRecordRow): PublishRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    platformPackageId: row.platform_package_id,
    platform: row.platform as Platform,
    status: row.status as PublishRecord["status"],
    publishedAt: row.published_at,
    url: row.url,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMetricSnapshotRow(row: MetricSnapshotRow): MetricSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    publishRecordId: row.publish_record_id,
    platform: row.platform as Platform,
    sourceFileName: row.source_file_name,
    snapshotAt: row.snapshot_at,
    views: row.views,
    likes: row.likes,
    favorites: row.favorites,
    comments: row.comments,
    shares: row.shares,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReviewReportRow(row: ReviewReportRow): ReviewReport {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    publishRecordId: row.publish_record_id,
    ...(row.metric_snapshot_id ? { metricSnapshotId: row.metric_snapshot_id } : {}),
    version: row.version,
    summary: row.summary,
    highlights: JSON.parse(row.highlights_json) as string[],
    underperformingSignals: JSON.parse(row.underperforming_signals_json) as string[],
    likelyCauses: JSON.parse(row.likely_causes_json) as string[],
    nextActions: JSON.parse(row.next_actions_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapArchiveRecordRow(row: ArchiveRecordRow): ArchiveRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentProjectId: row.content_project_id,
    ...(row.draft_version_id ? { draftVersionId: row.draft_version_id } : {}),
    ...(row.platform_package_id ? { platformPackageId: row.platform_package_id } : {}),
    title: row.title,
    summary: row.summary,
    sourceCount: row.source_count,
    packageCount: row.package_count,
    status: row.status as ArchiveRecord["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cloneMetricImportPreview(preview: MetricImportPreview): MetricImportPreview {
  return {
    ...preview,
    rows: preview.rows.map((row) => ({ ...row, metrics: { ...row.metrics } }))
  };
}

function mapKnowledgeItemRow(row: KnowledgeItemRow): KnowledgeItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    archiveRecordId: row.archive_record_id,
    contentProjectId: row.content_project_id,
    columnSlug: row.column_slug as ContentColumnSlug,
    title: row.title,
    lesson: row.lesson,
    evidence: row.evidence,
    tags: JSON.parse(row.tags_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function compareMetricSnapshots(left: MetricSnapshot, right: MetricSnapshot): number {
  return (
    right.snapshotAt.localeCompare(left.snapshotAt) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}
