# 2026-04-05 Settings Center

## Summary
- Replaced the old single-page `/settings` form with a nested settings center in `apps/app`.
- Added internal settings navigation with `General` and `Providers` sections.
- Introduced provider detail pages for API key and model configuration.
- Migrated local settings storage from flat keys to `otter.settings.v2` while keeping legacy values readable for one-time migration.

## Architecture Notes
- `/settings` is now a layout route with child routes:
  - `/settings/general`
  - `/settings/providers`
  - `/settings/providers/:providerId`
- Provider metadata is seeded locally through `app/lib/provider-catalog.ts`.
- Runtime consumers now read provider/model/api-key through `getEffectiveProviderConfig()` instead of flat `AppSettings` fields.
- `serviceBaseUrl` remains stored through the existing dedicated key and is projected into the nested settings object.

## UI Notes
- The settings center keeps the existing Claude-inspired warm editorial visual language from `DESIGN.md`.
- Desktop uses a sticky internal sidebar; mobile uses a sheet-triggered section menu.
- The final layout avoids card containers and right-side content panels; the `Settings` title sits above the whole settings area, with the content rendered directly on the page background.
- Provider model rows are edited inline inside the provider detail page, with capped desktop scrolling for long model lists.

## Verification
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @otter-prompt/app typecheck`

## Follow-ups
- Server runtime still has native provider execution only for OpenAI; catalog entries for other providers are configuration-only for now.
- If remote provider/model metadata is needed later, add a sync layer on top of the local catalog instead of replacing the storage shape again.
