# AGENTS.md

## Project Overview

This is a monorepo using pnpm with Turbo for task orchestration, containing:

- **apps/web**: Astro static site generator
- **apps/app**: React Router v7 web application (main app)
- **apps/desktop**: Wails3 Go desktop application
- **packages/ui**: Shared UI component library using shadcn/ui

## Build/Lint/Test Commands

### Root commands (run from project root)

```bash
pnpm build          # Build all packages
pnpm dev            # Start web dev server
pnpm format         # Format all code with Prettier
pnpm typecheck      # Type check all packages
```

### Web app (apps/web)

```bash
pnpm --filter web dev            # Start development server
pnpm --filter web build          # Build for production
pnpm --filter web typecheck      # Type check
pnpm --filter web format         # Format web app code
```

### Main app (apps/app)

```bash
pnpm --filter @otter-prompt/app dev            # Start development server
pnpm --filter @otter-prompt/app build         # Build for production
pnpm --filter @otter-prompt/app typecheck     # Type check
pnpm --filter @otter-prompt/app format         # Format app code
pnpm --filter @otter-prompt/app start          # Start production server
```

### UI package (packages/ui)

```bash
pnpm --filter @workspace/ui typecheck   # Type check UI package
pnpm --filter @workspace/ui format      # Format UI package code
```

### Desktop app (apps/desktop)

```bash
cd apps/desktop && wails3 dev     # Start desktop dev mode
cd apps/desktop && wails3 build   # Build desktop app
cd apps/desktop && task build     # Alternative build via Taskfile
```

### Adding shadcn components

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

This places components in `packages/ui/src/components/`.

### Testing

**Note:** No test framework is currently configured. When tests are added, use:

```bash
pnpm test              # Run all tests
pnpm test <file>       # Run single test file
```

## Code Style Guidelines

### TypeScript/React

**Imports:**

- Use workspace imports: `import { Button } from "@workspace/ui/components/button"`
- Use path aliases in web app: `import { something } from "@/lib/utils"`
- Group imports: external packages first, then internal imports
- Use verbatim module syntax for type-only imports: `import { type SomeType } from "./module"`

**Formatting (Prettier):**

- No semicolons
- Double quotes for strings
- Trailing commas (ES5)
- Print width: 80 characters
- Tab width: 2 spaces
- LF line endings

**Types:**

- Strict mode enabled
- Use `type` for type-only imports
- Use `interface` for object shapes that can be extended
- Use `type` for unions, intersections, and utility types

**Naming:**

- Components: PascalCase (`Button.tsx`)
- Utilities/hooks: camelCase (`useSomething.ts`)
- Files: lowercase with dashes for multi-word (`button-group.tsx`)

**Components:**

- Use `data-slot` attribute for component identification
- Use `cn()` utility for conditional class merging
- Export components and variants separately: `export { Button, buttonVariants }`
- Use `cva` (class-variance-authority) for variant-based styling

**Error Handling:**

- Use React Router's `ErrorBoundary` for route-level errors
- Check `isRouteErrorResponse()` for route errors
- Show stack traces only in DEV mode

### Go (Desktop App)

**Structure:**

- Services are structs with methods exposed to frontend
- Register services in `main.go` via `application.NewService()`
- Use `//go:embed` for embedding frontend assets

**Naming:**

- Exported functions/services: PascalCase
- Package name: `main` for entry point

**Error Handling:**

- Use `log.Fatal(err)` for startup errors
- Services should return errors as last return value when applicable

## Project Structure

```
otter-prompt-ai/
├── apps/
│   ├── web/                    # Astro static site
│   │   ├── src/
│   │   │   └── pages/         # Astro pages
│   │   └── astro.config.mjs
│   ├── app/                   # React Router v7 app (main application)
│   │   ├── app/
│   │   │   ├── root.tsx       # Root layout
│   │   │   ├── routes.ts      # Route config
│   │   │   └── routes/        # Route components
│   │   ├── vite.config.ts
│   │   └── react-router.config.ts
│   └── desktop/                # Wails3 Go desktop app
│       ├── main.go             # Entry point
│       ├── *.go                # Service files
│       ├── Taskfile.yml        # Task runner config
│       └── build/              # Build configs per platform
├── packages/
│   └── ui/                     # Shared UI components
│       └── src/
│           ├── components/     # React components
│           ├── lib/            # Utilities (cn, etc.)
│           └── styles/         # Global CSS
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # Workspace config
├── turbo.json                  # Turbo task configuration
└── tsconfig.json               # Base TypeScript config
```

## Important Notes

- Always run `pnpm typecheck` after making changes to verify types
- Run `pnpm format` before committing to ensure consistent formatting
- Desktop app requires building all packages first: `pnpm build && cd apps/desktop && wails3 build`
- Use `@workspace/ui` package for shared components across apps
- Tailwind CSS v4 is used with the `@tailwindcss/vite` plugin
