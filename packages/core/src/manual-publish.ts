import { createEntityId } from "./ids";
import type { ManualPublishInput, PlatformPackage, PublishRecord } from "./types";

interface CreateManualPublishRecordRequest {
  platformPackage: PlatformPackage;
  input: ManualPublishInput;
  now?: Date;
}

const DEFAULT_NOW = new Date("2026-05-19T00:00:00.000Z");

export function createManualPublishRecord(request: CreateManualPublishRecordRequest): PublishRecord {
  const timestamp = (request.now ?? DEFAULT_NOW).toISOString();

  return {
    id: createEntityId("publish-record", request.platformPackage.id),
    workspaceId: request.platformPackage.workspaceId,
    contentProjectId: request.platformPackage.contentProjectId,
    platformPackageId: request.platformPackage.id,
    platform: request.platformPackage.platform,
    status: "published",
    publishedAt: request.input.publishedAt,
    url: request.input.url ?? "",
    note: request.input.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
