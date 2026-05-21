import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import type { ReactElement } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  archivePersistedProject,
  extractPersistedReviewKnowledge,
  generatePersistedDraftPackage,
  generatePersistedPlatformPackage,
  generatePersistedReviewReport,
  generatePersistedTopics,
  importPersistedMetricCsv,
  loadPersistedContentLoop,
  promotePersistedTopic,
  recordPersistedManualPublish,
  savePersistedMetricImport
} from "./content-loop-loader";

const workflowStages = ["Dashboard", "Topic Pool", "Projects", "Creation Studio", "Knowledge"] as const;

type Screen = (typeof workflowStages)[number];
type ReviewKnowledgeResult = { kind: "success" | "blocked"; text: string };

const screenLabels: Record<Screen, string> = {
  Dashboard: "仪表盘",
  "Topic Pool": "选题池",
  Projects: "项目",
  "Creation Studio": "创作工作台",
  Knowledge: "知识库"
};

const columnLabels: Record<ContentColumnSlug, { name: string; description: string }> = {
  ai: {
    name: "AI",
    description: "AI 工具、工作流、工作站、生产力和 AI 知识科普。"
  },
  finance: {
    name: "财务",
    description: "个人财务、工具、方法和学习笔记。"
  },
  parenting: {
    name: "育儿",
    description: "育儿、家庭工作流和日常问题解决。"
  },
  fitness: {
    name: "健身",
    description: "游泳、健身训练、习惯养成、装备和计划。"
  }
};

const topicStatusLabels: Record<string, string> = {
  candidate: "候选",
  promoted: "已转为项目"
};

const projectStatusLabels: Record<string, string> = {
  topic: "选题",
  drafting: "草稿中",
  ready_to_publish: "待发布",
  published: "已发布",
  reviewed: "已复盘",
  archived: "已归档"
};

const checkStatusLabels: Record<string, string> = {
  pass: "通过",
  warning: "提醒",
  warn: "提醒",
  fail: "未通过"
};

export function App(): ReactElement {
  const isMountedRef = useRef(false);
  const selectedPublishRecordIdRef = useRef<string | null>(null);
  const selectedReviewReportIdRef = useRef<string | null>(null);
  const [screen, setScreen] = useState<Screen>("Dashboard");
  const [contentLoop, setContentLoop] = useState<PersistedContentLoopState | null>(null);
  const [topicGenerationColumn, setTopicGenerationColumn] = useState<ContentColumnSlug>("ai");
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [topicGenerationError, setTopicGenerationError] = useState<string | null>(null);
  const [isGeneratingDraftPackage, setIsGeneratingDraftPackage] = useState(false);
  const [draftPackageError, setDraftPackageError] = useState<string | null>(null);
  const [isGeneratingPlatformPackage, setIsGeneratingPlatformPackage] = useState(false);
  const [platformPackageError, setPlatformPackageError] = useState<string | null>(null);
  const [isArchivingProject, setIsArchivingProject] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [publishTime, setPublishTime] = useState(() => formatDatetimeLocalValue(new Date()));
  const [publishUrl, setPublishUrl] = useState("");
  const [publishNote, setPublishNote] = useState("");
  const [isSavingPublishRecord, setIsSavingPublishRecord] = useState(false);
  const [publishRecordError, setPublishRecordError] = useState<string | null>(null);
  const [isImportingMetrics, setIsImportingMetrics] = useState(false);
  const [isSavingMetricImport, setIsSavingMetricImport] = useState(false);
  const [metricImportError, setMetricImportError] = useState<string | null>(null);
  const [metricSaveError, setMetricSaveError] = useState<string | null>(null);
  const [isGeneratingReviewReport, setIsGeneratingReviewReport] = useState(false);
  const [reviewReportError, setReviewReportError] = useState<string | null>(null);
  const [isExtractingReviewKnowledge, setIsExtractingReviewKnowledge] = useState(false);
  const [reviewKnowledgeResult, setReviewKnowledgeResult] = useState<ReviewKnowledgeResult | null>(null);
  const [reviewKnowledgeError, setReviewKnowledgeError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    void loadPersistedContentLoop().then((state) => {
      if (isMountedRef.current) {
        setContentLoop(state);
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const screenTitle = useMemo(() => {
    if (screen === "Dashboard") {
      return "Robert Station";
    }

    return screenLabels[screen];
  }, [screen]);

  const selectedProject = contentLoop?.projects.find((project) => project.id === contentLoop.selectedProjectId) ?? null;
  const selectedDraft =
    selectedProject && contentLoop
      ? contentLoop.drafts.find((draft) => draft.contentProjectId === selectedProject.id) ?? null
      : null;
  const selectedXiaohongshuPackage =
    selectedProject && contentLoop
      ? contentLoop.platformPackages.find(
          (platformPackage) =>
            platformPackage.contentProjectId === selectedProject.id && platformPackage.platform === "xiaohongshu"
        ) ?? null
      : null;
  const selectedPublishRecord =
    selectedXiaohongshuPackage && contentLoop
      ? contentLoop.publishRecords.find((record) => record.platformPackageId === selectedXiaohongshuPackage.id) ?? null
      : null;
  const selectedMetricSnapshots =
    selectedPublishRecord && contentLoop
      ? contentLoop.metricSnapshots.filter((snapshot) => snapshot.publishRecordId === selectedPublishRecord.id)
      : [];
  const selectedLatestMetricSnapshot = selectedMetricSnapshots[0] ?? null;
  const selectedReviewReports =
    selectedPublishRecord && contentLoop
      ? contentLoop.reviewReports.filter((report) => report.publishRecordId === selectedPublishRecord.id)
      : [];
  const selectedLatestReviewReport = selectedReviewReports[0] ?? null;
  const matchedMetricImportPreviewRows =
    contentLoop?.metricImportPreview?.rows.filter((row) => row.status === "matched") ?? [];
  const invalidMetricImportPreviewRows =
    contentLoop?.metricImportPreview?.rows.filter((row) => row.status === "invalid") ?? [];
  const matchedMetricImportRows = matchedMetricImportPreviewRows.length;
  const invalidMetricImportRows = invalidMetricImportPreviewRows.length;
  const selectedArchiveRecord =
    selectedProject && contentLoop
      ? contentLoop.archiveRecords.find((archiveRecord) => archiveRecord.contentProjectId === selectedProject.id) ?? null
      : null;
  const selectedXiaohongshuPackageId = selectedXiaohongshuPackage?.id ?? null;
  const selectedPublishRecordPublishedAt = selectedPublishRecord?.publishedAt ?? "";
  const selectedPublishRecordUrl = selectedPublishRecord?.url ?? "";
  const selectedPublishRecordNote = selectedPublishRecord?.note ?? "";
  const selectedPublishRecordId = selectedPublishRecord?.id ?? null;
  const candidateTopicCount = contentLoop?.topics.filter((topic) => topic.status === "candidate").length ?? 0;
  const activeProjectCount = contentLoop?.projects.length ?? 0;

  useLayoutEffect(() => {
    if (!selectedXiaohongshuPackageId) {
      setPublishTime(formatDatetimeLocalValue(new Date()));
      setPublishUrl("");
      setPublishNote("");
      return;
    }

    setPublishTime(
      selectedPublishRecordPublishedAt ? toDatetimeLocalValue(selectedPublishRecordPublishedAt) : formatDatetimeLocalValue(new Date())
    );
    setPublishUrl(selectedPublishRecordUrl);
    setPublishNote(selectedPublishRecordNote);
  }, [
    selectedPublishRecordNote,
    selectedPublishRecordPublishedAt,
    selectedPublishRecordUrl,
    selectedXiaohongshuPackageId
  ]);

  useEffect(() => {
    selectedPublishRecordIdRef.current = selectedPublishRecordId;
    setIsGeneratingReviewReport(false);
    setReviewReportError(null);
    setIsExtractingReviewKnowledge(false);
    setReviewKnowledgeResult(null);
    setReviewKnowledgeError(null);
  }, [selectedPublishRecordId]);

  useEffect(() => {
    selectedReviewReportIdRef.current = selectedLatestReviewReport?.id ?? null;
  }, [selectedLatestReviewReport?.id]);

  async function handlePromote(topicId: string): Promise<void> {
    const nextState = await promotePersistedTopic(topicId);
    if (isMountedRef.current) {
      setContentLoop(nextState);
      setScreen("Creation Studio");
    }
  }

  async function handleGenerateTopics(): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsGeneratingTopics(true);
    setTopicGenerationError(null);

    try {
      const nextState = await generatePersistedTopics(topicGenerationColumn);
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setTopicGenerationError("无法生成选题，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingTopics(false);
      }
    }
  }

  async function handleGenerateDraftPackage(projectId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsGeneratingDraftPackage(true);
    setDraftPackageError(null);

    try {
      const nextState = await generatePersistedDraftPackage(projectId);
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setDraftPackageError("无法生成草稿包，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingDraftPackage(false);
      }
    }
  }

  async function handleGeneratePlatformPackage(projectId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsGeneratingPlatformPackage(true);
    setPlatformPackageError(null);

    try {
      const nextState = await generatePersistedPlatformPackage(projectId, "xiaohongshu");
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setPlatformPackageError("无法生成小红书发布包，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingPlatformPackage(false);
      }
    }
  }

  async function handleArchiveProject(projectId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsArchivingProject(true);
    setArchiveError(null);

    try {
      const nextState = await archivePersistedProject(projectId);
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setArchiveError("无法归档项目，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsArchivingProject(false);
      }
    }
  }

  async function handleRecordManualPublish(platformPackageId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsSavingPublishRecord(true);
    setPublishRecordError(null);

    try {
      const nextState = await recordPersistedManualPublish({
        platformPackageId,
        publishedAt: toPublishTimestamp(publishTime),
        url: publishUrl,
        note: publishNote
      });
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setPublishRecordError("无法保存发布记录，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsSavingPublishRecord(false);
      }
    }
  }

  async function handleImportMetricCsv(): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsImportingMetrics(true);
    setMetricImportError(null);
    setMetricSaveError(null);

    try {
      const nextState = await importPersistedMetricCsv();
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setMetricImportError("无法导入数据 CSV，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsImportingMetrics(false);
      }
    }
  }

  async function handleSaveMetricImport(): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsSavingMetricImport(true);
    setMetricSaveError(null);

    try {
      const nextState = await savePersistedMetricImport();
      if (isMountedRef.current) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current) {
        setMetricSaveError("无法保存导入数据，请重试。");
      }
    } finally {
      if (isMountedRef.current) {
        setIsSavingMetricImport(false);
      }
    }
  }

  async function handleGenerateReviewReport(publishRecordId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsGeneratingReviewReport(true);
    setReviewReportError(null);

    try {
      const nextState = await generatePersistedReviewReport(publishRecordId);
      if (isMountedRef.current && selectedPublishRecordIdRef.current === publishRecordId) {
        setContentLoop(nextState);
      }
    } catch {
      if (isMountedRef.current && selectedPublishRecordIdRef.current === publishRecordId) {
        setReviewReportError("无法生成复盘报告，请重试。");
      }
    } finally {
      if (isMountedRef.current && selectedPublishRecordIdRef.current === publishRecordId) {
        setIsGeneratingReviewReport(false);
      }
    }
  }

  async function handleExtractReviewKnowledge(reviewReportId: string): Promise<void> {
    if (!isMountedRef.current) {
      return;
    }

    setIsExtractingReviewKnowledge(true);
    setReviewKnowledgeResult(null);
    setReviewKnowledgeError(null);

    try {
      const nextState = await extractPersistedReviewKnowledge(reviewReportId);
      if (isMountedRef.current && selectedReviewReportIdRef.current === reviewReportId) {
        const reportProjectId =
          nextState.reviewReports.find((report) => report.id === reviewReportId)?.contentProjectId ?? null;
        const hasReviewKnowledge = nextState.knowledgeItems.some(
          (item) =>
            item.contentProjectId === reportProjectId &&
            item.tags.includes("review") &&
            item.tags.includes("performance")
        );
        setContentLoop(nextState);
        setReviewKnowledgeResult(
          hasReviewKnowledge
            ? { kind: "success", text: "知识已提取" }
            : { kind: "blocked", text: "请先归档该项目，再提取复盘知识。" }
        );
      }
    } catch {
      if (isMountedRef.current && selectedReviewReportIdRef.current === reviewReportId) {
        setReviewKnowledgeError("无法提取复盘知识，请重试。");
      }
    } finally {
      if (isMountedRef.current && selectedReviewReportIdRef.current === reviewReportId) {
        setIsExtractingReviewKnowledge(false);
      }
    }
  }

  if (!contentLoop) {
    return (
      <main className="loading-shell">
        <p>加载内容工作流...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">RS</div>
        <nav>
          {workflowStages.map((stage) => (
            <button
              className={screen === stage ? "nav-button nav-button--active" : "nav-button"}
              key={stage}
              onClick={() => setScreen(stage)}
              type="button"
            >
              {screenLabels[stage]}
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">内容运营工作台</p>
            <h1>{screenTitle}</h1>
          </div>
          <div className="metric-strip" aria-label="内容工作流指标">
            <span>{candidateTopicCount} 个候选选题</span>
            <span>{activeProjectCount} 个进行中项目</span>
          </div>
        </header>

        {screen === "Dashboard" ? (
          <section className="summary-grid" aria-label="内容栏目">
            {DEFAULT_COLUMNS.map((column) => (
              <article className="column-card" key={column.slug}>
                <div className="column-card__header">
                  <h2>{columnLabels[column.slug].name}</h2>
                  <span>优先级 {column.priority}</span>
                </div>
                <p>{columnLabels[column.slug].description}</p>
                <dl>
                  <div>
                    <dt>选题</dt>
                    <dd>{contentLoop.topics.filter((topic) => topic.columnSlug === column.slug).length}</dd>
                  </div>
                  <div>
                    <dt>草稿</dt>
                    <dd>{contentLoop.drafts.length}</dd>
                  </div>
                  <div>
                    <dt>已发布</dt>
                    <dd>0</dd>
                  </div>
                </dl>
              </article>
            ))}
          </section>
        ) : null}

        {screen === "Topic Pool" ? (
          <>
            <div className="topic-toolbar">
              <label>
                <span>栏目</span>
                <select
                  aria-label="选题栏目"
                  onChange={(event) => setTopicGenerationColumn(event.target.value as ContentColumnSlug)}
                  value={topicGenerationColumn}
                >
                  {DEFAULT_COLUMNS.map((column) => (
                    <option key={column.slug} value={column.slug}>
                      {columnLabels[column.slug].name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={isGeneratingTopics} onClick={() => void handleGenerateTopics()} type="button">
                {isGeneratingTopics ? "生成中..." : "生成选题"}
              </button>
              {topicGenerationError ? (
                <p className="inline-error" role="alert">
                  {topicGenerationError}
                </p>
              ) : null}
            </div>
            <section className="topic-grid" aria-label="候选选题">
              {contentLoop.topics.map((topic) => (
                <article aria-label={topic.title} className="topic-card" key={topic.id}>
                  <div className="topic-card__meta">
                    <span>{columnLabels[topic.columnSlug].name}</span>
                    <span>{topicStatusLabels[topic.status] ?? topic.status}</span>
                  </div>
                  <h2>{topic.title}</h2>
                  <p>{topic.hook}</p>
                  <dl className="score-grid">
                    <div>
                      <dt>热度</dt>
                      <dd>{topic.score.heat}</dd>
                    </div>
                    <div>
                      <dt>匹配度</dt>
                      <dd>{topic.score.fit}</dd>
                    </div>
                    <div>
                      <dt>难度</dt>
                      <dd>{topic.score.difficulty}</dd>
                    </div>
                  </dl>
                  <button disabled={topic.status === "promoted"} onClick={() => void handlePromote(topic.id)} type="button">
                    {topic.status === "promoted" ? "已转为项目" : "转为项目"}
                  </button>
                </article>
              ))}
            </section>
          </>
        ) : null}

        {screen === "Projects" ? (
          <section className="project-list" aria-label="内容项目">
            {contentLoop.projects.length === 0 ? (
              <p className="empty-state">暂无内容项目。先将选题转为项目开始写作。</p>
            ) : (
              contentLoop.projects.map((project) => (
                <button
                  className="project-row"
                  key={project.id}
                  onClick={() => {
                    setContentLoop((current) => (current ? { ...current, selectedProjectId: project.id } : current));
                    setScreen("Creation Studio");
                  }}
                  type="button"
                >
                  <span>{project.title}</span>
                  <strong>{projectStatusLabels[project.status] ?? project.status}</strong>
                </button>
              ))
            )}
          </section>
        ) : null}

        {screen === "Creation Studio" ? (
          <section className="creation-studio" aria-label="当前项目草稿">
            {selectedProject && selectedDraft ? (
              <>
                <div className="creation-actions">
                  <button
                    disabled={isGeneratingDraftPackage}
                    onClick={() => void handleGenerateDraftPackage(selectedProject.id)}
                    type="button"
                  >
                    {isGeneratingDraftPackage ? "生成中..." : "生成草稿包"}
                  </button>
                  <button
                    disabled={isGeneratingPlatformPackage}
                    onClick={() => void handleGeneratePlatformPackage(selectedProject.id)}
                    type="button"
                  >
                    {isGeneratingPlatformPackage ? "生成中..." : "生成小红书发布包"}
                  </button>
                  <button
                    disabled={isArchivingProject}
                    onClick={() => void handleArchiveProject(selectedProject.id)}
                    type="button"
                  >
                    {isArchivingProject ? "归档中..." : "归档项目"}
                  </button>
                  {draftPackageError ? (
                    <p className="inline-error" role="alert">
                      {draftPackageError}
                    </p>
                  ) : null}
                  {platformPackageError ? (
                    <p className="inline-error" role="alert">
                      {platformPackageError}
                    </p>
                  ) : null}
                  {archiveError ? (
                    <p className="inline-error" role="alert">
                      {archiveError}
                    </p>
                  ) : null}
                </div>
                <div className="draft-panel">
                  <p className="eyebrow">草稿 v{selectedDraft.version}</p>
                  <h2>{selectedDraft.title}</h2>
                  {selectedDraft.body.split("\n\n").map((block) => {
                    const [firstLine, ...rest] = block.split("\n");
                    const sectionTitle = firstLine ?? "";
                    const isSection = rest.length > 0 && /^[A-Z][A-Za-z ]+$/.test(sectionTitle);

                    if (isSection) {
                      return (
                        <section className="draft-section" key={block}>
                          <h3>{sectionTitle}</h3>
                          {rest.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </section>
                      );
                    }

                    return <p key={block}>{block}</p>;
                  })}
                </div>
                <aside className="source-panel">
                  <h2>来源</h2>
                  {contentLoop.sourceReferences
                    .filter(
                      (source) =>
                        source.topicId === selectedProject.sourceTopicId || source.contentProjectId === selectedProject.id
                    )
                    .map((source) => (
                      <article key={source.id}>
                        <h3>{source.title}</h3>
                        <p>{source.note}</p>
                      </article>
                    ))}
                </aside>
                <section className="publish-package-panel" aria-label="小红书发布包">
                  <h2>小红书发布包</h2>
                  {selectedXiaohongshuPackage ? (
                    <>
                      <section>
                        <h3>标题</h3>
                        <p>{selectedXiaohongshuPackage.title}</p>
                      </section>
                      <section>
                        <h3>正文</h3>
                        <p>{selectedXiaohongshuPackage.body}</p>
                      </section>
                      <section>
                        <h3>标签</h3>
                        <p>{selectedXiaohongshuPackage.tags.join(" ")}</p>
                      </section>
                      <section>
                        <h3>封面文案</h3>
                        <p>{selectedXiaohongshuPackage.coverText}</p>
                      </section>
                      <section>
                        <h3>所需素材</h3>
                        <ul>
                          {selectedXiaohongshuPackage.requiredAssets.map((asset) => (
                            <li key={asset}>{asset}</li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <h3>检查项</h3>
                        <ul>
                          {selectedXiaohongshuPackage.checks.map((check) => (
                            <li key={check.name}>
                              <strong>{checkStatusLabels[check.status] ?? check.status}</strong> {check.name}:{" "}
                              {check.message}
                            </li>
                          ))}
                        </ul>
                      </section>
                      <section className="manual-publish-panel" aria-label="手动发布记录">
                        <h3>手动发布</h3>
                        <label>
                          <span>发布时间</span>
                          <input
                            aria-label="发布时间"
                            onChange={(event) => setPublishTime(event.target.value)}
                            type="datetime-local"
                            value={publishTime}
                          />
                        </label>
                        <label>
                          <span>发布链接</span>
                          <input
                            aria-label="发布链接"
                            onChange={(event) => setPublishUrl(event.target.value)}
                            type="url"
                            value={publishUrl}
                          />
                        </label>
                        <label>
                          <span>发布备注</span>
                          <input
                            aria-label="发布备注"
                            onChange={(event) => setPublishNote(event.target.value)}
                            type="text"
                            value={publishNote}
                          />
                        </label>
                        <button
                          disabled={isSavingPublishRecord}
                          onClick={() => void handleRecordManualPublish(selectedXiaohongshuPackage.id)}
                          type="button"
                        >
                          {isSavingPublishRecord ? "保存中..." : "保存发布记录"}
                        </button>
                        {publishRecordError ? (
                          <p className="inline-error" role="alert">
                            {publishRecordError}
                          </p>
                        ) : null}
                        {selectedPublishRecord ? (
                          <div className="publish-record-summary">
                            <strong>已发布</strong>
                            <p>{selectedPublishRecord.publishedAt}</p>
                            <p>{selectedPublishRecord.url || "未记录链接"}</p>
                            {selectedPublishRecord.note ? <p>{selectedPublishRecord.note}</p> : null}
                            {selectedLatestMetricSnapshot ? (
                              <dl className="metric-snapshot-summary">
                                <div>
                                  <dt>浏览</dt>
                                  <dd>{selectedLatestMetricSnapshot.views}</dd>
                                </div>
                                <div>
                                  <dt>点赞</dt>
                                  <dd>{selectedLatestMetricSnapshot.likes}</dd>
                                </div>
                                <div>
                                  <dt>收藏</dt>
                                  <dd>{selectedLatestMetricSnapshot.favorites}</dd>
                                </div>
                                <div>
                                  <dt>评论</dt>
                                  <dd>{selectedLatestMetricSnapshot.comments}</dd>
                                </div>
                                <div>
                                  <dt>分享</dt>
                                  <dd>{selectedLatestMetricSnapshot.shares}</dd>
                                </div>
                                <div>
                                  <dt>快照时间</dt>
                                  <dd>{selectedLatestMetricSnapshot.snapshotAt}</dd>
                                </div>
                              </dl>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedPublishRecord ? (
                          <>
                            <section className="metrics-import-panel" aria-label="数据导入">
                              <h3>数据导入</h3>
                              <button
                                disabled={isImportingMetrics}
                                onClick={() => void handleImportMetricCsv()}
                                type="button"
                              >
                                {isImportingMetrics ? "导入中..." : "导入数据 CSV"}
                              </button>
                              {metricImportError ? (
                                <p className="inline-error" role="alert">
                                  {metricImportError}
                                </p>
                              ) : null}
                              {contentLoop.metricImportPreview ? (
                                <div className="metric-import-preview">
                                  <p>
                                    {matchedMetricImportRows} 行匹配记录
                                  </p>
                                  <p>{invalidMetricImportRows} 行无效记录</p>
                                  {matchedMetricImportPreviewRows.map((row) => (
                                    <p key={row.rowNumber}>
                                      第 {row.rowNumber}: {row.url || row.publishRecordId}
                                    </p>
                                  ))}
                                  {invalidMetricImportPreviewRows.map((row) => (
                                    <p key={row.rowNumber}>
                                      第 {row.rowNumber}: {row.error}
                                    </p>
                                  ))}
                                  {matchedMetricImportRows > 0 ? (
                                    <button
                                      disabled={isImportingMetrics || isSavingMetricImport}
                                      onClick={() => void handleSaveMetricImport()}
                                      type="button"
                                    >
                                      {isSavingMetricImport ? "保存中..." : "保存导入数据"}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                              {metricSaveError ? (
                                <p className="inline-error" role="alert">
                                  {metricSaveError}
                                </p>
                              ) : null}
                            </section>
                            <section className="review-report-panel" aria-label="复盘报告">
                              <h3>复盘报告</h3>
                              <button
                                disabled={isGeneratingReviewReport}
                                onClick={() => void handleGenerateReviewReport(selectedPublishRecord.id)}
                                type="button"
                              >
                                {isGeneratingReviewReport ? "生成中..." : "生成复盘报告"}
                              </button>
                              {reviewReportError ? (
                                <p className="inline-error" role="alert">
                                  {reviewReportError}
                                </p>
                              ) : null}
                              {selectedLatestReviewReport ? (
                                <article className="review-report-card">
                                  <p className="eyebrow">复盘报告 v{selectedLatestReviewReport.version}</p>
                                  <p>生成时间 {selectedLatestReviewReport.createdAt}</p>
                                  <p>{selectedLatestReviewReport.summary}</p>
                                  <h4>亮点</h4>
                                  <ul>
                                    {selectedLatestReviewReport.highlights.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <h4>表现不足信号</h4>
                                  <ul>
                                    {selectedLatestReviewReport.underperformingSignals.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <h4>可能原因</h4>
                                  <ul>
                                    {selectedLatestReviewReport.likelyCauses.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <h4>下一步行动</h4>
                                  <ul>
                                    {selectedLatestReviewReport.nextActions.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <button
                                    disabled={isExtractingReviewKnowledge}
                                    onClick={() => void handleExtractReviewKnowledge(selectedLatestReviewReport.id)}
                                    type="button"
                                  >
                                    {isExtractingReviewKnowledge ? "提取中..." : "提取知识"}
                                  </button>
                                  {reviewKnowledgeResult?.kind === "success" ? (
                                    <p role="status">{reviewKnowledgeResult.text}</p>
                                  ) : null}
                                  {reviewKnowledgeResult?.kind === "blocked" ? (
                                    <p className="inline-error" role="alert">
                                      {reviewKnowledgeResult.text}
                                    </p>
                                  ) : null}
                                  {reviewKnowledgeError ? (
                                    <p className="inline-error" role="alert">
                                      {reviewKnowledgeError}
                                    </p>
                                  ) : null}
                                </article>
                              ) : null}
                            </section>
                          </>
                        ) : null}
                      </section>
                    </>
                  ) : (
                    <p className="empty-state">暂无小红书发布包。</p>
                  )}
                </section>
                <section className="archive-status-panel">
                  <h2>归档</h2>
                  {selectedArchiveRecord ? (
                    <>
                      <strong>已归档</strong>
                      <p>{selectedArchiveRecord.summary}</p>
                    </>
                  ) : (
                    <p>尚未归档。</p>
                  )}
                </section>
              </>
            ) : (
              <p className="empty-state">选择或转化一个选题以打开第一版草稿。</p>
            )}
          </section>
        ) : null}

        {screen === "Knowledge" ? (
          <section className="knowledge-list" aria-label="已归档知识">
            {contentLoop.knowledgeItems.length === 0 ? (
              <p className="empty-state">暂无归档知识。</p>
            ) : (
              contentLoop.knowledgeItems.map((knowledgeItem) => (
                <article className="knowledge-card" key={knowledgeItem.id}>
                  <p className="eyebrow">{columnLabels[knowledgeItem.columnSlug].name}</p>
                  <h2>{knowledgeItem.title}</h2>
                  <p>{knowledgeItem.tags.join(" ")}</p>
                  <p>{knowledgeItem.lesson}</p>
                  <p>{knowledgeItem.evidence}</p>
                </article>
              ))
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function formatDatetimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDatetimeLocalValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatDatetimeLocalValue(new Date());
  }

  return formatDatetimeLocalValue(date);
}

function toPublishTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}
