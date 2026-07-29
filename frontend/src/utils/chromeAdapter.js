/**
 * Chrome Tabs Adapter
 * Detects if running as a Chrome extension or web preview.
 * In extension context: uses real chrome.tabs/windows/tabGroups APIs.
 * In web context: falls back to mock data.
 */

import { normalizeUrl } from './grouping';

const IS_EXTENSION = typeof chrome !== 'undefined' && !!chrome?.tabs?.query;

export function isExtensionContext() {
  return IS_EXTENSION;
}

/**
 * Single source of truth for the version shown in the UI. In the packaged
 * extension it comes straight from manifest.json; in the web build it comes from
 * REACT_APP_VERSION (build-extension.sh injects it from the same manifest).
 * Returns null when neither is available so callers can hide the badge rather
 * than print a stale number.
 */
export function getAppVersion() {
  if (IS_EXTENSION) {
    try {
      const v = chrome.runtime?.getManifest?.()?.version;
      if (v) return v;
    } catch { /* fall through */ }
  }
  return process.env.REACT_APP_VERSION || null;
}

// --- Real Chrome API wrappers ---

/**
 * Get all windows by grouping tabs (uses only `tabs` permission — more reliable than
 * chrome.windows.getAll which can fail silently without the `windows` permission being granted).
 */
export async function chromeGetAllWindows() {
  // Step 1: Get ALL tabs from ALL windows — requires only `tabs` permission
  const allTabs = await chrome.tabs.query({});

  // Step 2: Group tabs by windowId (skip tabs with invalid windowId)
  const windowMap = new Map();
  allTabs.forEach(tab => {
    if (!tab.windowId || tab.windowId === -1) return;
    if (!windowMap.has(tab.windowId)) {
      windowMap.set(tab.windowId, {
        id: tab.windowId,
        type: 'normal',
        focused: false,
        state: 'normal',
        tabs: [],
      });
    }
    windowMap.get(tab.windowId).tabs.push(tab);
  });

  // Step 3: Enrich with window metadata (focused, state, type) — best-effort
  try {
    const winInfos = await chrome.windows.getAll({ populate: false });
    winInfos.forEach(w => {
      if (windowMap.has(w.id)) {
        const entry = windowMap.get(w.id);
        entry.focused = w.focused;
        entry.state   = w.state || 'normal';
        entry.type    = w.type  || 'normal';
      }
    });
  } catch {
    // If windows API unavailable, mark first window as focused
    const first = windowMap.values().next().value;
    if (first) first.focused = true;
  }

  // Step 4: Only normal windows, focused first
  return Array.from(windowMap.values())
    .filter(w => w.type === 'normal' || w.type === undefined)
    .sort((a, b) => Number(b.focused) - Number(a.focused));
}

export async function chromeGetTabGroups() {
  try {
    return await chrome.tabGroups.query({});
  } catch {
    return [];
  }
}

export async function chromeSwitchToTab(tabId, windowId) {
  await chrome.tabs.update(tabId, { active: true });
  if (windowId) {
    await chrome.windows.update(windowId, { focused: true });
    // Ensure side panel stays open in the target window — without this,
    // switching to a tab in another window closes the panel
    try { await chrome.sidePanel.open({ windowId }); } catch {}
  }
}

export async function chromeCloseTab(tabId) {
  await chrome.tabs.remove(tabId);
}

/** Close many tabs in one call instead of one round-trip per tab. */
export async function chromeCloseTabs(tabIds) {
  if (!tabIds || tabIds.length === 0) return 0;
  await chrome.tabs.remove(tabIds);
  return tabIds.length;
}

export async function chromePinTab(tabId, pinned) {
  await chrome.tabs.update(tabId, { pinned });
}

export async function chromeMuteTab(tabId, muted) {
  await chrome.tabs.update(tabId, { muted });
}

export async function chromeDuplicateTab(tabId) {
  await chrome.tabs.duplicate(tabId);
}

export async function chromeMoveTab(tabId, windowId, index = -1) {
  await chrome.tabs.move(tabId, { windowId, index });
}

export async function chromeMoveTabToNewWindow(tabId) {
  await chrome.windows.create({ tabId });
}

export async function chromeCreateNewTab(windowId) {
  await chrome.tabs.create({ windowId });
}

export async function chromeCreateTabInWindow(windowId) {
  await chrome.tabs.create({ windowId, index: 0 });
}

export async function chromeCreateNewWindow() {
  await chrome.windows.create({});
}

export async function chromeCloseWindow(windowId) {
  await chrome.windows.remove(windowId);
}

export async function chromeMinimizeWindow(windowId, currentState) {
  const newState = currentState === 'minimized' ? 'normal' : 'minimized';
  await chrome.windows.update(windowId, { state: newState });
}

export async function chromeUndoCloseTab() {
  return (await chromeUndoCloseTabs(1)) > 0;
}

/**
 * Undo a bulk close: restore the most recently closed sessions until roughly
 * `tabCount` tabs are back. Chrome may record a batch close as one window entry
 * rather than N tab entries, so we count each entry's own tabs and stop as soon
 * as the target is met — otherwise an undo of 10 could drag back older closures
 * the user never asked for. Chrome caps getRecentlyClosed at 25 entries.
 * Returns the approximate number of tabs restored.
 */
export async function chromeUndoCloseTabs(tabCount = 1) {
  const want = Math.max(1, Math.min(tabCount, 25));
  let restoredTabs = 0;
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: want });
    for (const s of sessions) {
      if (restoredTabs >= tabCount) break;
      const sessionId = s.tab?.sessionId || s.window?.sessionId;
      if (!sessionId) continue;
      const size = s.window?.tabs?.length || 1;
      // One bad session id must not abort the rest of the restore.
      try { await chrome.sessions.restore(sessionId); restoredTabs += size; } catch { /* skip */ }
    }
  } catch { /* sessions API unavailable */ }
  return restoredTabs;
}

// Storage helpers for persisting notes and window names
export function chromeStorageGet(keys) {
  if (!IS_EXTENSION) return Promise.resolve({});
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

export function chromeStorageSet(data) {
  if (!IS_EXTENSION) return;
  chrome.storage.local.set(data);
}

export async function chromeMuteAll() {
  const tabs = await chrome.tabs.query({ audible: true });
  for (const t of tabs) {
    await chrome.tabs.update(t.id, { muted: true });
  }
}

export async function chromeUnmuteAll() {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.mutedInfo?.muted) {
      await chrome.tabs.update(t.id, { muted: false });
    }
  }
}

export async function chromeCloseDuplicates() {
  const tabs = await chrome.tabs.query({});
  const groups = {};
  for (const tab of tabs) {
    if (!tab.url) continue;
    // Use the SAME duplicate rule as the rest of the app (full URL minus #hash).
    // Previously this grouped by origin, which closed unrelated pages on the
    // same site (e.g. gmail.com/inbox vs gmail.com/compose) — data loss.
    const normalized = normalizeUrl(tab.url);
    if (!normalized) continue;
    if (!groups[normalized]) groups[normalized] = [];
    groups[normalized].push(tab);
  }
  const toClose = [];
  for (const group of Object.values(groups)) {
    if (group.length <= 1) continue;
    // Keep the active tab, else the most recently accessed copy.
    const keep = group.find(t => t.active)
      || [...group].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    for (const t of group) { if (t.id !== keep.id) toClose.push(t.id); }
  }
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  return toClose.length;
}

export async function chromeSplitTabs(tabIds) {
  if (!tabIds || tabIds.length < 2) return;
  const [leftTabId, rightTabId] = tabIds;
  const [leftTab, rightTab] = await Promise.all([chrome.tabs.get(leftTabId), chrome.tabs.get(rightTabId)]);
  const currentWin = await chrome.windows.getCurrent();
  const top = currentWin.top || 0;
  const left = currentWin.left || 0;
  const totalW = currentWin.width || 1280;
  const totalH = currentWin.height || 800;
  const halfW = Math.floor(totalW / 2);
  await chrome.tabs.update(leftTabId, { active: true });
  if (leftTab.windowId === rightTab.windowId) {
    await chrome.windows.update(leftTab.windowId, { state: 'normal', left, top, width: halfW, height: totalH });
    const rightWin = await chrome.windows.create({ tabId: rightTabId, left: left + halfW, top, width: halfW, height: totalH, focused: true, state: 'normal' });
    await chrome.windows.update(leftTab.windowId, { focused: true });
    await chrome.windows.update(rightWin.id, { focused: true });
  } else {
    await chrome.windows.update(leftTab.windowId, { state: 'normal', left, top, width: halfW, height: totalH, focused: true });
    await chrome.tabs.update(rightTabId, { active: true });
    await chrome.windows.update(rightTab.windowId, { state: 'normal', left: left + halfW, top, width: halfW, height: totalH, focused: true });
  }
}

// Focus mode / workspace: hide non-focus tabs by grouping & collapsing
// Groups per-window since chrome.tabs.group only works within a single window
export async function chromeHideTabs(tabIds) {
  if (!tabIds.length) return null;
  try {
    // Get tab details to group by window
    const allTabs = await chrome.tabs.query({});
    const tabMap = new Map(allTabs.map(t => [t.id, t]));
    const byWindow = new Map();
    for (const id of tabIds) {
      const tab = tabMap.get(id);
      if (!tab) continue;
      if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
      byWindow.get(tab.windowId).push(id);
    }

    const groupIds = [];
    for (const [windowId, winTabIds] of byWindow) {
      try {
        // Don't hide ALL tabs in a window — Chrome won't allow it
        const windowTabs = allTabs.filter(t => t.windowId === windowId);
        const remainingVisible = windowTabs.filter(t => !winTabIds.includes(t.id));
        if (remainingVisible.length === 0) continue;

        // Ensure active tab in this window is NOT one we're about to hide
        // (Chrome can't collapse a group containing the active tab)
        const activeTab = windowTabs.find(t => t.active);
        if (activeTab && winTabIds.includes(activeTab.id)) {
          // Activate a visible tab first
          const switchTo = remainingVisible[0];
          if (switchTo) {
            await chrome.tabs.update(switchTo.id, { active: true });
          }
        }

        const groupId = await chrome.tabs.group({ tabIds: winTabIds });
        await chrome.tabGroups.update(groupId, { collapsed: true, title: 'Hidden', color: 'grey' });
        try { await chrome.tabGroups.move(groupId, { index: -1 }); } catch {}
        groupIds.push(groupId);
      } catch (e) {
        console.error('chromeHideTabs window error:', windowId, e);
      }
    }
    return groupIds.length === 1 ? groupIds[0] : groupIds;
  } catch (e) {
    console.error('chromeHideTabs error:', e);
    return null;
  }
}

// Ungroup ALL tabs in every "Hidden" group across all windows.
// This is the only reliable way — stored tab IDs can go stale.
export async function chromeUnhideTabs() {
  try {
    const groups = await chrome.tabGroups.query({});
    const hiddenGroups = groups.filter(g => g.title === 'Hidden');
    if (hiddenGroups.length === 0) return;

    const allTabs = await chrome.tabs.query({});
    for (const group of hiddenGroups) {
      const groupTabs = allTabs.filter(t => t.groupId === group.id);
      if (groupTabs.length > 0) {
        try {
          await chrome.tabs.ungroup(groupTabs.map(t => t.id));
        } catch {
          // Try individually if bulk fails
          for (const t of groupTabs) {
            try { await chrome.tabs.ungroup([t.id]); } catch {}
          }
        }
      }
    }
  } catch (e) {
    console.error('chromeUnhideTabs error:', e);
  }
}

function isRestorableUrl(url) {
  if (!url) return false;
  // Chrome blocks extensions from opening these URL schemes
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('about:') || url.startsWith('javascript:') ||
      url.startsWith('data:') || url.startsWith('file:')) {
    return false;
  }
  return true;
}

export async function chromeRestoreSession(session) {
  if (!session?.windows?.length) return 0;
  let tabCount = 0;
  for (const win of session.windows) {
    if (!win.tabs?.length) continue;
    try {
      // Filter to restorable tabs only
      const restorableTabs = win.tabs.filter(t => isRestorableUrl(t.url));
      if (restorableTabs.length === 0) continue;

      // Create window with the first restorable tab
      const firstTab = restorableTabs[0];
      const newWin = await chrome.windows.create({ url: firstTab.url, focused: false });
      if (firstTab.pinned && newWin.tabs?.[0]) {
        try { await chrome.tabs.update(newWin.tabs[0].id, { pinned: true }); } catch {}
      }
      tabCount++;

      // Add remaining tabs sequentially with small delay for stability
      for (let i = 1; i < restorableTabs.length; i++) {
        const t = restorableTabs[i];
        try {
          await chrome.tabs.create({
            windowId: newWin.id,
            url: t.url,
            pinned: t.pinned || false,
            active: false,
          });
          tabCount++;
        } catch (err) {
          console.warn('chromeRestoreSession tab error:', t.url, err);
        }
      }
      // Focus the window after all tabs are created
      try { await chrome.windows.update(newWin.id, { focused: true }); } catch {}
    } catch (e) {
      console.error('chromeRestoreSession window error:', e);
    }
  }
  return tabCount;
}

/** Returns whether the tab was actually discarded — Chrome refuses some. */
export async function chromeDiscardTab(tabId) {
  try {
    await chrome.tabs.discard(tabId);
    return true;
  } catch {
    // Tab might not be discardable
    return false;
  }
}

// Un-suspend a tab: reloading a discarded tab loads it back into memory
// without switching to it (so "Resume all" doesn't yank focus around).
export async function chromeReloadTab(tabId) {
  try {
    await chrome.tabs.reload(tabId);
  } catch {
    // Tab might be gone
  }
}

// Listen for tab changes — background service worker also notifies us via message
// IMPORTANT: Only listen to tab events here. Window events (onCreated, onRemoved,
// onFocusChanged) are handled by background.js which sends us a message. Listening
// to them directly here would cause DOUBLE-FIRING and excessive refreshes that lag
// the side panel and can cause Chrome to kill it.
export function chromeOnTabsUpdated(callback) {
  if (!IS_EXTENSION) return () => {};

  // Background message (from service worker — covers both tab AND window events)
  const msgHandler = (msg) => { if (msg?.action === 'tabs-updated') callback(); };
  chrome.runtime.onMessage.addListener(msgHandler);

  // Direct tab events (backup in case service worker is suspended)
  const tabEvents = [
    chrome.tabs.onCreated,
    chrome.tabs.onRemoved,
    chrome.tabs.onUpdated,
    chrome.tabs.onMoved,
    chrome.tabs.onActivated,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
  ];
  tabEvents.forEach(e => e?.addListener(callback));

  return () => {
    chrome.runtime.onMessage.removeListener(msgHandler);
    tabEvents.forEach(e => e?.removeListener(callback));
  };
}

// --- Native Messaging: Chrome Profile Management ---

const NATIVE_HOST_NAME = 'com.tabpilot.profiles';

// nativeMessaging is an OPTIONAL permission — nothing native is reachable until
// the user explicitly grants it from the Profiles panel (keeps the install-time
// permission warning small and the Chrome Web Store review clean).
export async function chromeHasNativePermission() {
  if (!IS_EXTENSION || !chrome?.permissions?.contains) return false;
  try {
    return await chrome.permissions.contains({ permissions: ['nativeMessaging'] });
  } catch {
    return false;
  }
}

// Must be called from a user gesture (button click) or Chrome rejects it.
export async function chromeRequestNativePermission() {
  if (!IS_EXTENSION || !chrome?.permissions?.request) return false;
  try {
    return await chrome.permissions.request({ permissions: ['nativeMessaging'] });
  } catch {
    return false;
  }
}

function sendNativeMessage(message) {
  if (!IS_EXTENSION || !chrome?.runtime?.sendNativeMessage) return Promise.resolve(null);
  const timeout = new Promise(resolve =>
    setTimeout(() => resolve({ error: 'Native host timeout' }), 5000)
  );
  const msg = new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      resolve({ error: e.message || 'Native messaging unavailable' });
    }
  });
  return Promise.race([msg, timeout]);
}

export async function chromeNativeHostPing() {
  return await sendNativeMessage({ action: 'ping' });
}

export async function chromeGetProfiles() {
  return await sendNativeMessage({ action: 'get-profiles' });
}

export async function chromeSwitchProfile(profileDirectory, openUrl) {
  const msg = { action: 'switch-profile', profileDirectory };
  if (openUrl) msg.openUrl = openUrl;
  return await sendNativeMessage(msg);
}

export async function chromeDetectProfile() {
  const extensionId = chrome?.runtime?.id || '';
  return await sendNativeMessage({ action: 'detect-profile', extensionId });
}

export async function chromeCreateProfile() {
  return await sendNativeMessage({ action: 'create-profile' });
}

// Bookmark API wrappers
export async function chromeGetBookmarkTree() {
  if (!IS_EXTENSION) return [];
  try { return await chrome.bookmarks.getTree(); } catch { return []; }
}

export async function chromeGetBookmarkFolders() {
  if (!IS_EXTENSION) return [];
  try {
    const tree = await chrome.bookmarks.getTree();
    const folders = [];
    function walk(nodes, depth = 0) {
      for (const node of nodes) {
        if (node.children) {
          folders.push({ id: node.id, title: node.title || 'Bookmarks', depth });
          walk(node.children, depth + 1);
        }
      }
    }
    walk(tree);
    return folders;
  } catch { return []; }
}

export async function chromeSearchBookmarks(url) {
  if (!IS_EXTENSION) return [];
  try { return await chrome.bookmarks.search({ url }); } catch { return []; }
}

export async function chromeCreateBookmark(url, title, parentId) {
  if (!IS_EXTENSION) return null;
  try {
    return await chrome.bookmarks.create({ url, title, parentId: parentId || undefined });
  } catch { return null; }
}

export async function chromeRemoveBookmark(bookmarkId) {
  if (!IS_EXTENSION) return;
  try { await chrome.bookmarks.remove(bookmarkId); } catch {}
}

export async function chromeGetAllBookmarks() {
  if (!IS_EXTENSION) return [];
  try {
    const tree = await chrome.bookmarks.getTree();
    const bookmarks = [];
    function walk(nodes) {
      for (const node of nodes) {
        if (node.url) bookmarks.push(node);
        if (node.children) walk(node.children);
      }
    }
    walk(tree);
    return bookmarks;
  } catch { return []; }
}
