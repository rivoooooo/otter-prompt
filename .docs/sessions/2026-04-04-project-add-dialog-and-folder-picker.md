# Session: Project Add Dialog + Node Folder Picker

Date: 2026-04-04

## Changes implemented
- Project add interaction in app sidebar now shows a single ghost Add button on the right of Project List.
- Clicking Add opens a dialog instead of inline path input.
- Dialog supports selecting a local folder through server-side Node dialog endpoint (`POST /dialog/directory`).
- Added cross-platform folder picker handling:
  - macOS: `osascript choose folder`
  - Windows: PowerShell `FolderBrowserDialog`
  - Linux: `zenity --file-selection --directory`
- Git-like sync actions (`Push` / `Pull`) are hidden from default sidebar UI.
