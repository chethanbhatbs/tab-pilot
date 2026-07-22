# Tab Radar Privacy Policy

Last updated: 2026-07-22

## Summary

Tab Radar runs entirely inside your browser. It collects nothing, transmits nothing, and has no servers.

## What Tab Radar accesses, and why

Tab Radar reads your open tabs, windows, and tab groups to display and manage them (that is the product). With your use of specific features it also stores, locally only:

- Settings, tab notes, window names, workspaces, and saved sessions (`chrome.storage.local`)
- Focus Mode state (`chrome.storage.local`)
- Per-domain active time, measured while a tab is focused and you are not idle, kept for about 35 days (`chrome.storage.local`)
- Browsing history summaries, read via the `history` permission, only to render the Activity heatmap inside the panel

## What Tab Radar does NOT do

- No data ever leaves your machine. The extension makes zero network requests. Favicons are read from Chrome's local favicon cache via Chrome's built-in `_favicon` API, so not even the domains of your tabs are sent to any favicon service.
- No analytics, no telemetry, no error reporting, no tracking of any kind.
- No content scripts and no host permissions: Tab Radar cannot read or modify the web pages you visit.
- No accounts, no sign-in, no cookies.

## Optional profile switching (native messaging)

The Chrome profile switcher is off by default. If you enable it, Tab Radar asks Chrome for the optional `nativeMessaging` permission and talks to a small helper script that you install yourself from this repository. The helper reads Chrome's local profile list (names and avatars only, from Chrome's `Local State` file) and can launch Chrome with a chosen profile. It reads no passwords, history, or browsing data, and makes no network requests. Decline the permission or uninstall the helper at any time (`native-host/uninstall.sh`).

## Data removal

All data lives in `chrome.storage.local`. Uninstalling the extension deletes it.

## Contact

Questions or concerns: open an issue at https://github.com/chethanbhatbs/tab-radar/issues
