import type { PersistedContentLoopState } from "@robert-station/local-store";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders dashboard counts and equal-priority columns after loading persisted state", async () => {
    render(<App />);

    expect(screen.getByText("加载内容工作流...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("4 个候选选题")).toBeInTheDocument();
    expect(screen.getByText("0 个进行中项目")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("财务")).toBeInTheDocument();
    expect(screen.getByText("育儿")).toBeInTheDocument();
    expect(screen.getByText("健身")).toBeInTheDocument();
  });

  it("promotes a topic through persistence API and shows its draft", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    expect(await screen.findByRole("heading", { name: "创作工作台" })).toBeInTheDocument();
    expect(screen.getByText("1 个进行中项目")).toBeInTheDocument();
    expect(screen.getByText("Brief hook: Turn scattered AI tools into one repeatable daily workflow.")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });

  it("generates topics for selected column from 选题池", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    fireEvent.change(screen.getByLabelText("选题栏目"), { target: { value: "finance" } });
    fireEvent.click(screen.getByRole("button", { name: "生成选题" }));

    expect(
      await screen.findByRole("article", {
        name: "A 30-minute monthly money review for busy families"
      })
    ).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("finance");
  });

  it("shows inline error when topic generation fails", async () => {
    window.robertStation.contentLoop.generateTopics = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const generateButton = screen.getByRole("button", { name: "生成选题" });
    fireEvent.click(generateButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("无法生成选题，请重试。");
    expect(
      screen.getByRole("article", {
        name: "How to build a personal AI workstation for daily content work"
      })
    ).toBeInTheDocument();
    expect(generateButton).toBeEnabled();
  });

  it("generates a draft package for the selected project", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成草稿包" }));

    expect(await screen.findByText("草稿 v2")).toBeInTheDocument();
    expect(screen.getByText("Title Options")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateDraftPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("shows an inline error and keeps the current draft when draft package generation fails", async () => {
    window.robertStation.contentLoop.generateDraftPackage = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成草稿包" }));

    expect(await screen.findByText("无法生成草稿包，请重试。")).toBeInTheDocument();
    expect(screen.getByText("草稿 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成草稿包" })).toBeEnabled();
  });

  it("generates and displays a Xiaohongshu package for the selected project", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));

    expect(await screen.findByRole("heading", { name: "小红书发布包" })).toBeInTheDocument();
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

  it("shows an inline error and keeps current content when Xiaohongshu package generation fails", async () => {
    window.robertStation.contentLoop.generatePlatformPackage = vi.fn(async () => {
      throw new Error("generation failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));

    expect(await screen.findByText("无法生成小红书发布包，请重试。")).toBeInTheDocument();
    expect(screen.getByText("草稿 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成小红书发布包" })).toBeEnabled();
  });

  it("saves a manual publish record for the Xiaohongshu package", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));
    await screen.findByRole("heading", { name: "小红书发布包" });
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

    expect(await screen.findByText("已发布")).toBeInTheDocument();
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

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const aiTopicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(aiTopicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));
    await screen.findByRole("heading", { name: "小红书发布包" });
    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: "2026-05-19T08:45" }
    });
    fireEvent.change(screen.getByLabelText("发布链接"), {
      target: { value: "https://www.xiaohongshu.com/explore/unsaved" }
    });
    fireEvent.change(screen.getByLabelText("发布备注"), {
      target: { value: "Do not carry this draft note forward." }
    });

    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const financeTopicCard = screen.getByRole("article", {
      name: "A simple family finance dashboard for monthly decisions"
    });
    fireEvent.click(within(financeTopicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));
    await screen.findByRole("heading", { name: "小红书发布包" });

    expect(screen.getByLabelText("发布时间")).not.toHaveValue("2026-05-19T08:45");
    expect(screen.getByLabelText("发布链接")).toHaveValue("");
    expect(screen.getByLabelText("发布备注")).toHaveValue("");
  });

  it("shows an inline error and keeps package content when manual publish save fails", async () => {
    window.robertStation.contentLoop.recordManualPublish = vi.fn(async () => {
      throw new Error("publish failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));
    await screen.findByRole("heading", { name: "小红书发布包" });
    fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

    expect(await screen.findByText("无法保存发布记录，请重试。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "小红书发布包" })).toBeInTheDocument();
  });

  it("imports and saves metrics CSV for the selected publish record", async () => {
    await publishXiaohongshuPackage();

    fireEvent.click(screen.getByRole("button", { name: "导入数据 CSV" }));

    expect(await screen.findByText("1 行匹配记录")).toBeInTheDocument();
    expect(screen.getByText("第 2: https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存导入数据" }));

    expect(await screen.findByText("浏览")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.importMetricCsv).toHaveBeenCalled();
    expect(window.robertStation.contentLoop.saveMetricImport).toHaveBeenCalled();
  });

  it("shows an inline error and keeps package content when metrics CSV import fails", async () => {
    window.robertStation.contentLoop.importMetricCsv = vi.fn(async () => {
      throw new Error("import failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "导入数据 CSV" }));

    expect(await screen.findByText("无法导入数据 CSV，请重试。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "小红书发布包" })).toBeInTheDocument();
  });

  it("shows an inline error and keeps metrics preview when imported metrics save fails", async () => {
    window.robertStation.contentLoop.saveMetricImport = vi.fn(async () => {
      throw new Error("save failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "导入数据 CSV" }));
    await screen.findByText("1 行匹配记录");
    fireEvent.click(screen.getByRole("button", { name: "保存导入数据" }));

    expect(await screen.findByText("无法保存导入数据，请重试。")).toBeInTheDocument();
    expect(screen.getByText("1 行匹配记录")).toBeInTheDocument();
  });

  it("shows every matched metric preview row that will be saved", async () => {
    await publishXiaohongshuPackage();
    await promoteAndPublishXiaohongshuPackage(
      "A simple family finance dashboard for monthly decisions",
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

    fireEvent.click(screen.getByRole("button", { name: "导入数据 CSV" }));

    expect(await screen.findByText("2 行匹配记录")).toBeInTheDocument();
    expect(screen.getByText("第 2: https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    expect(screen.getByText("第 3: https://www.xiaohongshu.com/explore/finance")).toBeInTheDocument();
    expect(screen.queryByText(/for this publish record/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存导入数据" })).toBeEnabled();
  });

  it("generates and displays a review report for the selected publish record", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));

    expect(await screen.findByText("复盘报告 v1")).toBeInTheDocument();
    expect(screen.getByText(/生成时间 /)).toBeInTheDocument();
    expect(screen.getByText(/No imported metrics are available yet|reached/i)).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledOnce();
  });

  it("shows an inline error and keeps current content when review generation fails", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));

    expect(await screen.findByText("无法生成复盘报告，请重试。")).toBeInTheDocument();
    expect(screen.getByText("小红书发布包")).toBeInTheDocument();
  });

  it("extracts review knowledge after a project is archived and lists it in 知识库", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    await screen.findByText("已归档");
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    await screen.findByText("复盘报告 v1");

    fireEvent.click(screen.getByRole("button", { name: "提取知识" }));

    expect(await screen.findByRole("status")).toHaveTextContent("知识已提取");
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    expect(await screen.findByText(/Review lesson:/)).toBeInTheDocument();
    expect(screen.getByText(/review performance/)).toBeInTheDocument();
  });

  it("shows archive-required message when extracting review knowledge before archive", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    await screen.findByText("复盘报告 v1");

    fireEvent.click(screen.getByRole("button", { name: "提取知识" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "请先归档该项目，再提取复盘知识。"
    );
  });

  it("shows an inline error and keeps the review report when review knowledge extraction fails", async () => {
    window.robertStation.contentLoop.extractReviewKnowledge = vi.fn(async () => {
      throw new Error("Extract failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    await screen.findByText("已归档");
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    await screen.findByText("复盘报告 v1");
    fireEvent.click(screen.getByRole("button", { name: "提取知识" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法提取复盘知识，请重试。");
    expect(screen.getByText("复盘报告 v1")).toBeInTheDocument();
  });

  it("clears review generation errors when switching publish records", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    expect(await screen.findByText("无法生成复盘报告，请重试。")).toBeInTheDocument();

    await promoteAndPublishXiaohongshuPackage(
      "A simple family finance dashboard for monthly decisions",
      "https://www.xiaohongshu.com/explore/finance"
    );

    expect(screen.getByText("https://www.xiaohongshu.com/explore/finance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成复盘报告" })).toBeEnabled();
    await waitFor(() => {
      expect(screen.queryByText("无法生成复盘报告，请重试。")).not.toBeInTheDocument();
    });
  });

  it("ignores stale successful review generation after switching publish records", async () => {
    await publishXiaohongshuPackage();
    const firstSelectedState = await window.robertStation.contentLoop.load();
    const firstProject = firstSelectedState.projects.find(
      (project) => project.title === "How to build a personal AI workstation for daily content work"
    );
    const firstPublishRecord = firstSelectedState.publishRecords.find(
      (record) => record.url === "https://www.xiaohongshu.com/explore/demo"
    );
    const deferredReview = createDeferred<PersistedContentLoopState>();
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => deferredReview.promise);

    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));
    expect(screen.getByRole("button", { name: "生成中..." })).toBeDisabled();

    await promoteAndPublishXiaohongshuPackage(
      "A simple family finance dashboard for monthly decisions",
      "https://www.xiaohongshu.com/explore/finance"
    );
    expect(screen.getByText("A simple family finance dashboard for monthly decisions")).toBeInTheDocument();

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
      expect(screen.getByText("A simple family finance dashboard for monthly decisions")).toBeInTheDocument();
    });
    expect(screen.queryByText("How to build a personal AI workstation for daily content work")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale first project report summary")).not.toBeInTheDocument();
  });

  it("archives the selected project and shows archive status", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));

    expect(await screen.findByText("已归档")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("lists archived knowledge items in the 知识库 screen", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    await screen.findByText("已归档");
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText(/Reusable lesson:/)).toBeInTheDocument();
  });

  it("shows an inline error and keeps the current draft when project archive fails", async () => {
    window.robertStation.contentLoop.archiveProject = vi.fn(async () => {
      throw new Error("archive failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "选题池" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

    await screen.findByRole("heading", { name: "创作工作台" });
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法归档项目，请重试。");
    expect(screen.getByText("草稿 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档项目" })).toBeEnabled();
  });
});

async function publishXiaohongshuPackage(): Promise<void> {
  render(<App />);

  await screen.findByRole("heading", { name: "Robert Station" });
  await promoteAndPublishXiaohongshuPackage(
    "How to build a personal AI workstation for daily content work",
    "https://www.xiaohongshu.com/explore/demo"
  );
}

async function promoteAndPublishXiaohongshuPackage(topicName: string, publishUrl: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "选题池" }));
  const topicCard = screen.getByRole("article", { name: topicName });
  fireEvent.click(within(topicCard).getByRole("button", { name: "转为项目" }));

  await screen.findByRole("heading", { name: "创作工作台" });
  fireEvent.click(screen.getByRole("button", { name: "生成小红书发布包" }));
  await screen.findByRole("heading", { name: "小红书发布包" });
  fireEvent.change(screen.getByLabelText("发布链接"), {
    target: { value: publishUrl }
  });
  fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

  await screen.findByText("已发布");
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}
