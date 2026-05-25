# Agent Runtime Integration Design

Date: 2026-05-25

## Purpose

Add an agent runtime layer for Robert Station so content workflows can evolve from deterministic mock assistants into structured, auditable AI workflows.

The selected direction is Mastra-first: use Mastra for workflow and agent orchestration, but keep Robert Station's business contracts in our own packages. The application should be able to generate topics, drafts, platform packages, reviews, and later multimodal workflow artifacts without scattering framework-specific code through the domain model, repositories, or renderer.

## Runtime Choice

Recommended runtime: Mastra.

Why it fits this project:

- The project is already TypeScript-first, and Mastra is a TypeScript framework for agents, workflows, tools, memory, MCP, and observability.
- Robert Station is growing into a repeatable content operation workflow, not a single chat agent. Mastra workflows support typed steps, branching, parallel work, suspension, resume, and human-in-the-loop checkpoints.
- Channel, modality, and column expansion will create workflow variants that are easier to express as explicit workflow graphs than as one autonomous prompt loop.
- Mastra can call agents and tools inside workflow steps, letting us mix deterministic domain code with LLM work.

Alternatives considered:

- OpenAI Agents SDK for TypeScript: good lightweight agent runner and strong model/tool integration, but less suited as the main workflow graph for a growing content production matrix.
- Claude Agent SDK: strong if Robert Station should deeply depend on Claude Code or Claude sessions, but it would tie the first integration more tightly to one agent ecosystem.
- Pi Agent: useful for coding-agent and local automation harnesses, but Robert Station's first need is structured content workflow orchestration.
- OpenClaw: strong for multi-channel computer-use agent runtimes, but too broad and invasive for the first desktop content-workbench runtime.

## Product Shape

The content system is expected to expand across three axes:

- Channels: Xiaohongshu, Douyin, WeChat Channels, WeChat Official Account, Toutiao, Bilibili, and future platforms.
- Modalities: image/text posts, short videos, long-form articles, lightweight apps, and future asset types.
- Columns: AI, finance, fitness, parenting, and future content verticals.

This creates a workflow matrix. A single content project may need different branches:

```text
Topic discovery
-> source collection
-> evidence and risk checks
-> content strategy
-> modality-specific production
-> channel-specific packaging
-> human review
-> manual publish record
-> metric import
-> review
-> knowledge extraction
```

The first integration should not implement every branch. It should establish the runtime boundary and replace one or two high-value mock assistants with runtime-backed outputs while preserving safe fallback behavior.

## Scope

Included:

- Add a new `packages/agent-runtime` workspace package.
- Define Robert Station-owned runtime contracts for content tasks.
- Add a Mastra-backed runtime implementation behind those contracts.
- Keep a deterministic mock runtime for tests and missing API-key fallback.
- Wire the local-store repository to call the runtime for topic generation and draft generation first.
- Keep existing mock assistant functions as fallback and regression fixtures.
- Add tests for runtime selection, fallback, and repository integration.
- Keep all Electron renderer calls behind existing IPC boundaries.

Deferred:

- Full workflow graph for every channel, modality, and column combination.
- Automatic platform posting or browser automation.
- Video generation, image generation, editing, or asset storage.
- Long-running workflow persistence UI.
- Prompt editing UI.
- Remote server execution.
- Model/provider settings UI.
- API key storage UI.

## Architecture

### Package Boundary

Add:

```text
packages/agent-runtime
```

Responsibilities:

- Export a framework-neutral `ContentAgentRuntime` interface.
- Export a `createContentAgentRuntime` factory.
- Export `MockContentAgentRuntime`.
- Export `MastraContentAgentRuntime`.
- Hold Mastra agent/workflow definitions and prompt templates.

The rest of the app should depend on Robert Station contracts, not on Mastra types.

### Runtime Interface

The first interface should be narrow:

```ts
interface ContentAgentRuntime {
  generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput>;
  generateDraft(input: GenerateDraftInput): Promise<GenerateDraftOutput>;
}
```

The input/output types should use existing core concepts where possible:

- `ContentColumnSlug`
- `ContentProject`
- `Topic`
- `SourceReference`
- `DraftVersion`
- `Platform`

The runtime returns structured data, not raw prose blobs. Domain constructors in `@robert-station/core` or repository mapping code should convert runtime output into persisted entities.

### Repository Integration

`ContentLoopRepository` remains the application service boundary used by Electron IPC.

Repository creation should accept an optional runtime:

```ts
interface ContentLoopRepositoryOptions {
  agentRuntime?: ContentAgentRuntime;
}
```

Behavior:

- If a runtime is configured, repository workflows call it.
- If the runtime throws, returns invalid structured data, or is not configured, repository workflows use the existing deterministic mock generators.
- Repository methods still return full `PersistedContentLoopState`.
- Renderer behavior does not change in the first slice.

### Electron Main

Electron main process creates the runtime and injects it into the repository.

Configuration:

- `ROBERT_STATION_AGENT_RUNTIME=mastra` enables Mastra.
- `ROBERT_STATION_AGENT_RUNTIME=mock` or missing config uses mock runtime.
- `OPENAI_API_KEY` or provider-specific environment variables are read only in the main process.
- No API key is exposed to preload or renderer.

### Mastra Usage

Mastra should be used for orchestration, not as a domain model.

Initial agents:

- `topicStrategistAgent`: generates candidate topics by column, audience, platform fit, and source/risk notes.
- `draftProducerAgent`: generates a structured draft package from project, topic, and source references.

Initial workflows:

- `topicDiscoveryWorkflow`: validates column input, calls topic strategist, normalizes results, and returns structured candidates.
- `draftPackageWorkflow`: builds brief context, calls draft producer, validates sections, and returns draft body fields.

Later workflows can branch by:

- channel constraints;
- modality requirements;
- column risk policy;
- human approval checkpoints;
- asset availability.

## Data Flow

Topic generation:

```text
Renderer button
-> Electron IPC
-> ContentLoopRepository.generateTopics(columnSlug)
-> ContentAgentRuntime.generateTopics(...)
-> repository maps structured output into Topic and SourceReference
-> fallback to generateMockTopics on runtime failure
-> persisted state returned to renderer
```

Draft generation:

```text
Renderer button
-> Electron IPC
-> ContentLoopRepository.generateDraftPackage(projectId)
-> repository loads project, topic, source references, next version
-> ContentAgentRuntime.generateDraft(...)
-> repository maps structured output into DraftVersion
-> fallback to generateMockDraftPackage on runtime failure
-> persisted state returned to renderer
```

## Structured Output

The runtime should return objects with explicit fields.

Topic candidate:

```ts
interface AgentTopicCandidate {
  title: string;
  hook: string;
  audience: string;
  targetPlatforms: Platform[];
  score: TopicScore;
  sourceNotes: string[];
  riskNotes: string[];
  verificationNotes: string[];
}
```

Draft package:

```ts
interface AgentDraftPackage {
  brief: string;
  titleOptions: string[];
  bodyDraft: string;
  coverCopy: string;
  tags: string[];
  visualDirection: string;
  pendingVerification: string[];
}
```

Mapping into current `DraftVersion.body` can remain plain text in the first slice. Later, if editing and comparison need richer behavior, add structured draft sections to the domain model.

## Error Handling

Runtime failures must not block the desktop workflow.

Fallback rules:

- Missing runtime config: use mock runtime.
- Missing API key: use mock runtime.
- Runtime error: log in main process and use deterministic fallback.
- Invalid structured result: log validation failure and use deterministic fallback.
- Repository missing project or draft context: preserve current behavior and return unchanged state.

The first UI slice should not surface provider errors. A future settings screen can expose runtime health and diagnostics.

## Security

- Keep API keys in the Electron main process only.
- Renderer and preload do not receive model provider clients, secrets, or raw runtime configuration.
- Runtime tools must be allowlisted. The first slice should not give agents filesystem, shell, browser, or network tools beyond model calls.
- Channel publishing remains manual.
- Finance, fitness, parenting, and other sensitive columns should include risk and verification notes in prompts and output schema.

## Testing

Core and agent-runtime tests:

- mock runtime returns deterministic structured topic output.
- mock runtime returns deterministic structured draft output.
- Mastra runtime adapter can be constructed without leaking provider details into core types.
- runtime output validation rejects missing required fields.

Local-store tests:

- repository calls configured runtime for topic generation.
- repository falls back to existing mock topic generation when runtime fails.
- repository calls configured runtime for draft generation.
- repository falls back to existing mock draft generation when runtime fails.
- SQLite persistence still stores generated topics, source references, and drafts across repository instances.

Desktop tests:

- existing IPC and renderer tests keep passing without runtime config.
- runtime config remains main-process only.

Verification commands:

```bash
npm test
npm run typecheck
npm run build
```

## Implementation Strategy

Phase 1: Runtime boundary.

- Add `packages/agent-runtime`.
- Add mock runtime and output validation.
- Inject runtime into in-memory and SQLite repositories.
- Keep UI unchanged.

Phase 2: Mastra topic and draft workflows.

- Install Mastra dependencies.
- Add topic and draft agents.
- Add workflows with structured output.
- Enable with environment variables.
- Preserve fallback.

Phase 3: Workflow matrix foundation.

- Add workflow descriptors for channel, modality, and column combinations.
- Start with image/text Xiaohongshu and WeChat Official Account variants.
- Add short-video planning outputs before adding asset generation.

Phase 4: Human-in-the-loop and observability.

- Persist workflow run metadata.
- Add approval checkpoints for risk-sensitive columns and platform packages.
- Add runtime diagnostics in a settings or system screen.

## Success Criteria

This design is complete when:

1. Robert Station has a framework-neutral agent runtime package.
2. Mastra is available behind that package without leaking into renderer or core domain logic.
3. Topic and draft generation can use runtime-backed structured outputs.
4. Missing runtime configuration and runtime failures keep the app usable through deterministic fallback.
5. Tests cover runtime use, fallback, and persistence.
6. The architecture can later branch by channel, modality, and column without replacing the runtime boundary.
