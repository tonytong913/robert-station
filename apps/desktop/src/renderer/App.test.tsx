import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App content loop", () => {
  it("renders dashboard counts and equal-priority columns", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("4 candidate topics")).toBeInTheDocument();
    expect(screen.getByText("0 active projects")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("promotes a topic into a project and shows its draft", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Topic Pool" }));
    const topicCard = screen.getByRole("article", {
      name: "How to build a personal AI workstation for daily content work"
    });
    fireEvent.click(within(topicCard).getByRole("button", { name: "Promote to project" }));

    expect(screen.getByText("1 active project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Creation Studio" })).toBeInTheDocument();
    expect(screen.getByText("Brief hook: Turn scattered AI tools into one repeatable daily workflow.")).toBeInTheDocument();
  });
});
