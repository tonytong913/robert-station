import { useCallback } from "react"
import { useUiStore } from "../stores/ui-store"
import { en } from "./locales/en"
import { zh } from "./locales/zh"

export type Locale = "zh" | "en"
export type TranslationKey = keyof typeof zh

const translations: Record<Locale, Partial<Record<TranslationKey, string>>> = { zh, en }

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text = translations[locale][key] || translations.en[key] || key

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value))
    }
  }

  return text
}

export function useTranslation(): (key: TranslationKey, params?: Record<string, string | number>) => string {
  const locale = useUiStore((state) => state.locale)

  return useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  )
}
