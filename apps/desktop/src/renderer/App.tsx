import type { ReactElement } from "react"
import { useEffect } from "react"
import { AppShell } from "./components/layout/AppShell"
import { useTranslation } from "./i18n"
import { useContentLoopStore } from "./stores/content-loop-store"

export function App(): ReactElement {
  const contentLoop = useContentLoopStore((state) => state.contentLoop)
  const isLoading = useContentLoopStore((state) => state.isLoading)
  const loadErrorKey = useContentLoopStore((state) => state.loadErrorKey)
  const load = useContentLoopStore((state) => state.load)
  const t = useTranslation()

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return (
      <main className="loading-shell">
        <p>{t("app.loading")}</p>
      </main>
    )
  }

  if (!contentLoop) {
    return (
      <main className="loading-shell">
        <section aria-live="polite">
          <p role="alert">{loadErrorKey ? "内容工作台加载失败。" : t("app.loading")}</p>
          <button onClick={() => void load()} type="button">
            重试加载
          </button>
        </section>
      </main>
    )
  }

  return <AppShell />
}
