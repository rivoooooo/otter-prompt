# Session: App UI Redesign, Settings Consolidation, and Cluster Test UX

Date: 2026-04-04

## Decisions implemented
- Reworked `apps/app` into a three-column layout using shared shadcn components.
- Left panel uses shadcn `Sidebar` and supports collapsed icon mode.
- Settings are centralized and reusable through one shared `SettingsForm` component.
- Settings are accessible in two forms: dialog and standalone `/settings` page.
- API key/provider/default model moved into Settings and stored in browser local storage.
- Added cluster test flow with configurable open mode (`dialog` or `/cluster` page).
- Added model suggestion support from backend `/models` endpoint with local manual input fallback.
- Chat requests now include `systemPrompt`, `provider`, and `model`; middle prompt is injected as system prompt.

## Memory update
- `DESIGN.md` is now the required reference before any future `apps/app` UI development.
- Button size policy: default size first, change only when explicitly required.
