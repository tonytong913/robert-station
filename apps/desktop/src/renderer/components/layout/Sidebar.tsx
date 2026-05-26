import { BookOpen, Download, KanbanSquare, Library } from "lucide-react"
import type { ComponentType, ReactElement } from "react"
import type { TranslationKey } from "../../i18n"
import { useTranslation } from "../../i18n"
import type { AppScreen } from "../../stores/content-loop-store"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { useUiStore } from "../../stores/ui-store"
import { Button } from "../shared/Button"

type NavItem = {
  screen: AppScreen
  labelKey: TranslationKey
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>
}

const navItems: NavItem[] = [
  { screen: "pipeline", labelKey: "nav.pipeline", Icon: KanbanSquare },
  { screen: "sources", labelKey: "nav.sources", Icon: Library },
  { screen: "knowledge", labelKey: "nav.knowledge", Icon: BookOpen },
  { screen: "exports", labelKey: "nav.exports", Icon: Download }
]

export function Sidebar(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen)
  const setScreen = useContentLoopStore((state) => state.setScreen)
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed)
  const t = useTranslation()

  return (
    <aside className={["sidebar", isSidebarCollapsed ? "sidebar--collapsed" : ""].filter(Boolean).join(" ")}>
      <div className="brand-lockup" aria-hidden="true">
        <div className="brand-mark">RS</div>
        <span>Robert Station</span>
      </div>
      <nav aria-label="任务流" className="sidebar-nav">
        {navItems.map(({ screen: itemScreen, labelKey, Icon }) => {
          const label = t(labelKey)
          const isActive = screen === itemScreen

          return (
            <Button
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className={isActive ? "nav-button nav-button--active" : "nav-button"}
              key={itemScreen}
              onClick={() => setScreen(itemScreen)}
              variant="ghost"
            >
              <Icon aria-hidden size={18} />
              <span>{label}</span>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
