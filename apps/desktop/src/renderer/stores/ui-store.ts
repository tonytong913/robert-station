import { create } from "zustand"
import type { Locale } from "../i18n"

type UiStoreState = {
  locale: Locale
  isSidebarCollapsed: boolean
  setLocale: (locale: Locale) => void
  toggleSidebar: () => void
  reset: () => void
}

const initialState = {
  locale: "zh" as Locale,
  isSidebarCollapsed: false
}

export const useUiStore = create<UiStoreState>((set) => ({
  ...initialState,
  setLocale: (locale) => set({ locale }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  reset: () => set(initialState)
}))
