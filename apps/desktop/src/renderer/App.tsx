import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import type { ReactElement } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  archivePersistedProject,
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

export function App(): ReactElement {
  const isMountedRef = useRef(false);
  const selectedPublishRecordIdRef = useRef<string | null>(null);
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

    return screen;
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
  }, [selectedPublishRecordId]);

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
        setTopicGenerationError("Could not generate topics. Try again.");
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
        setDraftPackageError("Could not generate draft package. Try again.");
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
        setPlatformPackageError("Could not generate Xiaohongshu package. Try again.");
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
        setArchiveError("Could not archive project. Try again.");
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
        setPublishRecordError("Could not save publish record. Try again.");
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
        setMetricImportError("Could not import metrics CSV. Try again.");
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
        setMetricSaveError("Could not save imported metrics. Try again.");
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
        setReviewReportError("Could not generate review report. Try again.");
      }
    } finally {
      if (isMountedRef.current && selectedPublishRecordIdRef.current === publishRecordId) {
        setIsGeneratingReviewReport(false);
      }
    }
  }

  if (!contentLoop) {
    return (
      <main className="loading-shell">
        <p>Loading content loop...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">RS</div>
        <nav>
          {workflowStages.map((stage) => (
            <button
              className={screen === stage ? "nav-button nav-button--active" : "nav-button"}
              key={stage}
              onClick={() => setScreen(stage)}
              type="button"
            >
              {stage}
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Content operations workbench</p>
            <h1>{screenTitle}</h1>
          </div>
          <div className="metric-strip" aria-label="Content loop metrics">
            <span>{candidateTopicCount} candidate topics</span>
            <span>
              {activeProjectCount} active {activeProjectCount === 1 ? "project" : "projects"}
            </span>
          </div>
        </header>

        {screen === "Dashboard" ? (
          <section className="summary-grid" aria-label="Content columns">
            {DEFAULT_COLUMNS.map((column) => (
              <article className="column-card" key={column.slug}>
                <div className="column-card__header">
                  <h2>{column.name}</h2>
                  <span>Priority {column.priority}</span>
                </div>
                <p>{column.description}</p>
                <dl>
                  <div>
                    <dt>Topics</dt>
                    <dd>{contentLoop.topics.filter((topic) => topic.columnSlug === column.slug).length}</dd>
                  </div>
                  <div>
                    <dt>Drafts</dt>
                    <dd>{contentLoop.drafts.length}</dd>
                  </div>
                  <div>
                    <dt>Published</dt>
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
                <span>Column</span>
                <select
                  aria-label="Topic column"
                  onChange={(event) => setTopicGenerationColumn(event.target.value as ContentColumnSlug)}
                  value={topicGenerationColumn}
                >
                  {DEFAULT_COLUMNS.map((column) => (
                    <option key={column.slug} value={column.slug}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={isGeneratingTopics} onClick={() => void handleGenerateTopics()} type="button">
                {isGeneratingTopics ? "Generating..." : "Generate topics"}
              </button>
              {topicGenerationError ? (
                <p className="inline-error" role="alert">
                  {topicGenerationError}
                </p>
              ) : null}
            </div>
            <section className="topic-grid" aria-label="Topic candidates">
              {contentLoop.topics.map((topic) => (
                <article aria-label={topic.title} className="topic-card" key={topic.id}>
                  <div className="topic-card__meta">
                    <span>{topic.columnSlug}</span>
                    <span>{topic.status}</span>
                  </div>
                  <h2>{topic.title}</h2>
                  <p>{topic.hook}</p>
                  <dl className="score-grid">
                    <div>
                      <dt>Heat</dt>
                      <dd>{topic.score.heat}</dd>
                    </div>
                    <div>
                      <dt>Fit</dt>
                      <dd>{topic.score.fit}</dd>
                    </div>
                    <div>
                      <dt>Difficulty</dt>
                      <dd>{topic.score.difficulty}</dd>
                    </div>
                  </dl>
                  <button disabled={topic.status === "promoted"} onClick={() => void handlePromote(topic.id)} type="button">
                    {topic.status === "promoted" ? "Promoted" : "Promote to project"}
                  </button>
                </article>
              ))}
            </section>
          </>
        ) : null}

        {screen === "Projects" ? (
          <section className="project-list" aria-label="Content projects">
            {contentLoop.projects.length === 0 ? (
              <p className="empty-state">No content projects yet. Promote a topic to start drafting.</p>
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
                  <strong>{project.status}</strong>
                </button>
              ))
            )}
          </section>
        ) : null}

        {screen === "Creation Studio" ? (
          <section className="creation-studio" aria-label="Selected project draft">
            {selectedProject && selectedDraft ? (
              <>
                <div className="creation-actions">
                  <button
                    disabled={isGeneratingDraftPackage}
                    onClick={() => void handleGenerateDraftPackage(selectedProject.id)}
                    type="button"
                  >
                    {isGeneratingDraftPackage ? "Generating..." : "Generate draft package"}
                  </button>
                  <button
                    disabled={isGeneratingPlatformPackage}
                    onClick={() => void handleGeneratePlatformPackage(selectedProject.id)}
                    type="button"
                  >
                    {isGeneratingPlatformPackage ? "Generating..." : "Generate Xiaohongshu package"}
                  </button>
                  <button
                    disabled={isArchivingProject}
                    onClick={() => void handleArchiveProject(selectedProject.id)}
                    type="button"
                  >
                    {isArchivingProject ? "Archiving..." : "Archive project"}
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
                  <p className="eyebrow">Draft v{selectedDraft.version}</p>
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
                  <h2>Sources</h2>
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
                <section className="publish-package-panel" aria-label="Xiaohongshu Package">
                  <h2>Xiaohongshu Package</h2>
                  {selectedXiaohongshuPackage ? (
                    <>
                      <section>
                        <h3>Title</h3>
                        <p>{selectedXiaohongshuPackage.title}</p>
                      </section>
                      <section>
                        <h3>Body</h3>
                        <p>{selectedXiaohongshuPackage.body}</p>
                      </section>
                      <section>
                        <h3>Tags</h3>
                        <p>{selectedXiaohongshuPackage.tags.join(" ")}</p>
                      </section>
                      <section>
                        <h3>Cover text</h3>
                        <p>{selectedXiaohongshuPackage.coverText}</p>
                      </section>
                      <section>
                        <h3>Required assets</h3>
                        <ul>
                          {selectedXiaohongshuPackage.requiredAssets.map((asset) => (
                            <li key={asset}>{asset}</li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <h3>Checks</h3>
                        <ul>
                          {selectedXiaohongshuPackage.checks.map((check) => (
                            <li key={check.name}>
                              <strong>{check.status}</strong> {check.name}: {check.message}
                            </li>
                          ))}
                        </ul>
                      </section>
                      <section className="manual-publish-panel" aria-label="Manual publish record">
                        <h3>Manual publish</h3>
                        <label>
                          <span>Published at</span>
                          <input
                            aria-label="Published at"
                            onChange={(event) => setPublishTime(event.target.value)}
                            type="datetime-local"
                            value={publishTime}
                          />
                        </label>
                        <label>
                          <span>Publish URL</span>
                          <input
                            aria-label="Publish URL"
                            onChange={(event) => setPublishUrl(event.target.value)}
                            type="url"
                            value={publishUrl}
                          />
                        </label>
                        <label>
                          <span>Publish note</span>
                          <input
                            aria-label="Publish note"
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
                          {isSavingPublishRecord ? "Saving..." : "Save publish record"}
                        </button>
                        {publishRecordError ? (
                          <p className="inline-error" role="alert">
                            {publishRecordError}
                          </p>
                        ) : null}
                        {selectedPublishRecord ? (
                          <div className="publish-record-summary">
                            <strong>Published</strong>
                            <p>{selectedPublishRecord.publishedAt}</p>
                            <p>{selectedPublishRecord.url || "No URL recorded"}</p>
                            {selectedPublishRecord.note ? <p>{selectedPublishRecord.note}</p> : null}
                            {selectedLatestMetricSnapshot ? (
                              <dl className="metric-snapshot-summary">
                                <div>
                                  <dt>Views</dt>
                                  <dd>{selectedLatestMetricSnapshot.views}</dd>
                                </div>
                                <div>
                                  <dt>Likes</dt>
                                  <dd>{selectedLatestMetricSnapshot.likes}</dd>
                                </div>
                                <div>
                                  <dt>Favorites</dt>
                                  <dd>{selectedLatestMetricSnapshot.favorites}</dd>
                                </div>
                                <div>
                                  <dt>Comments</dt>
                                  <dd>{selectedLatestMetricSnapshot.comments}</dd>
                                </div>
                                <div>
                                  <dt>Shares</dt>
                                  <dd>{selectedLatestMetricSnapshot.shares}</dd>
                                </div>
                                <div>
                                  <dt>Snapshot</dt>
                                  <dd>{selectedLatestMetricSnapshot.snapshotAt}</dd>
                                </div>
                              </dl>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedPublishRecord ? (
                          <>
                            <section className="metrics-import-panel" aria-label="Metrics import">
                              <h3>Metrics import</h3>
                              <button
                                disabled={isImportingMetrics}
                                onClick={() => void handleImportMetricCsv()}
                                type="button"
                              >
                                {isImportingMetrics ? "Importing..." : "Import metrics CSV"}
                              </button>
                              {metricImportError ? (
                                <p className="inline-error" role="alert">
                                  {metricImportError}
                                </p>
                              ) : null}
                              {contentLoop.metricImportPreview ? (
                                <div className="metric-import-preview">
                                  <p>
                                    {matchedMetricImportRows} matched {matchedMetricImportRows === 1 ? "row" : "rows"}{" "}
                                    in this import
                                  </p>
                                  <p>
                                    {invalidMetricImportRows} invalid {invalidMetricImportRows === 1 ? "row" : "rows"}
                                  </p>
                                  {matchedMetricImportPreviewRows.map((row) => (
                                    <p key={row.rowNumber}>
                                      Row {row.rowNumber}: {row.url || row.publishRecordId}
                                    </p>
                                  ))}
                                  {invalidMetricImportPreviewRows.map((row) => (
                                    <p key={row.rowNumber}>
                                      Row {row.rowNumber}: {row.error}
                                    </p>
                                  ))}
                                  {matchedMetricImportRows > 0 ? (
                                    <button
                                      disabled={isImportingMetrics || isSavingMetricImport}
                                      onClick={() => void handleSaveMetricImport()}
                                      type="button"
                                    >
                                      {isSavingMetricImport ? "Saving..." : "Save imported metrics"}
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
                            <section className="review-report-panel" aria-label="Review report">
                              <h3>Review report</h3>
                              <button
                                disabled={isGeneratingReviewReport}
                                onClick={() => void handleGenerateReviewReport(selectedPublishRecord.id)}
                                type="button"
                              >
                                {isGeneratingReviewReport ? "Generating..." : "Generate review report"}
                              </button>
                              {reviewReportError ? (
                                <p className="inline-error" role="alert">
                                  {reviewReportError}
                                </p>
                              ) : null}
                              {selectedLatestReviewReport ? (
                                <article className="review-report-card">
                                  <p className="eyebrow">Review Report v{selectedLatestReviewReport.version}</p>
                                  <p>{selectedLatestReviewReport.summary}</p>
                                  <h4>Highlights</h4>
                                  <ul>
                                    {selectedLatestReviewReport.highlights.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <h4>Underperforming signals</h4>
                                  <ul>
                                    {selectedLatestReviewReport.underperformingSignals.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <h4>Likely causes</h4>
                                  <ul>
                                    {selectedLatestReviewReport.likelyCauses.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                  <h4>Next actions</h4>
                                  <ul>
                                    {selectedLatestReviewReport.nextActions.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                </article>
                              ) : null}
                            </section>
                          </>
                        ) : null}
                      </section>
                    </>
                  ) : (
                    <p className="empty-state">No Xiaohongshu package yet.</p>
                  )}
                </section>
                <section className="archive-status-panel">
                  <h2>Archive</h2>
                  {selectedArchiveRecord ? (
                    <>
                      <strong>Archived</strong>
                      <p>{selectedArchiveRecord.summary}</p>
                    </>
                  ) : (
                    <p>Not archived yet.</p>
                  )}
                </section>
              </>
            ) : (
              <p className="empty-state">Select or promote a topic to open the first draft.</p>
            )}
          </section>
        ) : null}

        {screen === "Knowledge" ? (
          <section className="knowledge-list" aria-label="Archived knowledge">
            {contentLoop.knowledgeItems.length === 0 ? (
              <p className="empty-state">No archived knowledge yet.</p>
            ) : (
              contentLoop.knowledgeItems.map((knowledgeItem) => (
                <article className="knowledge-card" key={knowledgeItem.id}>
                  <p className="eyebrow">{knowledgeItem.columnSlug}</p>
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
