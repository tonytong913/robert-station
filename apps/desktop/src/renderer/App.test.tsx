import type { PersistedContentLoopState } from "@robert-station/local-store";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders dashboard counts and equal-priority columns after loading persisted state", async () => {
    render(<App />);

    expect(screen.getByText("Loading content loop...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("4 candidate topics")).toBeInTheDocument();
    expect(screen.getByText("0 active projects")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("promotes a topic through persistence API and shows its draft", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    expect(await screen.findByRole("heading", { name: "Creation Studio" })).toBeInTheDocument();
    expect(screen.getByText("1 active project")).toBeInTheDocument();
    expect(screen.getByText("Brief hook: Turn scattered AI tools into one repeatable daily workflow.")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.promoteTopic).toHaveBeenCalledWith("topic_ai_local-workstation");
  });

  it("generates topics for selected column from Topic Pool", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    fireEvent.change(screen.getByLabelText("Topic column"), { target: { value: "finance" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate topics" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const generateButton = screen.getByRole("button", { name: "Generate topics" });
    fireEvent.click(generateButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate topics. Try again.");
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
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft package" }));

    expect(await screen.findByText("Draft v2")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft package" }));

    expect(await screen.findByText("Could not generate draft package. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Draft v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate draft package" })).toBeEnabled();
  });

  it("generates and displays a Xiaohongshu package for the selected project", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));

    expect(await screen.findByRole("heading", { name: "Xiaohongshu Package" })).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Cover text")).toBeInTheDocument();
    expect(screen.getByText("Required assets")).toBeInTheDocument();
    expect(screen.getByText("Checks")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));

    expect(await screen.findByText("Could not generate Xiaohongshu package. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Draft v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Xiaohongshu package" })).toBeEnabled();
  });

  it("saves a manual publish record for the Xiaohongshu package", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
    await screen.findByRole("heading", { name: "Xiaohongshu Package" });
    fireEvent.change(screen.getByLabelText("Published at"), {
      target: { value: "2026-05-19T15:30" }
    });
    fireEvent.change(screen.getByLabelText("Publish URL"), {
      target: { value: "https://www.xiaohongshu.com/explore/demo" }
    });
    fireEvent.change(screen.getByLabelText("Publish note"), {
      target: { value: "Published manually after final review." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

    expect(await screen.findByText("Published")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const aiTopicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(aiTopicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
    await screen.findByRole("heading", { name: "Xiaohongshu Package" });
    fireEvent.change(screen.getByLabelText("Published at"), {
      target: { value: "2026-05-19T08:45" }
    });
    fireEvent.change(screen.getByLabelText("Publish URL"), {
      target: { value: "https://www.xiaohongshu.com/explore/unsaved" }
    });
    fireEvent.change(screen.getByLabelText("Publish note"), {
      target: { value: "Do not carry this draft note forward." }
    });

    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const financeTopicCard = screen.getByRole("article", {
      name: "A simple family finance dashboard for monthly decisions"
    });
    fireEvent.click(within(financeTopicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
    await screen.findByRole("heading", { name: "Xiaohongshu Package" });

    expect(screen.getByLabelText("Published at")).not.toHaveValue("2026-05-19T08:45");
    expect(screen.getByLabelText("Publish URL")).toHaveValue("");
    expect(screen.getByLabelText("Publish note")).toHaveValue("");
  });

  it("shows an inline error and keeps package content when manual publish save fails", async () => {
    window.robertStation.contentLoop.recordManualPublish = vi.fn(async () => {
      throw new Error("publish failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
    await screen.findByRole("heading", { name: "Xiaohongshu Package" });
    fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

    expect(await screen.findByText("Could not save publish record. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Xiaohongshu Package" })).toBeInTheDocument();
  });

  it("imports and saves metrics CSV for the selected publish record", async () => {
    await publishXiaohongshuPackage();

    fireEvent.click(screen.getByRole("button", { name: "Import metrics CSV" }));

    expect(await screen.findByText("1 matched row in this import")).toBeInTheDocument();
    expect(screen.getByText("Row 2: https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save imported metrics" }));

    expect(await screen.findByText("Views")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.importMetricCsv).toHaveBeenCalled();
    expect(window.robertStation.contentLoop.saveMetricImport).toHaveBeenCalled();
  });

  it("shows an inline error and keeps package content when metrics CSV import fails", async () => {
    window.robertStation.contentLoop.importMetricCsv = vi.fn(async () => {
      throw new Error("import failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Import metrics CSV" }));

    expect(await screen.findByText("Could not import metrics CSV. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Xiaohongshu Package" })).toBeInTheDocument();
  });

  it("shows an inline error and keeps metrics preview when imported metrics save fails", async () => {
    window.robertStation.contentLoop.saveMetricImport = vi.fn(async () => {
      throw new Error("save failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Import metrics CSV" }));
    await screen.findByText("1 matched row in this import");
    fireEvent.click(screen.getByRole("button", { name: "Save imported metrics" }));

    expect(await screen.findByText("Could not save imported metrics. Try again.")).toBeInTheDocument();
    expect(screen.getByText("1 matched row in this import")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Import metrics CSV" }));

    expect(await screen.findByText("2 matched rows in this import")).toBeInTheDocument();
    expect(screen.getByText("Row 2: https://www.xiaohongshu.com/explore/demo")).toBeInTheDocument();
    expect(screen.getByText("Row 3: https://www.xiaohongshu.com/explore/finance")).toBeInTheDocument();
    expect(screen.queryByText(/for this publish record/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save imported metrics" })).toBeEnabled();
  });

  it("generates and displays a review report for the selected publish record", async () => {
    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));

    expect(await screen.findByText("Review Report v1")).toBeInTheDocument();
    expect(screen.getByText(/No imported metrics are available yet|reached/i)).toBeInTheDocument();
    expect(window.robertStation.contentLoop.generateReviewReport).toHaveBeenCalledOnce();
  });

  it("shows an inline error and keeps current content when review generation fails", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));

    expect(await screen.findByText("Could not generate review report. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Xiaohongshu Package")).toBeInTheDocument();
  });

  it("clears review generation errors when switching publish records", async () => {
    window.robertStation.contentLoop.generateReviewReport = vi.fn(async () => {
      throw new Error("Review failed");
    });

    await publishXiaohongshuPackage();
    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));
    expect(await screen.findByText("Could not generate review report. Try again.")).toBeInTheDocument();

    await promoteAndPublishXiaohongshuPackage(
      "A simple family finance dashboard for monthly decisions",
      "https://www.xiaohongshu.com/explore/finance"
    );

    expect(screen.getByText("https://www.xiaohongshu.com/explore/finance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate review report" })).toBeEnabled();
    await waitFor(() => {
      expect(screen.queryByText("Could not generate review report. Try again.")).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Generate review report" }));
    expect(screen.getByRole("button", { name: "Generating..." })).toBeDisabled();

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
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));

    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(window.robertStation.contentLoop.archiveProject).toHaveBeenCalledWith(
      "project_topic-ai-local-workstation"
    );
  });

  it("lists archived knowledge items in the Knowledge screen", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));
    await screen.findByText("Archived");
    fireEvent.click(screen.getByRole("button", { name: "Knowledge" }));

    expect(screen.getByRole("heading", { name: "Knowledge" })).toBeInTheDocument();
    expect(screen.getByText(/Reusable lesson:/)).toBeInTheDocument();
  });

  it("shows an inline error and keeps the current draft when project archive fails", async () => {
    window.robertStation.contentLoop.archiveProject = vi.fn(async () => {
      throw new Error("archive failed");
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Robert Station" });
    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    await screen.findByRole("heading", { name: "Creation Studio" });
    fireEvent.click(screen.getByRole("button", { name: "Archive project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not archive project. Try again.");
    expect(screen.getByText("Draft v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive project" })).toBeEnabled();
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
  fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
  const topicCard = screen.getByRole("article", { name: topicName });
  fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

  await screen.findByRole("heading", { name: "Creation Studio" });
  fireEvent.click(screen.getByRole("button", { name: "Generate Xiaohongshu package" }));
  await screen.findByRole("heading", { name: "Xiaohongshu Package" });
  fireEvent.change(screen.getByLabelText("Publish URL"), {
    target: { value: publishUrl }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save publish record" }));

  await screen.findByText("Published");
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}
