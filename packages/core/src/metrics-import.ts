import { createEntityId } from "./ids";
import type {
  EntityId,
  MetricCsvImportInput,
  MetricImportPreview,
  MetricImportPreviewRow,
  MetricSnapshot,
  MetricValues,
  Platform,
  PublishRecord
} from "./types";

interface CreateMetricImportPreviewRequest {
  input: MetricCsvImportInput;
  publishRecords: PublishRecord[];
  now?: Date;
}

interface CreateMetricSnapshotsFromPreviewRequest {
  preview: MetricImportPreview;
  publishRecords: PublishRecord[];
  now?: Date;
}

const CSV_HEADERS = ["url", "publishedAt", "platform", "views", "likes", "favorites", "comments", "shares", "snapshotAt", "note"] as const;
const METRIC_FIELDS = ["views", "likes", "favorites", "comments", "shares"] as const;
const SUPPORTED_PLATFORMS = new Set<Platform>(["xiaohongshu", "douyin", "wechat_channels", "bilibili"]);
const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;

type CsvHeader = (typeof CSV_HEADERS)[number];
type MetricField = (typeof METRIC_FIELDS)[number];

export function createMetricImportPreview(request: CreateMetricImportPreviewRequest): MetricImportPreview {
  const createdAt = (request.now ?? new Date()).toISOString();
  const basePreview = {
    id: createEntityId("metric-import-preview", `${request.input.sourceFileName}-${createdAt}`),
    sourceFileName: request.input.sourceFileName,
    createdAt
  };

  if (request.input.csvText.trim() === "") {
    return {
      ...basePreview,
      rows: [createInvalidPreviewRow({ rowNumber: 1, snapshotAt: createdAt, error: "CSV file is empty." })]
    };
  }

  const csvRows = parseCsvRows(request.input.csvText);
  const headerRow = csvRows[0]?.map((cell) => cell.trim()) ?? [];
  const missingHeader = CSV_HEADERS.find((header) => !headerRow.includes(header));

  if (missingHeader) {
    return {
      ...basePreview,
      rows: [createInvalidPreviewRow({ rowNumber: 1, snapshotAt: createdAt, error: `Missing CSV header: ${missingHeader}.` })]
    };
  }

  const headerIndexes = buildHeaderIndexes(headerRow);
  const rows = csvRows.slice(1).flatMap((cells, index) => {
    if (isBlankCsvRecord(cells)) {
      return [];
    }

    return [
      createPreviewRow({
        rowNumber: index + 2,
        cells,
        headerIndexes,
        publishRecords: request.publishRecords,
        importTimestamp: createdAt
      })
    ];
  });

  return {
    ...basePreview,
    rows
  };
}

export function createMetricSnapshotsFromPreview(request: CreateMetricSnapshotsFromPreviewRequest): MetricSnapshot[] {
  const timestamp = (request.now ?? new Date()).toISOString();
  const recordsById = new Map<EntityId, PublishRecord>(request.publishRecords.map((record) => [record.id, record]));

  return request.preview.rows.flatMap((row) => {
    if (row.status !== "matched" || !row.publishRecordId) {
      return [];
    }

    const publishRecord = recordsById.get(row.publishRecordId);
    if (!publishRecord) {
      return [];
    }

    return [
      {
        id: createEntityId("metric-snapshot", `${publishRecord.id}-${row.snapshotAt}`),
        workspaceId: publishRecord.workspaceId,
        contentProjectId: publishRecord.contentProjectId,
        publishRecordId: publishRecord.id,
        platform: publishRecord.platform,
        sourceFileName: request.preview.sourceFileName,
        snapshotAt: row.snapshotAt,
        views: row.metrics.views,
        likes: row.metrics.likes,
        favorites: row.metrics.favorites,
        comments: row.metrics.comments,
        shares: row.metrics.shares,
        note: row.note,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
  });
}

function createPreviewRow(request: {
  rowNumber: number;
  cells: string[];
  headerIndexes: Map<CsvHeader, number>;
  publishRecords: PublishRecord[];
  importTimestamp: string;
}): MetricImportPreviewRow {
  const url = getCell(request.cells, request.headerIndexes, "url");
  const publishedAt = getCell(request.cells, request.headerIndexes, "publishedAt");
  const platformResult = parsePlatform(getCell(request.cells, request.headerIndexes, "platform"));
  const snapshotAt = getCell(request.cells, request.headerIndexes, "snapshotAt") || request.importTimestamp;
  const note = getCell(request.cells, request.headerIndexes, "note");
  const metricsResult = parseMetrics(request.cells, request.headerIndexes);
  const baseRow = {
    rowNumber: request.rowNumber,
    url,
    platform: platformResult.platform,
    publishedAt,
    snapshotAt,
    metrics: metricsResult.metrics,
    note
  };

  if (platformResult.error) {
    return {
      ...baseRow,
      status: "invalid",
      error: platformResult.error
    };
  }

  if (metricsResult.error) {
    return {
      ...baseRow,
      status: "invalid",
      error: metricsResult.error
    };
  }

  const publishRecord = findMatchingPublishRecord({
    publishRecords: request.publishRecords,
    url,
    platform: platformResult.platform,
    publishedAt
  });
  if (!publishRecord) {
    return {
      ...baseRow,
      status: "invalid",
      error: "No matching publish record."
    };
  }

  return {
    ...baseRow,
    status: "matched",
    publishRecordId: publishRecord.id
  };
}

function buildHeaderIndexes(headerRow: string[]): Map<CsvHeader, number> {
  const indexes = new Map<CsvHeader, number>();

  for (const header of CSV_HEADERS) {
    indexes.set(header, headerRow.indexOf(header));
  }

  return indexes;
}

function isBlankCsvRecord(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

function getCell(cells: string[], headerIndexes: Map<CsvHeader, number>, header: CsvHeader): string {
  const index = headerIndexes.get(header) ?? -1;
  return (cells[index] ?? "").trim();
}

function parseMetrics(cells: string[], headerIndexes: Map<CsvHeader, number>): { metrics: MetricValues; error?: string } {
  const metrics: MetricValues = {
    views: 0,
    likes: 0,
    favorites: 0,
    comments: 0,
    shares: 0
  };

  for (const field of METRIC_FIELDS) {
    const value = getCell(cells, headerIndexes, field);
    if (value === "") {
      continue;
    }

    if (!NON_NEGATIVE_INTEGER_PATTERN.test(value)) {
      return {
        metrics,
        error: `${field} must be a non-negative integer.`
      };
    }

    metrics[field] = Number(value);
  }

  return { metrics };
}

function parsePlatform(value: string): { platform: Platform; error?: string } {
  if (value === "") {
    return { platform: "xiaohongshu" };
  }

  if (!SUPPORTED_PLATFORMS.has(value as Platform)) {
    return {
      platform: "xiaohongshu",
      error: `Unsupported platform: ${value}.`
    };
  }

  return { platform: value as Platform };
}

function findMatchingPublishRecord(request: {
  publishRecords: PublishRecord[];
  url: string;
  platform: Platform;
  publishedAt: string;
}): PublishRecord | undefined {
  if (request.url !== "") {
    const urlMatch = request.publishRecords.find((record) => record.url === request.url);
    if (urlMatch) {
      return urlMatch;
    }
  }

  return request.publishRecords.find((record) => record.platform === request.platform && record.publishedAt === request.publishedAt);
}

function createInvalidPreviewRow(request: { rowNumber: number; snapshotAt: string; error: string }): MetricImportPreviewRow {
  return {
    rowNumber: request.rowNumber,
    status: "invalid",
    url: "",
    platform: "xiaohongshu",
    publishedAt: "",
    snapshotAt: request.snapshotAt,
    metrics: {
      views: 0,
      likes: 0,
      favorites: 0,
      comments: 0,
      shares: 0
    },
    note: "",
    error: request.error
  };
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";

      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      continue;
    }

    cell += character;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
