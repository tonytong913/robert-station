import type { ContentLoopExportFile, ContentLoopExportFormat, ContentLoopExportInput } from "./types";

export function createContentLoopExport(
  input: ContentLoopExportInput,
  format: ContentLoopExportFormat
): ContentLoopExportFile {
  if (format === "json") {
    return {
      fileName: "robert-station-export.json",
      mimeType: "application/json;charset=utf-8",
      content: JSON.stringify(input, null, 2)
    };
  }

  if (format === "csv") {
    return {
      fileName: "robert-station-sources.csv",
      mimeType: "text/csv;charset=utf-8",
      content: createSourcesCsv(input)
    };
  }

  return {
    fileName: "robert-station-export.md",
    mimeType: "text/markdown;charset=utf-8",
    content: createMarkdownExport(input)
  };
}

function createMarkdownExport(input: ContentLoopExportInput): string {
  const lines = ["# Robert Station Export", "", "## Sources"];

  if (input.sources.length === 0) {
    lines.push("- No sources exported.");
  } else {
    for (const source of input.sources) {
      const title = source.url ? `[${source.title}](${source.url})` : source.title;
      const tags = (source.tags ?? []).length > 0 ? ` #${source.tags?.join(" #")}` : "";
      lines.push(`- ${title}${tags}`);
      if (source.note) {
        lines.push(`  - Note: ${source.note}`);
      }
      if (source.excerpt) {
        lines.push(`  - Excerpt: ${source.excerpt}`);
      }
    }
  }

  lines.push("", "## Projects");

  if (input.projects.length === 0) {
    lines.push("- No projects exported.");
  } else {
    for (const project of input.projects) {
      lines.push(`- ${project.title}: ${project.status}`);
    }
  }

  lines.push("", "## Review Reports");
  lines.push(...input.reviewReports.map((report) => `- ${report.summary}`));

  lines.push("", "## Knowledge");
  lines.push(...input.knowledgeItems.map((item) => `- ${item.title}: ${item.lesson}`));

  return `${lines.join("\n")}\n`;
}

function createSourcesCsv(input: ContentLoopExportInput): string {
  const header = "title,url,columnSlug,platform,author,usageStatus,tags,note";
  const rows = input.sources.map((source) =>
    [
      source.title,
      source.url ?? "",
      source.columnSlug ?? "",
      source.platform ?? "",
      source.author ?? "",
      source.usageStatus ?? "",
      (source.tags ?? []).join(";"),
      source.note
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return `${[header, ...rows].join("\n")}\n`;
}

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
