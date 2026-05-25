import type { PersistedContentLoopState } from "@robert-station/local-store";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders the Chinese taskflow shell after loading persisted state", async () => {
    render(<App />);

    expect(screen.getByText("正在加载内容工作台...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "总览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "总览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发布" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复盘" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText("4 个候选选题")).toBeInTheDocument();
    expect(screen.getByText("0 个活跃项目")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("app-shell");
  });

  it("shows a load error with retry when persisted state fails to load", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("load failed"))
      .mockResolvedValueOnce(await window.robertStation.contentLoop.load());
    window.robertStation.contentLoop.load = load;

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("内容工作台加载失败。");
    expect(load).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "重试加载" }));

    expect(load).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: "总览" })).toBeInTheDocument();
  });
});

describe("App topic and creation screens", () => {
  it("promotes a topic through persistence API and shows its draft", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "总览" });
    fireEvent.click(screen.getByRole("button", { name: "选题" }));
    const topicCard = screen.getByRole("article", {
      name: "如何搭建个人 AI 工作站处理日常内容"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    expect(await screen.findByRole("heading", { name: "创作" })).toBeInTheDocument();
    expect(screen.getByText("1 个活跃项目")).toBeInTheDocument();
    expect(screen.getByText("简要钩子： 把分散的 AI 工具变成可复用的每日工作流。")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });

  it("generates topics for selected column from TopicScreen", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "总览" });
    fireEvent.click(screen.getByRole("button", { name: "选题" }));
    fireEvent.change(screen.getByLabelText("栏目"), { target: { value: "finance" } });
    fireEvent.click(screen.getByRole("button", { name: "生成选题" }));

    expect(
      await screen.findByRole("article", {
        name: "忙碌家庭的 30 分钟月度财务复盘"
      })
    ).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("finance");
  });

  it("shows inline error when topic generation fails", async () => {
    window.robertStation.contentLoop.generateTopics = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "总览" });
    fireEvent.click(screen.getByRole("button", { name: "选题" }));
    const generateButton = screen.getByRole("button", { name: "生成选题" });
    fireEvent.click(generateButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("选题生成失败，请重试。");
    expect(
      screen.getByRole("article", {
        name: "如何搭建个人 AI 工作站处理日常内容"
      })
    ).toBeInTheDocument();
    expect(generateButton).toBeEnabled();
  });

  it("generates a draft package for selected project", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成草稿包" }));

    expect(await screen.findByText("草稿 v2")).toBeInTheDocument();
    expect(screen.getByText("标题选项")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateDraftPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("shows inline error when draft package generation fails", async () => {
    window.robertStation.contentLoop.generateDraftPackage = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成草稿包" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("草稿包生成失败，请重试。");
    expect(screen.getByText("草稿 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成草稿包" })).toBeEnabled();
  });

  it("generates and displays a Xiaohongshu package for selected project", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));

    expect(await screen.findByRole("heading", { name: "发布" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "小红书包" })).toBeInTheDocument();
    expect(screen.getByText("标题")).toBeInTheDocument();
    expect(screen.getByText("正文")).toBeInTheDocument();
    expect(screen.getByText("标签")).toBeInTheDocument();
    expect(screen.getByText("封面文案")).toBeInTheDocument();
    expect(screen.getByText("所需素材")).toBeInTheDocument();
    expect(screen.getByText("检查项")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    );
  });

  it("switches back to an older promoted project without leaving the current task screen", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "选题" }));
    const financeTopicCard = screen.getByRole("article", {
      name: "适合家庭月度决策的简易财务看板"
    });
    fireEvent.click(within(financeTopicCard).getByRole("button", { name: "转为项目" }));
    await screen.findByRole("heading", { name: "创作" });

    expect(screen.getByText("简要钩子： 轻量复盘习惯比复杂表格更有效。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("当前项目"), {
      target: { value: "project_topic-ai-local-workstation" }
    });

    expect(screen.getByRole("heading", { name: "创作" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("如何搭建个人 AI 工作站处理日常内容");
    expect(screen.getByText("简要钩子： 把分散的 AI 工具变成可复用的每日工作流。")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_finance-family-dashboard");
  });

  it("shows inline error when Xiaohongshu package generation fails", async () => {
    window.robertStation.contentLoop.generatePlatformPackage = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("小红书包生成失败，请重试。");
    expect(screen.getByText("草稿 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成小红书包" })).toBeEnabled();
  });

  it("archives the selected project and shows archive status", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));

    expect(await screen.findAllByText("已归档")).not.toHaveLength(0);
    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("shows inline error when project archive fails", async () => {
    window.robertStation.contentLoop.archiveProject = vi.fn(async () => {
      throw new Error("archive failed");
    });

    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("项目归档失败，请重试。");
    expect(screen.getByText("草稿 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档项目" })).toBeEnabled();
  });
});

describe("App publish and review screens", () => {
  it("saves a manual publish record for the Xiaohongshu package", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));
    fireEvent.click(await screen.findByRole("button", { name: "发布" }));
    await screen.findByRole("heading", { name: "发布" });
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2026-05-19T15:30" }
    });
    fireEvent.change(screen.getByLabelText("发布链接"), {
      target: { value: "https://www.xiaohongshu.com/explore/demo" }
    });
    fireEvent.change(screen.getByLabelText("发布备注"), {
      target: { value: "Published manually after final review." }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

    expect(await screen.findAllByText("已发布")).not.toHaveLength(0);
    expect(screen.getByText("https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    expect(screen.getByText("Published manually after final review.")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.recordManualPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        platformPackageId: expect.stringContaining("xiaohongshu"),
        publishedAt: expect.stringContaining("2026-05-19"),
        url: "https://www.xiaohongshu.com/explore/demo",
        note: "Published manually after final review."
      })
    );
  });

  it("does not leak unsaved manual publish fields across Xiaohongshu packages", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));
    fireEvent.click(await screen.findByRole("button", { name: "发布" }));
    await screen.findByRole("heading", { name: "发布" });
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2026-05-19T08:45" }
    });
    fireEvent.change(screen.getByLabelText("发布链接"), {
      target: { value: "https://www.xiaohongshu.com/explore/unsaved" }
    });
    fireEvent.change(screen.getByLabelText("发布备注"), {
      target: { value: "Do not carry this draft note forward." }
    });

    fireEvent.click(screen.getByRole("button", { name: "选题" }));
    const financeTopicCard = screen.getByRole("article", {
      name: "适合家庭月度决策的简易财务看板"
    });
    fireEvent.click(within(financeTopicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));
    fireEvent.click(await screen.findByRole("button", { name: "发布" }));
    await screen.findByRole("heading", { name: "发布" });

    expect(screen.getByLabelText("发布时间")).not.toHaveValue("2026-05-19T08:45");
    expect(screen.getByLabelText("发布链接")).toHaveValue("");
    expect(screen.getByLabelText("发布备注")).toHaveValue("");
  });

  it("shows inline error and keeps package content when manual publish save fails", async () => {
    window.robertStation.contentLoop.recordManualPublish = vi.fn(async () => {
      throw new Error("publish failed");
    });

    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));
    fireEvent.click(await screen.findByRole("button", { name: "发布" }));
    await screen.findByRole("heading", { name: "发布" });
    fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("发布记录保存失败，请重试。");
    expect(screen.getByRole("heading", { name: "小红书包" })).toBeInTheDocument();
  });

  it("imports and saves metrics CSV", async () => {
    await publishXiaohongshuPackage();

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    fireEvent.click(screen.getByRole("button", { name: "导入指标 CSV" }));

    expect(await screen.findByText("本次导入匹配 1 行")).toBeInTheDocument();
    expect(screen.getByText("第 2 行：https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存导入指标" }));

    expect(await screen.findByText("浏览")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.importMetricCsv).toHaveBeenCalled();
    expect(window.robertStation.contentLoop.saveMetricImport).toHaveBeenCalled();
  });

  it("shows metrics import failure", async () => {
    window.robertStation.contentLoop.importMetricCsv = vi.fn(async () => {
      throw new Error("import failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    fireEvent.click(screen.getByRole("button", { name: "导入指标 CSV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("指标 CSV 导入失败，请重试。");
    expect(screen.getByRole("heading", { name: "小红书包" })).toBeInTheDocument();
  });

  it("shows metrics save failure", async () => {
    window.robertStation.contentLoop.saveMetricImport = vi.fn(async () => {
      throw new Error("save failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    fireEvent.click(screen.getByRole("button", { name: "导入指标 CSV" }));
    await screen.findByText("本次导入匹配 1 行");
    fireEvent.click(screen.getByRole("button", { name: "保存导入指标" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("导入指标保存失败，请重试。");
    expect(screen.getByText("本次导入匹配 1 行")).toBeInTheDocument();
  });

  it("shows every matched metric preview row that will be saved", async () => {
    await publishXiaohongshuPackage();
    await promoteAndPublishXiaohongshuPackage(
      "适合家庭月度决策的简易财务看板",
      "https://www.xiaohongshu.com/explore/finance"
    );

    const currentState = await window.robertStation.contentLoop.load();
    const demoPublishRecord = currentState.publishRecords.find(
      (record) => record.url === "https://www.xiaohongshu.com/explore/demo"
    );
    const financePublishRecord = currentState.publishRecords.find(
      (record) => record.url === "https://www.xiaohongshu.com/explore/finance"
    );
    window.robertStation.contentLoop.importMetricCsv = vi.fn(async () => ({
      ...currentState,
      metricImportPreview: {
        id: "metric-import-preview_two-records",
        sourceFileName: "metrics.csv",
        createdAt: "2026-05-20T09:00:00.000Z",
        rows: [
          {
            rowNumber: 2,
            status: "matched" as const,
            publishRecordId: demoPublishRecord?.id ?? "",
            url: "https://www.xiaohongshu.com/explore/demo",
            platform: "xiaohongshu" as const,
            publishedAt: "",
            snapshotAt: "2026-05-20T08:00:00.000Z",
            metrics: { views: 100, likes: 10, favorites: 8, comments: 3, shares: 2 },
            note: "demo"
          },
          {
            rowNumber: 3,
            status: "matched" as const,
            publishRecordId: financePublishRecord?.id ?? "",
            url: "https://www.xiaohongshu.com/explore/finance",
            platform: "xiaohongshu" as const,
            publishedAt: "",
            snapshotAt: "2026-05-20T08:05:00.000Z",
            metrics: { views: 200, likes: 20, favorites: 16, comments: 6, shares: 4 },
            note: "finance"
          }
        ]
      }
    }));

    fireEvent.click(screen.getByRole("button", { name: "发布" }));
    fireEvent.click(screen.getByRole("button", { name: "导入指标 CSV" }));

    expect(await screen.findByText("本次导入匹配 2 行")).toBeInTheDocument();
    expect(screen.getByText("第 2 行：https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    expect(screen.getByText("第 3 行：https://www.xiaohongshu.com/explore/finance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存导入指标" })).toBeEnabled();
  });

  it("generates and displays review report", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));

    expect(await screen.findByText("复盘报告 v1")).toBeInTheDocument();
    expect(screen.getByText(/生成时间 /)).toBeInTheDocument();
    expect(screen.getByText(/还没有导入指标|达到/i)).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledOnce();
  });

  it("shows review generation failure", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("复盘报告生成失败，请重试。");
    expect(screen.getByText("https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
  });

  it("extracts review knowledge after project archived and shows status", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "创作" }));
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    await screen.findAllByText("已归档");
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    await screen.findByText("复盘报告 v1");

    fireEvent.click(screen.getByRole("button", { name: "沉淀为知识" }));

    expect(await screen.findByRole("status")).toHaveTextContent("知识已沉淀");
  });

  it("shows archive-required message when extraction before archive", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    await screen.findByText("复盘报告 v1");

    fireEvent.click(screen.getByRole("button", { name: "沉淀为知识" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("请先归档项目，再沉淀复盘知识。");
  });

  it("shows extraction failure keeps review report", async () => {
    window.robertStation.contentLoop.extractReviewKnowledge = vi.fn(async () => {
      throw new Error("Extract failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "创作" }));
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    await screen.findAllByText("已归档");
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    await screen.findByText("复盘报告 v1");
    fireEvent.click(screen.getByRole("button", { name: "沉淀为知识" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("复盘知识沉淀失败，请重试。");
    expect(screen.getByText("复盘报告 v1")).toBeInTheDocument();
  });

  it("clears review generation errors when switching publish records", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("复盘报告生成失败，请重试。");

    await promoteAndPublishXiaohongshuPackage(
      "适合家庭月度决策的简易财务看板",
      "https://www.xiaohongshu.com/explore/finance"
    );
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));

    expect(screen.getByText("https://www.xiaohongshu.com/explore/finance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成复盘报告" })).toBeEnabled();
    await waitFor(() => {
      expect(screen.queryByText("复盘报告生成失败，请重试。")).not.toBeInTheDocument();
    });
  });

  it("ignores stale successful review generation after switching publish records", async () => {
    await publishXiaohongshuPackage();
    const firstSelectedState = await window.robertStation.contentLoop.load();
    const firstProject = firstSelectedState.projects.find(
      (project) => project.title === "如何搭建个人 AI 工作站处理日常内容"
    );
    const firstPublishRecord = firstSelectedState.publishRecords.find(
      (record) => record.url === "https://www.xiaohongshu.com/explore/demo"
    );
    const deferredReview = createDeferred<PersistedContentLoopState>();
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => deferredReview.promise);

    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    expect(screen.getByRole("button", { name: "生成中..." })).toBeDisabled();

    await promoteAndPublishXiaohongshuPackage(
      "适合家庭月度决策的简易财务看板",
      "https://www.xiaohongshu.com/explore/finance"
    );
    fireEvent.click(screen.getByRole("button", { name: "复盘" }));
    expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).toHaveTextContent(
      "适合家庭月度决策的简易财务看板"
    );

    deferredReview.resolve({
      ...firstSelectedState,
      selectedProjectId: firstProject?.id ?? firstSelectedState.selectedProjectId,
      reviewReports: [
        {
          id: "review-report_stale-first-record-v1",
          workspaceId: "workspace_robert-station",
          contentProjectId: firstProject?.id ?? "project_topic-ai-local-workstation",
          publishRecordId: firstPublishRecord?.id ?? "publish-record_stale-first-record",
          version: 1,
          summary: "Stale first project report summary",
          highlights: ["First stale highlight"],
          underperformingSignals: ["First stale signal"],
          likelyCauses: ["First stale cause"],
          nextActions: ["First stale action"],
          createdAt: "2026-05-20T09:00:00.000Z",
          updatedAt: "2026-05-20T09:00:00.000Z"
        }
      ]
    });

    await waitFor(() => {
      expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).toHaveTextContent(
        "适合家庭月度决策的简易财务看板"
      );
    });
    expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).not.toHaveTextContent(
      "如何搭建个人 AI 工作站处理日常内容"
    );
    expect(screen.queryByText("Stale first project report summary")).not.toBeInTheDocument();
  });
});

describe("App knowledge source library", () => {
  it("adds a source reference and creates a markdown export", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "总览" });
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "微信公众号文章导出器" }
    });
    fireEvent.change(screen.getByLabelText("链接"), {
      target: { value: "https://example.com/wechat-exporter" }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));

    expect(await screen.findByRole("article", { name: "微信公众号文章导出器" })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.addSourceReference).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "导出 Markdown" }));

    expect(await screen.findByText("最近导出：robert-station-export.md")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.createContentLoopExport).toHaveBeenCalledWith("markdown");
  });

  it("filters source references from the knowledge screen", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "总览" });
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "AI 资料库文章" }
    });
    fireEvent.change(screen.getByLabelText("链接"), {
      target: { value: "https://example.com/ai-source" }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));
    expect(await screen.findByRole("article", { name: "AI 资料库文章" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索资料"), {
      target: { value: "资料库" }
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选资料" }));

    await waitFor(() => {
      expect(window.robertStation.contentLoop.filterSourceReferences).toHaveBeenCalledWith({ query: "资料库" });
    });
    expect(screen.getByRole("article", { name: "AI 资料库文章" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "如何搭建个人 AI 工作站处理日常内容 的调研笔记" })).not.toBeInTheDocument();
  });

  it("adds rich source metadata and filters by platform and tag", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "总览" });
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "微信长文导出案例" }
    });
    fireEvent.change(screen.getByLabelText("链接"), {
      target: { value: "https://example.com/wechat-case" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "wechat_channels" }
    });
    fireEvent.change(screen.getByLabelText("作者"), {
      target: { value: "wechat-article" }
    });
    fireEvent.change(screen.getByLabelText("标签"), {
      target: { value: "导出,资料库" }
    });
    fireEvent.change(screen.getByLabelText("摘要"), {
      target: { value: "多格式导出和资源缓存值得参考。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));

    const source = await screen.findByRole("article", { name: "微信长文导出案例" });
    expect(source).toHaveTextContent("wechat_channels");
    expect(source).toHaveTextContent("wechat-article");
    expect(source).toHaveTextContent("导出");

    fireEvent.change(screen.getByLabelText("筛选平台"), {
      target: { value: "wechat_channels" }
    });
    fireEvent.change(screen.getByLabelText("筛选标签"), {
      target: { value: "资料库" }
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选资料" }));

    await waitFor(() => {
      expect(window.robertStation.contentLoop.filterSourceReferences).toHaveBeenCalledWith({
        platform: "wechat_channels",
        tag: "资料库"
      });
    });
    expect(screen.getByRole("article", { name: "微信长文导出案例" })).toBeInTheDocument();
  });
});

describe("App knowledge screen", () => {
  it("lists archived knowledge items in the Knowledge screen", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    await screen.findAllByText("已归档");
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText(/可复用经验：/)).toBeInTheDocument();
    expect(screen.getByText(/条来源引用.*个发布包/)).toBeInTheDocument();
  });
});

async function publishXiaohongshuPackage(): Promise<void> {
  render(<App />);

  await screen.findByRole("heading", { name: "总览" });
  await promoteAndPublishXiaohongshuPackage(
    "如何搭建个人 AI 工作站处理日常内容",
    "https://www.xiaohongshu.com/explore/demo"
  );
}

async function promoteAndPublishXiaohongshuPackage(topicName: string, publishUrl: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "选题" }));
  const topicCard = screen.getByRole("article", { name: topicName });
  fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

  await screen.findByRole("heading", { name: "创作" });
  fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));
  fireEvent.click(await screen.findByRole("button", { name: "发布" }));
  await screen.findByRole("heading", { name: "发布" });
  fireEvent.change(screen.getByLabelText("发布链接"), {
    target: { value: publishUrl }
  });
  fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

  await screen.findAllByText("已发布");
}

async function promoteFirstTopicToProject(): Promise<void> {
  await screen.findByRole("heading", { name: "总览" });
  fireEvent.click(screen.getByRole("button", { name: "选题" }));
  const topicCard = screen.getByRole("article", {
    name: "如何搭建个人 AI 工作站处理日常内容"
  });
  fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

  await screen.findByRole("heading", { name: "创作" });
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}
