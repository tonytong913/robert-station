import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App dashboard", () => {
  it("renders the four equal-priority content columns", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Robert Station" })).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("shows the foundation workflow stages", () => {
    render(<App />);

    expect(screen.getByText("Topic Pool")).toBeInTheDocument();
    expect(screen.getByText("Creation Studio")).toBeInTheDocument();
    expect(screen.getByText("Publish Assistant")).toBeInTheDocument();
    expect(screen.getByText("Data Import")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
  });
});
