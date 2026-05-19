import { DatabaseSync } from "node:sqlite";
import {
  createContentProjectFromTopic,
  createDefaultWorkspaceSeed,
  createSampleContentLoopSeed,
  generateMockDraftPackage,
  generateMockTopics,
  generateMockXiaohongshuPackage
} from "@robert-station/core";
import type {
  ContentColumnSlug,
  ContentProject,
  ContentProjectStatus,
  DraftVersion,
  Platform,
  PlatformPackage,
  PlatformPackageCheck,
  SourceReference,
  SourceReferenceKind,
  Topic,
  TopicScore,
  TopicStatus
} from "@robert-station/core";
import type { ContentLoopRepository, PersistedContentLoopState } from "./content-loop-repository";
import { getSqliteSchemaStatements } from "./schema";

const WORKSPACE_NAME = "Robert Station";
const WORKSPACE_ID = "workspace_robert-station";

interface SqliteContentLoopRepositoryOptions {
  databasePath: string;
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
  topic_id: string | null;
  content_project_id: string | null;
  kind: string;
  title: string;
  url: string | null;
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

export class SqliteContentLoopRepository implements ContentLoopRepository {
  private constructor(private readonly database: DatabaseSync) {}

  static open(options: SqliteContentLoopRepositoryOptions): SqliteContentLoopRepository {
    const database = new DatabaseSync(options.databasePath);

    try {
      const repository = new SqliteContentLoopRepository(database);
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
    const generated = generateMockTopics({ columnSlug, workspaceId: WORKSPACE_ID, now: this.createPromotionDate() });

    this.runTransaction(() => {
      for (const topic of generated.topics) {
        this.insertTopicIfMissing(topic);
      }

      for (const sourceReference of generated.sourceReferences) {
        this.insertSourceReferenceIfMissing(sourceReference);
      }
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
    const draft = generateMockDraftPackage({
      project,
      topic,
      sourceReferences,
      nextVersion: this.getNextDraftVersion(project.id),
      now: this.createPromotionDate()
    });

    this.runTransaction(() => {
      this.upsertDraftVersion(draft);
    });

    return this.loadState(project.id);
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
          id, workspace_id, topic_id, content_project_id, kind, title, url, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workspace_id = excluded.workspace_id,
          topic_id = excluded.topic_id,
          content_project_id = excluded.content_project_id,
          kind = excluded.kind,
          title = excluded.title,
          url = excluded.url,
          note = excluded.note,
          updated_at = excluded.updated_at;`
      )
      .run(
        sourceReference.id,
        sourceReference.workspaceId,
        sourceReference.topicId ?? null,
        sourceReference.contentProjectId ?? null,
        sourceReference.kind,
        sourceReference.title,
        sourceReference.url ?? null,
        sourceReference.note,
        sourceReference.createdAt,
        sourceReference.updatedAt
      );
  }

  private insertSourceReferenceIfMissing(sourceReference: SourceReference): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO source_references (
          id, workspace_id, topic_id, content_project_id, kind, title, url, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run(
        sourceReference.id,
        sourceReference.workspaceId,
        sourceReference.topicId ?? null,
        sourceReference.contentProjectId ?? null,
        sourceReference.kind,
        sourceReference.title,
        sourceReference.url ?? null,
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
    ...(row.topic_id ? { topicId: row.topic_id } : {}),
    ...(row.content_project_id ? { contentProjectId: row.content_project_id } : {}),
    kind: row.kind as SourceReferenceKind,
    title: row.title,
    ...(row.url ? { url: row.url } : {}),
    note: row.note,
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
