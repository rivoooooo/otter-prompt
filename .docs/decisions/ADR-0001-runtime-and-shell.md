# ADR-0001: Runtime and Desktop Shell Strategy

## Status
Accepted (2026-04-04)

## Context
We need one product app across web, CLI local mode, and desktop shell while keeping implementation simple.

## Decision
- Use Node runtime as the primary backend implementation.
- Keep runtime core auth-agnostic in `@otter-prompt/core-server`.
- Layer cloud auth/team features in `@otter-prompt/cloud-server`.
- Desktop is a Wails shell with bridge APIs; business logic stays in Node runtime.
- Git integration is optional and not the source of truth for real-time collaboration.

## Consequences
- Faster feature parity across app/cli/desktop.
- Desktop packaging complexity shifts to embedding and launching Node runtime.
- better-auth integration can evolve independently in cloud layer.
