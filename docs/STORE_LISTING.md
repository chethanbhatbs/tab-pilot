# Chrome Web Store listing (paste-ready)

Everything below is copy you paste into the Web Store Developer Dashboard.

## Product name
Tab Radar

## Category
Productivity → Tools

## Summary (short description, max 132 chars)
Find, switch, clean up, and focus your Chrome tabs from a keyboard-first side panel. 100% local, no tracking.

## Detailed description
Tab Radar is a keyboard-first command center for your tabs, living in the Chrome side panel so it is always one click away.

FIND & SWITCH
- Fuzzy search every open tab by title or URL
- Command palette (Cmd/Ctrl+K) for Spotlight-style quick switching
- Tab tree grouped by window, with Chrome tab groups shown inline

CLEAN UP
- One-click duplicate detection and close (smart matching treats different views of the same Google Doc/Sheet as duplicates)
- Multi-select and bulk close
- Suspend inactive tabs to free memory
- Auto-close idle tabs on a timer, with a domain whitelist

FOCUS
- Focus Mode dims everything except the tabs you choose; non-destructive, it never closes your content tabs
- Save and restore workspaces and full sessions

INSIGHTS
- Activity view: real page-visit trends and measured time-per-site, computed entirely on your machine

PRIVACY
- Runs entirely in your browser and makes zero network requests
- No analytics, no tracking, no external servers
- No host permissions and no content scripts: Tab Radar cannot read or change the pages you visit
- Favicons are read from Chrome's local cache
- All data stays in local storage on your device

Open source: https://github.com/chethanbhatbs/tab-radar

## Single purpose (Privacy tab)
Tab Radar is a side-panel tab manager: it lets users search, switch, organize, deduplicate, suspend, and focus their open Chrome tabs and windows.

## Permission justifications (Privacy tab — one per permission)
- tabs: Read and act on the user's open tabs (switch, close, move, pin, mute) — the core function.
- tabGroups: Collapse and create tab groups for Focus Mode and organization.
- history: Render the Activity view (the user's own visit trends), computed locally.
- favicon: Display tab icons from Chrome's local favicon cache (no network requests).
- sessions: Restore recently closed tabs (undo close).
- storage: Save settings, notes, workspaces, and sessions locally.
- idle: Pause the active-time tracker when the user steps away from the machine.
- alarms: Run auto-close and time-tracking checks periodically when the panel is closed.
- nativeMessaging (optional): Only requested if the user enables Chrome profile switching from the Profiles panel.

## Data usage (Privacy tab)
Tick: "I do not sell or transfer user data..." and, for every data category, leave collection unchecked.
Tab Radar does not collect, transmit, or sell any user data. It makes no network requests.

## Privacy policy URL
https://github.com/chethanbhatbs/tab-radar/blob/main/PRIVACY.md

## Screenshots
docs/store/01-overview.png (1280x800) — sidebar tab tree + product overview.
Add more if desired (1280x800 or 640x400): Command palette, Activity view, Focus Mode.
