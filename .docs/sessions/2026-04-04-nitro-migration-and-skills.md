# Session: Nitro Migration, Service Base URL Settings, and Project Skill Lock

Date: 2026-04-04

## Decisions implemented
- Added project-level skill lock by installing `shadcn/ui@shadcn` with `skills` CLI.
- Kept skill artifacts out of git and tracked only `skills-lock.json`.
- Introduced `@otter-prompt/server` using Nitro file-based routes.
- Kept existing API semantics while moving route maintenance into Nitro route files.
- Added app settings page for changing service base URL at runtime.
- Added shared API client in app to centralize baseURL and headers.

## Notes
- Nitro is configured with `apiBaseURL: "/"` so existing endpoint paths remain compatible.
- Root package scripts now include `dev:server`, `skills:restore`, and `skills:sync`.
