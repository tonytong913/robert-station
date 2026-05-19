import { createEntityId } from "./ids";
import type { ContentProject, DraftVersion, SourceReference, Topic } from "./types";

interface GenerateMockDraftPackageRequest {
  project: ContentProject;
  topic?: Topic | null;
  sourceReferences: SourceReference[];
  nextVersion: number;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function generateMockDraftPackage(request: GenerateMockDraftPackageRequest): DraftVersion {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();
  const sourceNotes = request.sourceReferences.map((source) => source.note).filter((note) => note.length > 0);
  const hook = request.topic?.hook ?? "Clarify the core problem and show one repeatable solution.";
  const audience = request.topic?.audience ?? "Readers who want practical, repeatable improvements.";
  const columnLabel = request.topic?.columnSlug ?? request.project.primaryColumnId.replace(/^column_/, "");
  const verificationLines =
    sourceNotes.length > 0 ? sourceNotes : ["Verify the examples, claims, and platform rules before publishing."];

  return {
    id: createEntityId("draft", `${request.project.id}-${request.nextVersion}`),
    workspaceId: request.project.workspaceId,
    contentProjectId: request.project.id,
    version: request.nextVersion,
    title: request.project.title,
    body: [
      "Brief",
      `Audience: ${audience}`,
      `Angle: ${hook}`,
      `Column: ${columnLabel}`,
      "",
      "Title Options",
      `1. ${request.project.title}`,
      `2. ${request.project.title}: a practical workflow`,
      "3. What changed after I rebuilt this as a repeatable system",
      "",
      "Body Draft",
      `Open with the concrete problem: ${hook}`,
      "Explain the repeatable workflow in three steps: capture the input, process it with a clear assistant role, and archive the output for reuse.",
      "Add a personal operating note so the draft feels grounded instead of generic.",
      "Close with one action the reader can try today.",
      "",
      "Cover Copy",
      "Make the workflow visible",
      "",
      "Tag Suggestions",
      `#${columnLabel}`,
      "#workflow",
      "#creator-system",
      "#content-ops",
      "",
      "Visual Direction",
      "Use a clean checklist or before-after workflow diagram. Keep the cover text short and readable.",
      "",
      "Pending Verification",
      ...verificationLines.map((line, index) => `${index + 1}. ${line}`)
    ].join("\n"),
    createdBy: "assistant",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
