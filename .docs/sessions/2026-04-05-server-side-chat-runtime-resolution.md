# 2026-04-05 Server-Side Chat Runtime Resolution

## Summary

- Moved chat runtime composition from the frontend to the server.
- Frontend chat requests now send only `providerId`, `modelId`, `message`, and `projectId`.
- Server-side chat handling now resolves provider runtime settings from persisted app settings and loads root `main.md` for the target project.

## Architecture Notes

- Added `preferences.appSettings` to persisted core state so runtime provider settings are available to the server.
- Added `PUT /state/settings` to sync saved frontend settings into server state.
- Added a global app-side sync controller that pushes current app settings to the server on startup and whenever settings change.
- Added a server runtime resolver that:
  - resolves provider/model config by `providerId` + `modelId`
  - derives `apiStyle`, `baseUrl`, and `apiKey` on the server
  - injects project root `main.md` as the effective system prompt when `projectId` is provided

## UI Notes

- Playground and Cluster Test still use local settings to render available model choices.
- They no longer read prompt file contents or send raw runtime credentials in chat requests.
- Playground now only shows whether root `main.md` exists; actual prompt injection happens server-side.

## Verification

- `pnpm --filter @otter-prompt/app typecheck`
- `pnpm build`

## Follow-ups

- If chat should work before the settings sync controller finishes its initial request, add an explicit “runtime settings syncing” readiness check in the UI.
