import { BarChart3, LayoutDashboard, Library, Lightbulb, PenLine, Send } from "lucide-react"
import type { ComponentType, ReactElement } from "react"
import type { TranslationKey } from "../../i18n"
import { useTranslation } from "../../i18n"
import type { TaskScreen } from "../../stores/content-loop-store"
import { useContentLoopStore } from "../../stores/content-loop-store"
import { useUiStore } from "../../stores/ui-store"
import { Button } from "../shared/Button"

type NavItem = {
  screen: TaskScreen
  labelKey: TranslationKey
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>
}

const navItems: NavItem[] = [
  { screen: "dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { screen: "topics", labelKey: "nav.topics", Icon: Lightbulb },
  { screen: "creation", labelKey: "nav.creation", Icon: PenLine },
  { screen: "publish", labelKey: "nav.publish", Icon: Send },
  { screen: "review", labelKey: "nav.review", Icon: BarChart3 },
  { screen: "knowledge", labelKey: "nav.knowledge", Icon: Library }
]

export function Sidebar(): ReactElement {
  const screen = useContentLoopStore((state) => state.screen)
  const setScreen = useContentLoopStore((state) => state.setScreen)
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed)
  const t = useTranslation()

  return (
    <aside className={["sidebar", isSidebarCollapsed ? "sidebar--collapsed" : ""].filter(Boolean).join(" ")}>
      <div className="brand" aria-hidden="true">
        RS
      </div>
      <nav aria-label="Taskflow">
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
