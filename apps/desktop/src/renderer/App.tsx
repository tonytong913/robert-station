import type { ReactElement } from "react"
import { useEffect } from "react"
import { AppShell } from "./components/layout/AppShell"
import { useTranslation } from "./i18n"
import { useContentLoopStore } from "./stores/content-loop-store"

export function App(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const isLoading = useContentLoopStore((state) => state.isLoading)
  const load = useContentLoopStore((state) => state.load)
  const t = useTranslation()

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading || !contentLoop) {
    return (
      <main className="loading-shell">
        <p>{t("app.loading")}</p>
      </main>
    )
  }

  return <AppShell />
}
