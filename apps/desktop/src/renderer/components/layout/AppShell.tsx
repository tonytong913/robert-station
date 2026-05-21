import type { ReactElement } from "react"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { CreationScreen } from "../screens/CreationScreen"
import { DashboardScreen } from "../screens/DashboardScreen"
import { KnowledgeScreen } from "../screens/KnowledgeScreen"
import { PublishScreen } from "../screens/PublishScreen"
import { ReviewScreen } from "../screens/ReviewScreen"
import { TopicScreen } from "../screens/TopicScreen"
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
          {screen === "dashboard" ? <DashboardScreen /> : null}
          {screen === "topics" ? <TopicScreen /> : null}
          {screen === "creation" ? <CreationScreen /> : null}
          {screen === "publish" ? <PublishScreen /> : null}
          {screen === "review" ? <ReviewScreen /> : null}
          {screen === "knowledge" ? <KnowledgeScreen /> : null}
        </div>
      </section>
    </main>
  )
}
