import type {
  ContentColumnSlug,
  ContentProject,
  DraftVersion,
  Platform,
  PlatformPackage,
  PublishRecord,
  ReviewReport,
  Topic
} from "@robert-station/core"
import type { PersistedContentLoopState } from "@robert-station/local-store"

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

export type PipelineAction =
  | {
      kind: "promoteTopic"
      labelKey: "topics.promote"
    }
  | {
      kind: "generateDraft"
      labelKey: "pipeline.actions.generateDraft"
      projectId?: string
    }
  | {
      kind: "generatePlatformPackage"
      labelKey: "pipeline.actions.generatePlatformPackage"
      projectId?: string
    }
  | {
      kind: "recordPublish"
      labelKey: "pipeline.actions.recordPublish"
      platformPackageId?: string
    }
  | {
      kind: "generateReview"
      labelKey: "pipeline.actions.generateReview"
      publishRecordId?: string
    }
  | {
      kind: "archiveProject"
      labelKey: "pipeline.actions.archiveProject"
      projectId?: string
    }

export interface PipelineCardViewModel {
  id: string
  title: string
  description: string
  stage: PipelineStage
  columnSlug: ContentColumnSlug
  platforms: Platform[]
  item: PipelineItem
}

export interface PipelineColumnViewModel {
  stage: PipelineStage
  titleKey: string
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
  title: string
  description: string
  stage: PipelineStage
  columnSlug: ContentColumnSlug
  platforms: Platform[]
  primaryAction: PipelineAction | null
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

export function buildPipelineColumns(
  contentLoop: PersistedContentLoopState,
  filters: PipelineFilters
): PipelineColumnViewModel[] {
  const cards = [
    ...contentLoop.topics
      .filter((topic) => isPipelineTopic(topic, contentLoop.projects))
      .map((topic) => buildTopicCard(topic)),
    ...contentLoop.projects.map((project) => buildProjectCard(contentLoop, project))
  ].filter((card) => matchesFilters(contentLoop, card, filters))

  const stages = filters.stage === "all" ? pipelineStages : [filters.stage]

  return stages.map((stage) => ({
    stage,
    titleKey: `pipeline.stage.${stage}`,
    items: cards.filter((card) => card.stage === stage)
  }))
}

export function resolvePipelineDetail(
  contentLoop: PersistedContentLoopState,
  item: PipelineItem
): PipelineDetailViewModel | null {
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
  return {
    id: topic.id,
    title: topic.title,
    description: topic.hook,
    stage: "candidate",
    columnSlug: topic.columnSlug,
    platforms: topic.targetPlatforms,
    item: {
      kind: "topic",
      stage: "candidate",
      topicId: topic.id
    }
  }
}

function buildProjectCard(
  contentLoop: PersistedContentLoopState,
  project: ContentProject
): PipelineCardViewModel {
  const sourceTopic = findSourceTopic(contentLoop, project)
  const stage = resolveProjectStage(contentLoop, project)

  return {
    id: project.id,
    title: project.title,
    description: sourceTopic?.hook ?? project.status,
    stage,
    columnSlug: resolveProjectColumnSlug(project, sourceTopic),
    platforms: resolveProjectPlatforms(contentLoop, project, sourceTopic),
    item: {
      kind: "project",
      stage,
      projectId: project.id
    }
  }
}

function resolveProjectStage(
  contentLoop: PersistedContentLoopState,
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
  contentLoop: PersistedContentLoopState,
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
  contentLoop: PersistedContentLoopState,
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

function searchableText(contentLoop: PersistedContentLoopState, card: PipelineCardViewModel): string {
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
  return {
    id: topic.id,
    title: topic.title,
    description: topic.hook,
    stage: "candidate",
    columnSlug: topic.columnSlug,
    platforms: topic.targetPlatforms,
    primaryAction: {
      kind: "promoteTopic",
      labelKey: "topics.promote"
    },
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
  contentLoop: PersistedContentLoopState,
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

  return {
    id: project.id,
    title: project.title,
    description: sourceTopic?.hook ?? project.status,
    stage,
    columnSlug: resolveProjectColumnSlug(project, sourceTopic),
    platforms: resolveProjectPlatforms(contentLoop, project, sourceTopic),
    primaryAction: resolveProjectPrimaryAction(stage, project, platformPackages, publishRecords),
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
      { labelKey: "pipeline.detail.updatedAt", value: report.updatedAt }
    ]
  }))
}

function buildArchiveSections(
  archiveRecords: PersistedContentLoopState["archiveRecords"]
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
      kind: "generateDraft",
      labelKey: "pipeline.actions.generateDraft",
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
      kind: "recordPublish",
      labelKey: "pipeline.actions.recordPublish",
      platformPackageId: platformPackage.id
    } : null
  }

  if (stage === "published") {
    const publishRecord = latestPublishRecord(publishRecords)

    return publishRecord ? {
      kind: "generateReview",
      labelKey: "pipeline.actions.generateReview",
      publishRecordId: publishRecord.id
    } : null
  }

  return null
}

function resolveProjectColumnSlug(project: ContentProject, sourceTopic: Topic | null): ContentColumnSlug {
  if (sourceTopic) {
    return sourceTopic.columnSlug
  }

  return project.primaryColumnId.replace("column_", "") as ContentColumnSlug
}

function resolveProjectPlatforms(
  contentLoop: PersistedContentLoopState,
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

function findSourceTopic(contentLoop: PersistedContentLoopState, project: ContentProject): Topic | null {
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
