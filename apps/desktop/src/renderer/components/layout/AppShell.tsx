import type { ReactElement } from "react"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { EmptyState } from "../shared/EmptyState"
import { CreationScreen } from "../screens/CreationScreen"
import { DashboardScreen } from "../screens/DashboardScreen"
import { TopicScreen } from "../screens/TopicScreen"
import { Sidebar } from "./Sidebar"
import { WorkspaceHeader } from "./WorkspaceHeader"

export function AppShell(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen)

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <WorkspaceHeader />
        {screen === "dashboard" ? <DashboardScreen /> : null}
        {screen === "topics" ? <TopicScreen /> : null}
        {screen === "creation" ? <CreationScreen /> : null}
        {screen === "publish" ? <EmptyState title="发布" /> : null}
        {screen === "review" ? <EmptyState title="复盘" /> : null}
        {screen === "knowledge" ? <EmptyState title="知识库" /> : null}
      </main>
    </div>
  )
}
