# Session: Directory Picker Defaults and Lazy Loading

Date: 2026-04-05

## Decisions implemented
- Project folder picker defaults to roots built from `~`, saved project directories, and each project parent directory.
- Added lazy-loading directory APIs for roots and per-directory children.
- Children are loaded one level at a time to avoid full recursive scans.
- Hidden directories are hidden by default and can be toggled in the app dialog.
- System picker remains optional; in practice the in-app browser is now the primary path.
- Core CLI server and Nitro server now expose the same directory browsing endpoints.
