import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteContentLoopRepository } from "./sqlite-content-loop-repository";

describe("SqliteContentLoopRepository", () => {
  let tempDirectory: string;
  let databasePath: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "robert-station-sqlite-"));
    databasePath = path.join(tempDirectory, "content-loop.sqlite");
  });

  afterEach(async () => {
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it("seeds and reloads the content loop from disk", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const firstLoad = await firstRepository.loadContentLoop();
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const secondLoad = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(firstLoad.topics).toHaveLength(4);
    expect(firstLoad.projects).toHaveLength(0);
    expect(firstLoad.drafts).toHaveLength(0);
    expect(secondLoad).toEqual(firstLoad);
  });

  it("persists promoted topic across repository instances", async () => {
    const firstRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterPromote = await firstRepository.promoteTopic("topic_ai_local-workstation");
    firstRepository.close();

    const secondRepository = SqliteContentLoopRepository.open({ databasePath });
    const afterReload = await secondRepository.loadContentLoop();
    secondRepository.close();

    expect(afterPromote.projects).toHaveLength(1);
    expect(afterPromote.drafts).toHaveLength(1);
    expect(afterPromote.selectedProjectId).toBe("project_topic-ai-local-workstation");
    expect(afterReload).toEqual(afterPromote);
  });

  it("does not duplicate a project when promoting the same topic twice or unknown topic", async () => {
    const repository = SqliteContentLoopRepository.open({ databasePath });

    await repository.promoteTopic("topic_ai_local-workstation");
    const afterSecondPromote = await repository.promoteTopic("topic_ai_local-workstation");
    const afterUnknownPromote = await repository.promoteTopic("topic_missing");

    repository.close();

    expect(afterSecondPromote.projects).toHaveLength(1);
    expect(afterSecondPromote.drafts).toHaveLength(1);
    expect(afterUnknownPromote).toEqual(afterSecondPromote);
  });
});
