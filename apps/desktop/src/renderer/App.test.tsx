import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders the Chinese taskflow shell after loading persisted state", async () => {
    render(<App />);

    expect(screen.getByText("正在加载内容工作台...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "流水线" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "流水线" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "素材库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选题" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "内容生产流水线" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /如何搭建个人 AI 工作站处理日常内容/ })).toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "流水线" })).toBeInTheDocument();
  });
});

describe("App pipeline screen", () => {
  it("promotes a topic through the pipeline detail panel", async () => {
    render(<App />);

    await selectPipelineCard("如何搭建个人 AI 工作站处理日常内容");
    fireEvent.click(screen.getByRole("button", { name: "转为项目" }));

    expect(await screen.findByRole("heading", { name: "流水线" })).toBeInTheDocument();
    expect(screen.getByText("1 个活跃项目")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "如何搭建个人 AI 工作站处理日常内容" })).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
    expect(screen.getByText("草稿 v")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /草稿中.*如何搭建个人 AI 工作站处理日常内容/ })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });

  it("generates topics from the pipeline toolbar", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "流水线" });
    fireEvent.click(screen.getByRole("button", { name: "生成选题" }));

    expect(
      await screen.findByRole("button", { name: /本周就能搭建的 3 个个人 AI 工作流自动化/ })
    ).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateTopics).toHaveBeenCalledWith("ai");
  });

  it("generates and displays a Xiaohongshu package for selected project", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));

    expect(await screen.findByRole("button", { name: /待发布.*如何搭建个人 AI 工作站处理日常内容/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "流水线" })).toBeInTheDocument();
    expect(screen.getByText("平台包")).toBeInTheDocument();
    expect(screen.getAllByText("xiaohongshu").length).toBeGreaterThan(0);
    expect(window.robertStation.contentLoop.generatePlatformPackage).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation",
      "xiaohongshu"
    );
  });

  it("saves a manual publish record from the pipeline detail panel", async () => {
    const publishedAtInput = "2026-05-21T10:30";

    render(<App />);

    await generateFirstTopicPlatformPackage();

    fireEvent.change(screen.getByLabelText("发布时间"), {
      target: { value: publishedAtInput }
    });
    fireEvent.change(screen.getByLabelText("发布链接"), {
      target: { value: "https://www.xiaohongshu.com/explore/demo" }
    });
    fireEvent.change(screen.getByLabelText("发布备注"), {
      target: { value: "pipeline detail publish note" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

    expect(await screen.findByRole("button", { name: /已发布.*如何搭建个人 AI 工作站处理日常内容/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "流水线" })).toBeInTheDocument();
    expect(screen.getByText("https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    expect(screen.getByText("pipeline detail publish note")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.recordManualPublish).toHaveBeenCalledWith({
      platformPackageId: "platform-package_project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-1-xiaohongshu",
      publishedAt: new Date(publishedAtInput).toISOString(),
      url: "https://www.xiaohongshu.com/explore/demo",
      note: "pipeline detail publish note"
    });
  });

  it("generates a review report from the pipeline detail panel after publish", async () => {
    render(<App />);

    await publishFirstTopicFromPipeline();
    fireEvent.click(screen.getByRole("button", { name: "生成复盘报告" }));

    expect(await screen.findByText(/还没有导入指标。当前仅作为发布准备度复盘。/)).toBeInTheDocument();
    expect(screen.getByText("复盘报告")).toBeInTheDocument();
    expect(screen.getByText("发布元数据已记录，可以导入指标。")).toBeInTheDocument();
    expect(screen.getByText("导入指标快照前无法评估表现。")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledWith(
      "publish-record_platform-package-project-topic-ai-local-workstation-draft-project-topic-ai-local-workstation-1-xiaohongshu"
    );
  });

  it("switches back to an older promoted project without leaving the current task screen", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    await selectPipelineCard("适合家庭月度决策的简易财务看板");
    fireEvent.click(screen.getByRole("button", { name: "转为项目" }));

    expect(await screen.findAllByText("轻量复盘习惯比复杂表格更有效。")).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText("当前项目"), {
      target: { value: "project_topic-ai-local-workstation" }
    });

    expect(screen.getByRole("heading", { name: "流水线" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "如何搭建个人 AI 工作站处理日常内容" })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_finance-family-dashboard");
  });

  it("archives the selected project and shows archive status", async () => {
    render(<App />);

    await promoteFirstTopicToProject();
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));

    expect(await screen.findByRole("button", { name: /复盘沉淀.*如何搭建个人 AI 工作站处理日常内容/ })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });
});

describe("App knowledge source library", () => {
  it("adds a source reference and creates a markdown export", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "流水线" });
    fireEvent.click(screen.getByRole("button", { name: "素材库" }));

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "微信公众号文章导出器" }
    });
    fireEvent.change(screen.getByLabelText("链接"), {
      target: { value: "https://example.com/wechat-exporter" }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));

    expect(await screen.findByRole("article", { name: "微信公众号文章导出器" })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.addSourceReference).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "导出" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 Markdown" }));

    expect(await screen.findByText("最近导出：robert-station-export.md")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.createContentLoopExport).toHaveBeenCalledWith("markdown");
  });

  it("filters source references from the knowledge screen", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "流水线" });
    fireEvent.click(screen.getByRole("button", { name: "素材库" }));

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
    expect(screen.getByLabelText("筛选栏目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "筛选资料" }));

    await waitFor(() => {
      expect(window.robertStation.contentLoop.filterSourceReferences).toHaveBeenCalledWith({ query: "资料库" });
    });
    expect(screen.getByRole("article", { name: "AI 资料库文章" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "如何搭建个人 AI 工作站处理日常内容 的调研笔记" })).not.toBeInTheDocument();
  });

  it("adds rich source metadata and filters by platform and tag", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "流水线" });
    fireEvent.click(screen.getByRole("button", { name: "素材库" }));

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
    fireEvent.change(screen.getByLabelText("筛选栏目"), {
      target: { value: "ai" }
    });
    fireEvent.change(screen.getByLabelText("筛选标签"), {
      target: { value: "资料库" }
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选资料" }));

    await waitFor(() => {
      expect(window.robertStation.contentLoop.filterSourceReferences).toHaveBeenCalledWith({
        columnSlug: "ai",
        platform: "wechat_channels",
        tag: "资料库"
      });
    });
    expect(screen.getByRole("article", { name: "微信长文导出案例" })).toBeInTheDocument();
  });

  it("creates a topic from a source reference", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "流水线" });
    fireEvent.click(screen.getByRole("button", { name: "素材库" }));

    fireEvent.change(screen.getByLabelText("标题"), {
      target: { value: "微信长文导出案例" }
    });
    fireEvent.change(screen.getByLabelText("链接"), {
      target: { value: "https://example.com/wechat-case" }
    });
    fireEvent.change(screen.getByLabelText("平台"), {
      target: { value: "wechat_channels" }
    });
    fireEvent.change(screen.getByLabelText("摘要"), {
      target: { value: "多格式导出和资源缓存值得参考。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "添加资料" }));

    const source = await screen.findByRole("article", { name: "微信长文导出案例" });
    fireEvent.click(within(source).getByRole("button", { name: "生成选题" }));

    expect(await screen.findByRole("heading", { name: "流水线" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /微信长文导出案例/ })).toBeInTheDocument();
    expect(window.robertStation.contentLoop.createTopicFromSourceReference).toHaveBeenCalledWith("source_wechat-case");
  });
});

describe("App knowledge library", () => {
  it("shows an empty state when no knowledge items exist", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "流水线" });
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "暂无沉淀知识。" })).toBeInTheDocument();
  });
});

async function promoteFirstTopicToProject(): Promise<void> {
  await selectPipelineCard("如何搭建个人 AI 工作站处理日常内容");
  fireEvent.click(screen.getByRole("button", { name: "转为项目" }));

  await screen.findByRole("button", { name: /草稿中.*如何搭建个人 AI 工作站处理日常内容/ });
}

async function generateFirstTopicPlatformPackage(): Promise<void> {
  await promoteFirstTopicToProject();
  fireEvent.click(screen.getByRole("button", { name: "生成小红书包" }));

  await screen.findByRole("button", { name: /待发布.*如何搭建个人 AI 工作站处理日常内容/ });
}

async function publishFirstTopicFromPipeline(): Promise<void> {
  await generateFirstTopicPlatformPackage();

  fireEvent.change(screen.getByLabelText("发布时间"), {
    target: { value: "2026-05-21T10:30" }
  });
  fireEvent.change(screen.getByLabelText("发布链接"), {
    target: { value: "https://www.xiaohongshu.com/explore/demo" }
  });
  fireEvent.change(screen.getByLabelText("发布备注"), {
    target: { value: "pipeline detail publish note" }
  });
  fireEvent.click(screen.getByRole("button", { name: "保存发布记录" }));

  await screen.findByRole("button", { name: /已发布.*如何搭建个人 AI 工作站处理日常内容/ });
}

async function selectPipelineCard(title: string): Promise<void> {
  await screen.findByRole("heading", { name: "流水线" });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(title) }));
}
