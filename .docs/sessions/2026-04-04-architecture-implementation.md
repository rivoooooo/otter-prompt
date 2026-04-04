# Session: Node Core + Cloud + Desktop Shell

Date: 2026-04-04

## Decisions implemented
- `apps/web` remains the official website.
- `apps/app` is the product app surface (projects + file tree + editor + AI chat).
- Introduced `@otter-prompt/core-server` as auth-agnostic Node runtime.
- Introduced `@otter-prompt/cloud-server` as cloud wrapper with auth surface placeholders.
- Introduced `@otter-prompt/cli` with `otter web [--port]` and `otter init`.
- Desktop now exposes bridge capabilities and can point to app URL via `OTTER_APP_URL`.

## Notes
- `core-server` wraps file operations and AI chat stream endpoint.
- `cloud-server` contains compatibility auth endpoints and `/core/*` forwarding.
- better-auth integration is intentionally scaffolded for next iteration.
