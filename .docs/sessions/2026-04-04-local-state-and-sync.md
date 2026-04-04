# Session: Local Shared State, Browser API Key, and Manual Cloud Sync

Date: 2026-04-04

## Decisions implemented
- CLI and Desktop share local state at `~/.otter/state.json`.
- Legacy `~/.otter/projects.json` auto-migrates to `state.json` on first read.
- API key can be provided from browser storage and is sent via `x-otter-api-key`.
- Manual cloud sync endpoints are implemented: push, pull, status.
- Pull conflict policy keeps local file and writes incoming remote content to `*.conflict-<timestamp>`.
- Cloud sync server persists remote snapshots in `~/.otter/cloud-state.json`.

## Desktop bridge notes
- Added keychain methods in Wails bridge (`SetApiKey`, `GetApiKey`, `ClearApiKey`) for macOS security keychain.
- Added bridge endpoint return (`LocalEndpoint`) and retained external editor opening.
