# Session: New Folder Support and File API Unification

Date: 2026-04-05

## Decisions implemented
- Added folder creation support in directory picker via `POST /fs/directory`.
- Folder creation target is the currently selected directory.
- Duplicate folder names return conflict-style errors and are surfaced to UI.
- No delete actions were added to directory picker UI.
- Introduced shared core file API surface (`storage/fs-api.mjs`) to centralize file and directory operations.
- App frontend now consumes a shared `lib/fs-api.ts` wrapper for file/tree/directory endpoints.
- Nitro service and core CLI service both expose the same create-directory capability.
