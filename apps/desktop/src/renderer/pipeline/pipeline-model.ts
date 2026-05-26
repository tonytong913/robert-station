import {
  DEFAULT_COLUMNS,
  type ArchiveRecord,
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  KnowledgeItem,
  MetricSnapshot,
  Platform,
  PlatformPackage,
  PublishRecord,
  ReviewReport,
  Topic
} from "@robert-station/core"

export type PipelineStage = "candidate" | "planned" | "drafting" | "readyToPublish" | "published" | "learning"

export type PipelineStageFilter = PipelineStage | "all"

export type PipelineColumnFilter = ContentColumnSlug | "all"

export type PipelinePlatformFilter = Platform | "all"

export interface PipelineFilters {
  columnSlug: PipelineColumnFilter
  platform: PipelinePlatformFilter
  stage: PipelineStageFilter
  query: string
}

export interface PipelineContentLoopState {
  topics: Topic[]
  projects: ContentProject[]
  drafts: DraftVersion[]
  platformPackages: PlatformPackage[]
  publishRecords: PublishRecord[]
  metricSnapshots: MetricSnapshot[]
  reviewReports: ReviewReport[]
  archiveRecords: ArchiveRecord[]
  knowledgeItems: KnowledgeItem[]
}

export type PipelineActionKind =
  | "generateTopics"
  | "promoteTopic"
  | "generateDraftPackage"
  | "generatePlatformPackage"
  | "recordManualPublish"
  | "importMetricCsv"
  | "saveMetricImport"
  | "generateReviewReport"
  | "extractReviewKnowledge"
  | "archiveProject"
  | "createContentLoopExport"

export type PipelineItem =
  | {
      kind: "topic"
      stage: "candidate"
      topicId: string
    }
  | {
      kind: "project"
      stage: Exclude<PipelineStage, "candidate">
      projectId: string
    }

export interface PipelineAction {
  kind: PipelineActionKind
  labelKey: string
  topicId?: string
  projectId?: string
  platformPackageId?: string
  publishRecordId?: string
  reviewReportId?: string
}

export interface PipelineCardViewModel {
  id: string
  item: PipelineItem
  title: string
  description: string
  stage: PipelineStage
  columnSlug: ContentColumnSlug
  columnLabel: string
  platforms: Platform[]
  statusLabelKey: string
  primaryMetricLabelKey: string
  primaryMetricValue: string
  warningLabelKey: string | null
  updatedAt: string
}

export interface PipelineColumnViewModel {
  stage: PipelineStage
  titleKey: string
  labelKey: string
  descriptionKey: string
  emptyKey: string
  items: PipelineCardViewModel[]
}

export interface PipelineDetailSection {
  titleKey: string
  items: Array<{
    labelKey: string
    value: string
  }>
}

export interface PipelineDetailViewModel {
  id: string
  item: PipelineItem
  title: string
  description: string
  stage: PipelineStage
  columnSlug: ContentColumnSlug
  platforms: Platform[]
  statusLabelKey: string
  primaryAction: PipelineAction | null
  secondaryActions: PipelineAction[]
  sections: PipelineDetailSection[]
}

export const pipelineStages: PipelineStage[] = [
  "candidate",
  "planned",
  "drafting",
  "readyToPublish",
  "published",
  "learning"
]

const fallbackColumnSlug: ContentColumnSlug = "ai"
const fallbackColumnLabel = "未知栏目"
const knownColumnSlugs = new Set<ContentColumnSlug>(DEFAULT_COLUMNS.map((column) => column.slug))

export function buildPipelineColumns(
  contentLoop: PipelineContentLoopState | null,
  filters: PipelineFilters
): PipelineColumnViewModel[] {
  if (!contentLoop) {
    return visibleStages(filters.stage).map((stage) => ({
      stage,
      titleKey: `pipeline.stage.${stage}`,
      labelKey: `pipeline.stage.${stage}.label`,
      descriptionKey: `pipeline.stage.${stage}.description`,
      emptyKey: `pipeline.stage.${stage}.empty`,
      items: []
    }))
  }

  const cards = [
    ...contentLoop.topics
      .filter((topic) => isPipelineTopic(topic, contentLoop.projects))
      .map((topic) => buildTopicCard(topic)),
    ...contentLoop.projects.map((project) => buildProjectCard(contentLoop, project))
  ].filter((card) => matchesFilters(contentLoop, card, filters))

  return visibleStages(filters.stage).map((stage) => ({
    stage,
    titleKey: `pipeline.stage.${stage}`,
    labelKey: `pipeline.stage.${stage}.label`,
    descriptionKey: `pipeline.stage.${stage}.description`,
    emptyKey: `pipeline.stage.${stage}.empty`,
    items: cards.filter((card) => card.stage === stage)
  }))
}

export function resolvePipelineDetail(
  contentLoop: PipelineContentLoopState | null,
  item: PipelineItem | null
): PipelineDetailViewModel | null {
  if (!contentLoop || !item) {
    return null
  }

  if (item.kind === "topic") {
    const topic = contentLoop.topics.find((candidate) => candidate.id === item.topicId)

    return topic ? buildTopicDetail(topic) : null
  }

  const project = contentLoop.projects.find((candidate) => candidate.id === item.projectId)

  return project ? buildProjectDetail(contentLoop, project) : null
}

function isPipelineTopic(topic: Topic, projects: ContentProject[]): boolean {
  return (topic.status === "candidate" || topic.status === "kept") &&
    !projects.some((project) => project.sourceTopicId === topic.id)
}

function buildTopicCard(topic: Topic): PipelineCardViewModel {
  const item: PipelineItem = {
    kind: "topic",
    stage: "candidate",
    topicId: topic.id
  }

  return {
    id: topic.id,
    item,
    title: topic.title,
    description: topic.hook,
    stage: "candidate",
    columnSlug: topic.columnSlug,
    columnLabel: formatColumnLabel(topic.columnSlug),
    platforms: topic.targetPlatforms,
    statusLabelKey: "pipeline.status.candidate",
    primaryMetricLabelKey: "pipeline.metric.heat",
    primaryMetricValue: String(topic.score.heat),
    warningLabelKey: null,
    updatedAt: topic.updatedAt
  }
}

function buildProjectCard(
  contentLoop: PipelineContentLoopState,
  project: ContentProject
): PipelineCardViewModel {
  const sourceTopic = findSourceTopic(contentLoop, project)
  const stage = resolveProjectStage(contentLoop, project)
  const column = resolveProjectColumn(project, sourceTopic)
  const item: PipelineItem = {
    kind: "project",
    stage,
    projectId: project.id
  }

  return {
    id: project.id,
    item,
    title: project.title,
    description: sourceTopic?.hook ?? project.status,
    stage,
    columnSlug: column.slug,
    columnLabel: column.label,
    platforms: resolveProjectPlatforms(contentLoop, project, sourceTopic),
    statusLabelKey: statusLabelKey(stage),
    primaryMetricLabelKey: "pipeline.metric.artifacts",
    primaryMetricValue: String(countProjectArtifacts(contentLoop, project.id)),
    warningLabelKey: null,
    updatedAt: project.updatedAt
  }
}

function resolveProjectStage(
  contentLoop: PipelineContentLoopState,
  project: ContentProject
): Exclude<PipelineStage, "candidate"> {
  if (
    project.status === "archived" ||
    project.status === "reviewed" ||
    contentLoop.knowledgeItems.some((item) => item.contentProjectId === project.id) ||
    contentLoop.archiveRecords.some((record) => record.contentProjectId === project.id) ||
    contentLoop.reviewReports.some((report) => report.contentProjectId === project.id)
  ) {
    return "learning"
  }

  if (contentLoop.publishRecords.some((record) => record.contentProjectId === project.id)) {
    return "published"
  }

  if (contentLoop.platformPackages.some((platformPackage) => platformPackage.contentProjectId === project.id)) {
    return "readyToPublish"
  }

  if (project.status === "topic") {
    return "planned"
  }

  return "drafting"
}

function matchesFilters(
  contentLoop: PipelineContentLoopState,
  card: PipelineCardViewModel,
  filters: PipelineFilters
): boolean {
  if (filters.stage !== "all" && card.stage !== filters.stage) {
    return false
  }

  if (filters.columnSlug !== "all" && card.columnSlug !== filters.columnSlug) {
    return false
  }

  if (filters.platform !== "all" && !matchesPlatform(contentLoop, card, filters.platform)) {
    return false
  }

  const query = filters.query.trim().toLocaleLowerCase()

  return query.length === 0 || searchableText(contentLoop, card).toLocaleLowerCase().includes(query)
}

function matchesPlatform(
  contentLoop: PipelineContentLoopState,
  card: PipelineCardViewModel,
  platform: Platform
): boolean {
  if (card.item.kind === "topic") {
    return card.platforms.includes(platform)
  }

  const projectId = card.item.projectId
  const projectPackages = contentLoop.platformPackages.filter(
    (platformPackage) => platformPackage.contentProjectId === projectId
  )
  const publishRecords = contentLoop.publishRecords.filter((record) => record.contentProjectId === projectId)
  const artifactPlatforms = [...projectPackages.map((platformPackage) => platformPackage.platform), ...publishRecords.map((record) => record.platform)]

  return artifactPlatforms.length > 0 ? artifactPlatforms.includes(platform) : card.platforms.includes(platform)
}

function searchableText(contentLoop: PipelineContentLoopState, card: PipelineCardViewModel): string {
  if (card.item.kind === "topic") {
    const topicId = card.item.topicId
    const topic = contentLoop.topics.find((candidate) => candidate.id === topicId)

    return [card.title, card.description, topic?.audience ?? ""].join(" ")
  }

  const projectId = card.item.projectId
  const project = contentLoop.projects.find((candidate) => candidate.id === projectId)
  const topic = project ? findSourceTopic(contentLoop, project) : null
  const drafts = contentLoop.drafts.filter((draft) => draft.contentProjectId === projectId)
  const packages = contentLoop.platformPackages.filter(
    (platformPackage) => platformPackage.contentProjectId === projectId
  )

  return [
    card.title,
    card.description,
    topic?.hook ?? "",
    topic?.audience ?? "",
    ...drafts.flatMap((draft) => [draft.title, draft.body]),
    ...packages.flatMap((platformPackage) => [platformPackage.title, platformPackage.body, platformPackage.coverText])
  ].join(" ")
}

function buildTopicDetail(topic: Topic): PipelineDetailViewModel {
  const item: PipelineItem = {
    kind: "topic",
    stage: "candidate",
    topicId: topic.id
  }

  return {
    id: topic.id,
    item,
    title: topic.title,
    description: topic.hook,
    stage: "candidate",
    columnSlug: topic.columnSlug,
    platforms: topic.targetPlatforms,
    statusLabelKey: "pipeline.status.candidate",
    primaryAction: {
      kind: "promoteTopic",
      labelKey: "topics.promote"
    },
    secondaryActions: [
      {
        kind: "generateTopics",
        labelKey: "pipeline.actions.generateTopics"
      }
    ],
    sections: [
      {
        titleKey: "pipeline.detail.topic",
        items: [
          { labelKey: "pipeline.detail.hook", value: topic.hook },
          { labelKey: "pipeline.detail.audience", value: topic.audience },
          { labelKey: "pipeline.detail.status", value: topic.status }
        ]
      },
      {
        titleKey: "pipeline.detail.scores",
        items: [
          { labelKey: "pipeline.detail.score.heat", value: String(topic.score.heat) },
          { labelKey: "pipeline.detail.score.fit", value: String(topic.score.fit) },
          { labelKey: "pipeline.detail.score.difficulty", value: String(topic.score.difficulty) },
          { labelKey: "pipeline.detail.score.personaConsistency", value: String(topic.score.personaConsistency) }
        ]
      }
    ]
  }
}

function buildProjectDetail(
  contentLoop: PipelineContentLoopState,
  project: ContentProject
): PipelineDetailViewModel {
  const sourceTopic = findSourceTopic(contentLoop, project)
  const drafts = contentLoop.drafts.filter((draft) => draft.contentProjectId === project.id)
  const platformPackages = contentLoop.platformPackages.filter(
    (platformPackage) => platformPackage.contentProjectId === project.id
  )
  const publishRecords = contentLoop.publishRecords.filter((record) => record.contentProjectId === project.id)
  const reviewReports = contentLoop.reviewReports.filter((report) => report.contentProjectId === project.id)
  const archiveRecords = contentLoop.archiveRecords.filter((record) => record.contentProjectId === project.id)
  const stage = resolveProjectStage(contentLoop, project)
  const column = resolveProjectColumn(project, sourceTopic)
  const item: PipelineItem = {
    kind: "project",
    stage,
    projectId: project.id
  }

  return {
    id: project.id,
    item,
    title: project.title,
    description: sourceTopic?.hook ?? project.status,
    stage,
    columnSlug: column.slug,
    platforms: resolveProjectPlatforms(contentLoop, project, sourceTopic),
    statusLabelKey: statusLabelKey(stage),
    primaryAction: resolveProjectPrimaryAction(stage, project, platformPackages, publishRecords),
    secondaryActions: resolveProjectSecondaryActions(project, reviewReports),
    sections: [
      buildProjectSection(project, sourceTopic),
      ...buildDraftSections(drafts),
      ...buildPackageSections(platformPackages),
      ...buildPublishSections(publishRecords),
      ...buildReviewSections(reviewReports),
      ...buildArchiveSections(archiveRecords)
    ]
  }
}

function buildProjectSection(project: ContentProject, sourceTopic: Topic | null): PipelineDetailSection {
  return {
    titleKey: "pipeline.detail.project",
    items: [
      { labelKey: "pipeline.detail.status", value: project.status },
      { labelKey: "pipeline.detail.sourceTopic", value: sourceTopic?.title ?? "" }
    ]
  }
}

function buildDraftSections(drafts: DraftVersion[]): PipelineDetailSection[] {
  return drafts.map((draft) => ({
    titleKey: "pipeline.detail.draft",
    items: [
      { labelKey: "pipeline.detail.version", value: String(draft.version) },
      { labelKey: "pipeline.detail.title", value: draft.title },
      { labelKey: "pipeline.detail.updatedAt", value: draft.updatedAt }
    ]
  }))
}

function buildPackageSections(platformPackages: PlatformPackage[]): PipelineDetailSection[] {
  return platformPackages.map((platformPackage) => ({
    titleKey: "pipeline.detail.package",
    items: [
      { labelKey: "pipeline.detail.platform", value: platformPackage.platform },
      { labelKey: "pipeline.detail.title", value: platformPackage.title },
      { labelKey: "pipeline.detail.updatedAt", value: platformPackage.updatedAt }
    ]
  }))
}

function buildPublishSections(publishRecords: PublishRecord[]): PipelineDetailSection[] {
  return publishRecords.map((record) => ({
    titleKey: "pipeline.detail.publish",
    items: [
      { labelKey: "pipeline.detail.platform", value: record.platform },
      { labelKey: "pipeline.detail.url", value: record.url },
      { labelKey: "publish.note", value: record.note },
      { labelKey: "pipeline.detail.publishedAt", value: record.publishedAt }
    ]
  }))
}

function buildReviewSections(reviewReports: ReviewReport[]): PipelineDetailSection[] {
  return reviewReports.map((report) => ({
    titleKey: "pipeline.detail.review",
    items: [
      { labelKey: "pipeline.detail.version", value: String(report.version) },
      { labelKey: "pipeline.detail.summary", value: report.summary },
      { labelKey: "review.highlights", value: report.highlights.join("\n") },
      { labelKey: "review.underperforming", value: report.underperformingSignals.join("\n") },
      { labelKey: "review.causes", value: report.likelyCauses.join("\n") },
      { labelKey: "review.nextActions", value: report.nextActions.join("\n") },
      { labelKey: "pipeline.detail.updatedAt", value: report.updatedAt }
    ]
  }))
}

function buildArchiveSections(
  archiveRecords: ArchiveRecord[]
): PipelineDetailSection[] {
  return archiveRecords.map((record) => ({
    titleKey: "pipeline.detail.archive",
    items: [
      { labelKey: "pipeline.detail.title", value: record.title },
      { labelKey: "pipeline.detail.summary", value: record.summary },
      { labelKey: "pipeline.detail.updatedAt", value: record.updatedAt }
    ]
  }))
}

function resolveProjectPrimaryAction(
  stage: Exclude<PipelineStage, "candidate">,
  project: ContentProject,
  platformPackages: PlatformPackage[],
  publishRecords: PublishRecord[]
): PipelineAction | null {
  if (stage === "planned") {
    return {
      kind: "generateDraftPackage",
      labelKey: "pipeline.actions.generateDraftPackage",
      projectId: project.id
    }
  }

  if (stage === "drafting") {
    return {
      kind: "generatePlatformPackage",
      labelKey: "pipeline.actions.generatePlatformPackage",
      projectId: project.id
    }
  }

  if (stage === "readyToPublish") {
    const platformPackage = latestPlatformPackage(platformPackages)

    return platformPackage ? {
      kind: "recordManualPublish",
      labelKey: "pipeline.actions.recordManualPublish",
      platformPackageId: platformPackage.id
    } : null
  }

  if (stage === "published") {
    const publishRecord = latestPublishRecord(publishRecords)

    return publishRecord ? {
      kind: "generateReviewReport",
      labelKey: "pipeline.actions.generateReviewReport",
      publishRecordId: publishRecord.id
    } : null
  }

  return null
}

function resolveProjectColumn(project: ContentProject, sourceTopic: Topic | null): { slug: ContentColumnSlug; label: string } {
  if (sourceTopic) {
    return {
      slug: sourceTopic.columnSlug,
      label: formatColumnLabel(sourceTopic.columnSlug)
    }
  }

  const match = /^column_(.+)$/.exec(project.primaryColumnId)
  const slug = match?.[1]

  if (isKnownColumnSlug(slug)) {
    return {
      slug,
      label: formatColumnLabel(slug)
    }
  }

  return {
    slug: fallbackColumnSlug,
    label: fallbackColumnLabel
  }
}

function resolveProjectPlatforms(
  contentLoop: PipelineContentLoopState,
  project: ContentProject,
  sourceTopic: Topic | null
): Platform[] {
  const artifactPlatforms = [
    ...contentLoop.platformPackages
      .filter((platformPackage) => platformPackage.contentProjectId === project.id)
      .map((platformPackage) => platformPackage.platform),
    ...contentLoop.publishRecords
      .filter((record) => record.contentProjectId === project.id)
      .map((record) => record.platform)
  ]

  return uniquePlatforms(artifactPlatforms.length > 0 ? artifactPlatforms : sourceTopic?.targetPlatforms ?? [])
}

function findSourceTopic(contentLoop: PipelineContentLoopState, project: ContentProject): Topic | null {
  return project.sourceTopicId
    ? contentLoop.topics.find((topic) => topic.id === project.sourceTopicId) ?? null
    : null
}

function latestPlatformPackage(platformPackages: PlatformPackage[]): PlatformPackage | null {
  return [...platformPackages].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

function latestPublishRecord(publishRecords: PublishRecord[]): PublishRecord | null {
  return [...publishRecords].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0] ?? null
}

function uniquePlatforms(platforms: Platform[]): Platform[] {
  return [...new Set(platforms)]
}

function visibleStages(stage: PipelineStageFilter): PipelineStage[] {
  return stage === "all" ? pipelineStages : [stage]
}

function statusLabelKey(stage: PipelineStage): string {
  return `pipeline.status.${stage}`
}

function formatColumnLabel(columnSlug: ContentColumnSlug): string {
  return DEFAULT_COLUMNS.find((column) => column.slug === columnSlug)?.name ?? fallbackColumnLabel
}

function isKnownColumnSlug(slug: string | undefined): slug is ContentColumnSlug {
  return Boolean(slug && knownColumnSlugs.has(slug as ContentColumnSlug))
}

function countProjectArtifacts(contentLoop: PipelineContentLoopState, projectId: string): number {
  return contentLoop.drafts.filter((draft) => draft.contentProjectId === projectId).length +
    contentLoop.platformPackages.filter((platformPackage) => platformPackage.contentProjectId === projectId).length +
    contentLoop.publishRecords.filter((record) => record.contentProjectId === projectId).length +
    contentLoop.reviewReports.filter((report) => report.contentProjectId === projectId).length +
    contentLoop.archiveRecords.filter((record) => record.contentProjectId === projectId).length +
    contentLoop.knowledgeItems.filter((item) => item.contentProjectId === projectId).length
}

function resolveProjectSecondaryActions(
  project: ContentProject,
  reviewReports: ReviewReport[]
): PipelineAction[] {
  const latestReview = [...reviewReports].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const actions: PipelineAction[] = [
    {
      kind: "archiveProject",
      labelKey: "pipeline.actions.archiveProject",
      projectId: project.id
    },
    {
      kind: "createContentLoopExport",
      labelKey: "pipeline.actions.createContentLoopExport",
      projectId: project.id
    },
    {
      kind: "importMetricCsv",
      labelKey: "pipeline.actions.importMetricCsv",
      projectId: project.id
    },
    {
      kind: "saveMetricImport",
      labelKey: "pipeline.actions.saveMetricImport",
      projectId: project.id
    }
  ]

  return latestReview ? [
    ...actions,
    {
      kind: "extractReviewKnowledge",
      labelKey: "pipeline.actions.extractReviewKnowledge",
      reviewReportId: latestReview.id
    }
  ] : actions
}
