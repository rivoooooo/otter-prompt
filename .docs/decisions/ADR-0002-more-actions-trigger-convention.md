# ADR-0002: More Actions Trigger Convention

## Status

Accepted (2026-04-05)

## Context

The app has several places where secondary actions are grouped into a dropdown menu. A text trigger such as `Actions` is functional, but the preferred visual affordance is a compact overflow control that reads as "more actions" without competing with the primary content.

## Decision

- In `apps/app`, overflow or secondary action menus should prefer a three-dot icon trigger.
- Use an icon-only button with accessible labeling such as `aria-label="More actions"` or a context-specific label like `Project actions`.
- Keep the dropdown menu items text-based; only the trigger should collapse into the three-dot affordance.
- Prefer this pattern in dense surfaces such as list rows, section headers, sidebars, and workspace chrome.

## Consequences

- Secondary actions stay visually subordinate to the primary task flow.
- Header areas remain more compact and consistent across the app.
- Implementations need to preserve accessibility when using icon-only triggers.
