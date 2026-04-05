# Playground AI Elements Refactor

## Summary

- Replaced the app playground's hand-rolled text chat with AI SDK UI message streaming.
- Switched the app playground and cluster surfaces to the official AI Elements component source under `apps/app/components/ai-elements`.
- Added a new `POST /chat/ui` core-server endpoint that accepts full message arrays, injects project `main.md`, and streams UI messages back to the client.
- Added `POST /chat/uploads` plus `GET /chat/uploads/:id` to support attachment upload, preview, and server-side temporary caching.
- Reworked `Cluster Test` to use the same message model and attachment pipeline as the main playground.

## Key Decisions

- Kept attachments out of the project workspace by storing them in a temp cache with a short TTL.
- The client now uploads files first and sends only `upload-ref` message parts into `/chat/ui`.
- On the server, image upload refs are hydrated back into file parts, text upload refs are read into model text parts, and other files are exposed to the model as attachment metadata.
- Preserved the legacy `/chat/stream` endpoint for backward compatibility while moving the playground to `/chat/ui`.

## Follow-up Notes

- The app now relies on `@ai-sdk/react` in `apps/app` and AI SDK provider packages in `packages/core-server`.
- The styling layer uses `streamdown` through `packages/ui/src/styles/globals.css` for markdown rendering inside messages.
- `pnpm install --config.bin-links=false --offline`, `CI=true pnpm typecheck`, `CI=true pnpm --filter @otter-prompt/app build`, `node --check packages/core-server/src/server.mjs`, and `node --check packages/core-server/src/ai/ai-client.mjs` all completed successfully.
