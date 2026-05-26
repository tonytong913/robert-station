import type { ReactElement } from "react"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { ExportScreen } from "../library/ExportScreen"
import { KnowledgeLibraryScreen } from "../library/KnowledgeLibraryScreen"
import { SourceLibraryScreen } from "../library/SourceLibraryScreen"
import { PipelineScreen } from "../pipeline/PipelineScreen"
import { Sidebar } from "./Sidebar"
import { WorkspaceHeader } from "./WorkspaceHeader"

export function AppShell(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen)

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <WorkspaceHeader />
        <div className="workspace-content screen-stack">
          {screen === "pipeline" ? <PipelineScreen /> : null}
          {screen === "sources" ? <SourceLibraryScreen /> : null}
          {screen === "knowledge" ? <KnowledgeLibraryScreen /> : null}
          {screen === "exports" ? <ExportScreen /> : null}
        </div>
      </section>
    </main>
  )
}
