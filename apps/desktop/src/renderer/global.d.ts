import type { ContentColumnSlug, ManualPublishInput, Platform } from "@robert-station/core";
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
        promoteTopic: (topicId: string) => Promise<PersistedContentLoopState>;
      };
    };
  }
}

export {};
