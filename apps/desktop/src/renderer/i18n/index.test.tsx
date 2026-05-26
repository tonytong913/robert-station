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

  it("translates pipeline navigation and empty states", () => {
    expect(translate("zh", "nav.pipeline")).toBe("流水线")
    expect(translate("zh", "nav.sources")).toBe("素材库")
    expect(translate("zh", "nav.exports")).toBe("导出")
    expect(translate("zh", "pipeline.stage.readyToPublish")).toBe("待发布")
    expect(translate("zh", "pipeline.empty.candidate")).toBe("还没有候选选题。先选择栏目并生成一组选题。")
  })
})
