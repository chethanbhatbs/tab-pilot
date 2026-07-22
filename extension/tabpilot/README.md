# Tab Radar Chrome Extension — Installation Guide

Tab Radar is now positioned as a keyboard-first Chrome command center: search every
tab, jump across windows, clean duplicate tabs, start Focus Mode, and capture
workspaces without digging through the sidebar.

## Quick Install

1. **Get the extension folder**: `tabpilot/` (the folder containing `manifest.json`)
2. Open Chrome and go to: `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked** and select the `tabpilot/` folder
5. The Tab Radar icon appears in your toolbar
6. Open the sidebar: `Ctrl+Shift+E` (Windows/Linux) or `Cmd+Shift+E` (Mac)
7. `Ctrl+Shift+K` / `Cmd+Shift+K` also opens the side panel; press `Cmd+K` inside it for the command palette

## Features

- **Command Palette** — Search tabs and run actions from the side panel (`Cmd+K`)
- **Tab Tree** — All windows and tabs in a collapsible sidebar
- **Fuzzy Search** — Find any tab instantly (`Cmd+K` or `Ctrl+K`)
- **Workspaces** — Save and restore sets of tabs (`Ctrl+1/2/3`)
- **Focus Mode** — Hide distractions, set a timer
- **Heatmap** — See which tabs you use most
- **Tab Suspension** — Discard inactive tabs to free memory
- **Tab Notes** — Attach notes to any tab (persisted locally)
- **Duplicate Detection** — Find and close duplicate tabs
- **Undo Close** — Restore the last closed tab from a toast notification
- **Window Rename** — Double-click any window name to rename it

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` / `Cmd+Shift+E` | Toggle sidebar |
| `Ctrl+Shift+K` / `Cmd+Shift+K` | Open command center |
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Ctrl+1/2/3` | Switch workspace |

## Command Center Actions

- Search and switch to any tab across normal Chrome windows
- Close all duplicate tabs while keeping the first copy of each URL
- Start Focus Mode for the current tab or the current window
- Exit Focus Mode
- Save the current window as a workspace
- Restore the most recently saved workspace in a new window
- Open the full Tab Radar sidebar

## Reverting This Branch

This update was developed on the `codex-tab-radar-command-center` branch. To go
back to the previous extension state, switch back to `main`.

## Rebuilding After Code Changes

```bash
cd /app && bash build-extension.sh
```

## Permissions Required

| Permission | Why |
|-----------|-----|
| `tabs` | Read tab titles, URLs, status |
| `windows` | Manage browser windows |
| `tabGroups` | Show Chrome tab groups |
| `sidePanel` | Render sidebar |
| `storage` | Save notes and window names |
| `sessions` | Undo closed tabs |
| `activeTab` | Read active tab info |
