import type { ContentProjectStatus, TopicStatus } from "@robert-station/core"

const projectStatusLabels: Record<ContentProjectStatus, string> = {
  topic: "选题",
  drafting: "草稿中",
  ready_to_publish: "待发布",
  published: "已发布",
  reviewed: "已复盘",
  archived: "已归档"
}

const topicStatusLabels: Record<TopicStatus, string> = {
  candidate: "候选",
  kept: "保留",
  discarded: "已放弃",
  promoted: "已转为项目"
}

export function formatProjectStatus(status: ContentProjectStatus): string {
  return projectStatusLabels[status]
}

export function formatTopicStatus(status: TopicStatus): string {
  return topicStatusLabels[status]
}
