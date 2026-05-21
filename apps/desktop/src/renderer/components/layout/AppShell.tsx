import type { ReactElement } from "react"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { DashboardScreen } from "../screens/DashboardScreen"
import { Sidebar } from "./Sidebar"
import { WorkspaceHeader } from "./WorkspaceHeader"

export function AppShell(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen)

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <WorkspaceHeader />
        {screen === "dashboard" ? <DashboardScreen /> : <DashboardScreen />}
      </main>
    </div>
  )
}
