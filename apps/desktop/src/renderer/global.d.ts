import type {
  AdvanceTaskRunInput,
  ContentColumnSlug,
  ContentLoopExportFile,
  ContentLoopExportFormat,
  CreateTaskRunInput,
  ManualPublishInput,
  ManualSourceReferenceInput,
  Platform,
  SourceReferenceFilter
} from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";

declare global {
  interface Window {
    robertStation: {
      appName: string;
      contentLoop: {
        load: () => Promise<PersistedContentLoopState>;
        generateTopics: (columnSlug: ContentColumnSlug) => Promise<PersistedContentLoopState>;
        generateDraftPackage: (projectId: string) => Promise<PersistedContentLoopState>;
        generatePlatformPackage: (projectId: string, platform: Platform) => Promise<PersistedContentLoopState>;
        archiveProject: (projectId: string) => Promise<PersistedContentLoopState>;
        recordManualPublish: (input: ManualPublishInput) => Promise<PersistedContentLoopState>;
        importMetricCsv: () => Promise<PersistedContentLoopState>;
        saveMetricImport: () => Promise<PersistedContentLoopState>;
        generateReviewReport: (publishRecordId: string) => Promise<PersistedContentLoopState>;
        extractReviewKnowledge: (reviewReportId: string) => Promise<PersistedContentLoopState>;
        promoteTopic: (topicId: string) => Promise<PersistedContentLoopState>;
        addSourceReference: (input: ManualSourceReferenceInput) => Promise<PersistedContentLoopState>;
        filterSourceReferences: (filter: SourceReferenceFilter) => Promise<PersistedContentLoopState>;
        createContentLoopExport: (format: ContentLoopExportFormat) => Promise<ContentLoopExportFile>;
        startTaskRun: (input: CreateTaskRunInput) => Promise<PersistedContentLoopState>;
        advanceTaskRun: (taskRunId: string, input: AdvanceTaskRunInput) => Promise<PersistedContentLoopState>;
      };
    };
  }
}

export {};
