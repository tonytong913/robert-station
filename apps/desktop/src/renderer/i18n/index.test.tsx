import { describe, expect, it } from "vitest"
import { translate } from "./index"

describe("renderer i18n", () => {
  it("uses Simplified Chinese text and interpolates params", () => {
    expect(translate("zh", "app.title")).toBe("Robert Station")
    expect(translate("zh", "metrics.candidateTopics", { count: 4 })).toBe("4 个候选选题")
  })

  it("falls back to English and then the key when a locale is missing a value", () => {
    expect(translate("zh", "app.fallbackSmoke")).toBe("Fallback smoke")
    expect(translate("zh", "missing.translation.key" as never)).toBe("missing.translation.key")
  })
})
