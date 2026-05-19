import { DEFAULT_COLUMNS } from "@robert-station/core";
import type { ReactElement } from "react";

const workflowStages = [
  "Topic Pool",
  "Creation Studio",
  "Publish Assistant",
  "Data Import",
  "Review",
  "Knowledge Base"
];

export function App(): ReactElement {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">RS</div>
        <nav>
          {workflowStages.map((stage) => (
            <a href={`#${stage.toLowerCase().replaceAll(" ", "-")}`} key={stage}>
              {stage}
            </a>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Content operations workbench</p>
            <h1>Robert Station</h1>
          </div>
          <button type="button">New Project</button>
        </header>

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
                  <dd>0</dd>
                </div>
                <div>
                  <dt>Drafts</dt>
                  <dd>0</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>0</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
