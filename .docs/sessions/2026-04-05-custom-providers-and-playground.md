# 2026-04-05 Custom Providers And Playground Runtime

## Summary

- Extended app settings from fixed provider catalog entries to support built-in and custom providers in the same store.
- Added provider-level API style, base URL, and model-level API style override support.
- Updated `project/:id` playground to select from all enabled provider/model combinations and inject root `main.md` as the system prompt.
- Moved `Cluster Test` into the playground `More` menu and aligned cluster runtime with the same model resolution flow.

## Architecture Notes

- Settings storage moved from `otter.settings.v2` to `otter.settings.v3`, with structured migration from `v2` and older flat keys.
- `ProviderSettings` now stores stable provider metadata (`id`, `label`, `source`, `apiStyle`, `baseUrl`) instead of relying on catalog lookups at runtime.
- `ModelSettings` now stores `apiStyleOverride`, allowing model-level protocol switching while inheriting provider defaults by default.
- Playground runtime options are derived through a single resolver that flattens enabled providers and models into request-ready entries.
- `/chat/stream` now accepts `providerId`, `apiStyle`, and `baseUrl`; runtime dispatch uses OpenAI-compatible requests via `@ai-sdk/openai` and Anthropic-compatible requests via direct SSE parsing.
- Root-level `main.md` is treated as the project-owned system prompt source for playground and project-linked cluster testing.

## UI Notes

- Settings provider list now includes an `Add Custom Provider` action and renders custom providers alongside built-ins.
- Provider detail pages now expose provider name, API style, base URL, API key, and model-level API style override controls.
- Playground shows a `Model Name` selector and a `System Prompt` status card so the active runtime configuration is visible before sending.

## Verification

- `pnpm --filter @otter-prompt/app typecheck`
- `pnpm typecheck`
- `pnpm build`

## Follow-ups

- Only root `main.md` is injected today; directory-wide variable or dynamic prompt composition should build on top of the same prompt-source hook instead of bypassing it.
- Anthropic-compatible runtime is implemented directly over HTTP SSE; if more provider-specific options are needed later, extract protocol adapters into dedicated modules.
