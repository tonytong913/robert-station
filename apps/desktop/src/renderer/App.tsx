import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  generatePersistedDraftPackage,
  generatePersistedTopics,
  loadPersistedContentLoop,
  promotePersistedTopic
} from "./content-loop-loader";

const workflowStages = ["Dashboard", "Topic Pool", "Projects", "Creation Studio"] as const;

type Screen = (typeof workflowStages)[number];

export function App(): ReactElement {
  const isMountedRef = useRef(false);
  const [screen, setScreen] = useState<Screen>("Dashboard");
  const [contentLoop, setContentLoop] = useState<PersistedContentLoopState | null>(null);
  const [topicGenerationColumn, setTopicGenerationColumn] = useState<ContentColumnSlug>("ai");
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [topicGenerationError, setTopicGenerationError] = useState<string | null>(null);
  const [isGeneratingDraftPackage, setIsGeneratingDraftPackage] = useState(false);
  const [draftPackageError, setDraftPackageError] = useState<string | null>(null);

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

  if (!contentLoop) {
    return (
      <main className="loading-shell">
        <p>Loading content loop...</p>
      </main>
    );
  }

  const selectedProject = contentLoop.projects.find((project) => project.id === contentLoop.selectedProjectId) ?? null;
  const selectedDraft = selectedProject
    ? contentLoop.drafts.find((draft) => draft.contentProjectId === selectedProject.id) ?? null
    : null;
  const candidateTopicCount = contentLoop.topics.filter((topic) => topic.status === "candidate").length;
  const activeProjectCount = contentLoop.projects.length;

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
                  {draftPackageError ? (
                    <p className="inline-error" role="alert">
                      {draftPackageError}
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
              </>
            ) : (
              <p className="empty-state">Select or promote a topic to open the first draft.</p>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
