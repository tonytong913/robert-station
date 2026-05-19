import type { ContentColumnSlug } from "@robert-station/core";
import type { PersistedContentLoopState } from "@robert-station/local-store";

declare global {
  interface Window {
    robertStation: {
      appName: string;
      contentLoop: {
        load: () => Promise<PersistedContentLoopState>;
        generateTopics: (columnSlug: ContentColumnSlug) => Promise<PersistedContentLoopState>;
        promoteTopic: (topicId: string) => Promise<PersistedContentLoopState>;
      };
    };
  }
}

export {};
