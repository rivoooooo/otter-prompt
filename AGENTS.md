# Repository Guidelines

## Project Structure & Module Organization
This repo is a `pnpm` + Turborepo monorepo.

- `apps/app`: React Router app (`app/routes`, `app/root.tsx`).
- `apps/web`: Astro site (`src/pages`).
- `apps/desktop`: Wails v3 shell backend (`main.go`, `bridgeservice.go`) with frontend in `apps/desktop/frontend` (React + Vite).
- `apps/cli`: Node CLI entry (`otter web`, `otter init`).
- `packages/core-server`: Node core runtime (file I/O, AI test API, REST endpoints).
- `packages/cloud-server`: Cloud service layer (auth/team wrappers around core runtime).
- `packages/desktop-bridge`: Shared desktop bridge helpers for app integrations.
- `packages/ui`: Shared UI package (`src/components`, `src/lib`, `src/styles`).
- Root config: `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.json`, Prettier config.

Prefer placing reusable UI in `packages/ui` and importing via `@workspace/ui/...`.

## Build, Test, and Development Commands
Run commands from repo root unless noted.

- `pnpm dev`: Start all active dev tasks through Turbo.
- `pnpm dev:app`: Run only the React Router app (`@otter-prompt/app`).
- `pnpm dev:desktop`: Run Wails desktop app in dev mode.
- `pnpm build`: Build all packages/apps with Turbo.
- `pnpm typecheck`: Run workspace type checks.
- `pnpm format`: Run formatting tasks across packages.

Useful per-app examples:
- `pnpm --filter @otter-prompt/web dev`
- `cd apps/desktop && wails3 build`

## Coding Style & Naming Conventions
- TypeScript/React code uses Prettier (`.prettierrc`): 2 spaces, no semicolons, double quotes, `printWidth: 80`.
- Tailwind class sorting is handled by `prettier-plugin-tailwindcss`.
- Use `PascalCase` for React components, `camelCase` for variables/functions, and route files in lowercase (for example, `app/routes/home.tsx`).
- Keep shared primitives in `packages/ui/src/components`.

## Testing Guidelines
There is no dedicated test suite configured yet. Use these quality gates before opening PRs:

- `pnpm typecheck`
- `pnpm build`
- For desktop frontend changes, also run linting/configured checks in `apps/desktop/frontend`.

When adding tests, colocate them with source files using `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style seen in history:

- `feat: ...`
- `chore: ...`
- `docs: ...`

PRs should include:
- Clear summary of what changed and why.
- Linked issue/ticket when applicable.
- Screenshots or short recordings for UI changes (`apps/app`, `apps/web`, `apps/desktop/frontend`).
- Notes about verification steps run locally (for example, `pnpm typecheck && pnpm build`).

## Documentation Memory
- Planning and architecture discussions must be recorded under `.docs/`.
- Session notes go to `.docs/sessions/` with date-prefixed filenames.
- Durable architecture decisions go to `.docs/decisions/` as ADR files.
