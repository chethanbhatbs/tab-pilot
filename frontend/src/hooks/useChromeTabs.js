import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Stable window index tracker — persists across re-renders, assigns sequential numbers
const windowIndexMap = {};
let nextWindowIdx = 1;
function getStableWindowIndex(windowId) {
  if (!windowIndexMap[windowId]) {
    windowIndexMap[windowId] = nextWindowIdx++;
  }
  return windowIndexMap[windowId];
}
import {
  isExtensionContext, chromeGetAllWindows, chromeGetTabGroups,
  chromeSwitchToTab, chromeCloseTab, chromePinTab, chromeMuteTab,
  chromeDuplicateTab, chromeMoveTab, chromeMoveTabToNewWindow,
  chromeCreateNewTab, chromeCreateTabInWindow, chromeCreateNewWindow,
  chromeCloseWindow, chromeMinimizeWindow, chromeMuteAll, chromeUnmuteAll,
  chromeCloseDuplicates, chromeRestoreSession, chromeDiscardTab, chromeReloadTab, chromeHideTabs, chromeUnhideTabs, chromeOnTabsUpdated,
  chromeUndoCloseTab, chromeUndoCloseTabs, chromeCloseTabs, chromeStorageGet, chromeStorageSet,
} from '@/utils/chromeAdapter';

/**
 * Hook that connects to real Chrome APIs when running as extension.
 * Returns empty/no-op state when called from web preview context.
 */
export function useChromeTabs() {
  const [windows, setWindows] = useState([]);
  const [tabGroups, setTabGroups] = useState([]);
  // Optimistic overlay only — the real "is this tab suspended" truth is Chrome's
  // `tab.discarded` flag (see the derived `suspendedTabs` below). This set holds
  // tabs we just asked Chrome to discard, until the next refresh confirms it.
  const [pendingSuspend, setPendingSuspend] = useState(new Set());
  const [tabNotes, setTabNotes] = useState({});
  const [windowNames, setWindowNames] = useState({});
  const refreshRef = useRef(null);
  const debounceRef = useRef(null);
  // Track lastAccessed ourselves — chrome.tabs.query() doesn't return it reliably
  const lastAccessedRef = useRef({});
  // Signatures of the last applied state — used to skip no-op re-renders when a
  // burst of tab events triggers refreshes that resolve to identical state,
  // which is the main render cost at high tab counts.
  const winSigRef = useRef('');
  const groupSigRef = useRef('');

  // Load persisted data from chrome.storage on mount
  useEffect(() => {
    if (!isExtensionContext()) return;
    chromeStorageGet(['tabNotes', 'windowNames']).then(data => {
      if (data.tabNotes) setTabNotes(data.tabNotes);
      if (data.windowNames) setWindowNames(data.windowNames);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isExtensionContext()) return;
    try {
      const wins = await chromeGetAllWindows();
      // Stamp lastAccessed for active tabs on every refresh
      const now = Date.now();
      wins.forEach(w => w.tabs?.forEach(t => {
        if (t.active) lastAccessedRef.current[t.id] = now;
      }));
      // Only push new state when something actually changed. Cheap O(n) string
      // build beats an O(n) React re-render of every window/tab/row.
      const winSig = JSON.stringify(wins.map(w => [
        w.id, w.focused, w.state,
        (w.tabs || []).map(t => [t.id, t.windowId, t.index, t.title, t.url,
          t.active, t.pinned, t.audible, t.mutedInfo?.muted, t.groupId, t.status, t.discarded]),
      ]));
      if (winSig !== winSigRef.current) { winSigRef.current = winSig; setWindows(wins); }
      const groups = await chromeGetTabGroups();
      const groupSig = JSON.stringify(groups.map(g => [g.id, g.title, g.color, g.collapsed, g.windowId]));
      if (groupSig !== groupSigRef.current) { groupSigRef.current = groupSig; setTabGroups(groups); }
    } catch (e) {
      console.error('Chrome tabs refresh error:', e);
    }
  }, []);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!isExtensionContext()) return;

    // Debounced refresh — collapses rapid successive events (tab switches, focus changes)
    // into a single refresh, preventing the cascade that causes panel lag/crashes
    const debouncedRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => refreshRef.current?.(), 150);
    };

    // Immediate fetch + one retry for initialization
    refresh();
    const t1 = setTimeout(() => refreshRef.current?.(), 500);
    const cleanup = chromeOnTabsUpdated(debouncedRefresh);
    // Track tab activation — chrome.tabs.query doesn't return lastAccessed reliably
    const onActivated = (info) => { lastAccessedRef.current[info.tabId] = Date.now(); };
    chrome.tabs.onActivated.addListener(onActivated);
    // No polling: tab/window/group events (direct + background 'tabs-updated'
    // messages) drive every refresh. Re-sync once when the panel becomes
    // visible again, in case an event landed while it was hidden.
    const onVisible = () => { if (document.visibilityState === 'visible') refreshRef.current?.(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(t1); if (debounceRef.current) clearTimeout(debounceRef.current); cleanup(); chrome.tabs.onActivated.removeListener(onActivated); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  // Merge stored window names into windows — stable sequential fallback names
  // Ignore stored names that are raw window IDs (from old bug like "Window 1997660659")
  const windowsWithNames = useMemo(() =>
    windows.map(w => {
      let name = windowNames[w.id];
      if (name && /^Window \d{5,}$/.test(name)) name = null;
      return { ...w, name: name || `Window ${getStableWindowIndex(w.id)}` };
    }),
    [windows, windowNames]
  );

  const allTabs = useMemo(() =>
    windowsWithNames.flatMap(w => (w.tabs || []).map(t => ({
      ...t,
      windowId: w.id,
      // Merge our tracked lastAccessed — chrome.tabs.query doesn't return it
      lastAccessed: lastAccessedRef.current[t.id] || t.lastAccessed || 0,
    }))),
    [windowsWithNames]
  );

  // A tab is "suspended/paused" iff Chrome has discarded it (unloaded from
  // memory). Deriving from that ground truth keeps the count accurate and
  // self-healing — the old local-Set approach drifted (it only grew on our own
  // suspend actions and never noticed when Chrome reloaded a tab, so e.g. the
  // footer stayed stuck at "Paused 8"). pendingSuspend overlays the brief gap
  // between asking Chrome to discard and the next refresh confirming it.
  const suspendedTabs = useMemo(() => {
    const s = new Set();
    for (const t of allTabs) if (t.discarded) s.add(t.id);
    for (const id of pendingSuspend) if (allTabs.some(t => t.id === id)) s.add(id);
    return s;
  }, [allTabs, pendingSuspend]);

  // Once a discard lands (tab now reports discarded) or the tab is gone, drop it
  // from the optimistic overlay so the overlay can never wrongly inflate the count.
  useEffect(() => {
    setPendingSuspend(prev => {
      if (prev.size === 0) return prev;
      const next = new Set();
      for (const id of prev) {
        const t = allTabs.find(x => x.id === id);
        if (t && !t.discarded) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [allTabs]);

  const switchToTab = useCallback(async (tabId) => {
    lastAccessedRef.current[tabId] = Date.now();
    const tab = allTabs.find(t => t.id === tabId);
    await chromeSwitchToTab(tabId, tab?.windowId);
  }, [allTabs]);

  const closeTab = useCallback(async (tabId) => {
    await chromeCloseTab(tabId);
  }, []);

  const closeTabs = useCallback(async (tabIds) => {
    return await chromeCloseTabs(tabIds);
  }, []);

  const undoCloseTab = useCallback(async () => {
    return await chromeUndoCloseTab();
  }, []);

  const undoCloseTabs = useCallback(async (count) => {
    return await chromeUndoCloseTabs(count);
  }, []);

  const pinTab = useCallback(async (tabId) => {
    const tab = allTabs.find(t => t.id === tabId);
    if (tab) await chromePinTab(tabId, !tab.pinned);
  }, [allTabs]);

  const muteTab = useCallback(async (tabId) => {
    const tab = allTabs.find(t => t.id === tabId);
    if (tab) await chromeMuteTab(tabId, !tab.mutedInfo?.muted);
  }, [allTabs]);

  const duplicateTab = useCallback(async (tabId) => {
    await chromeDuplicateTab(tabId);
  }, []);

  const moveTab = useCallback(async (tabId, windowId, index = -1) => {
    await chromeMoveTab(tabId, windowId, index);
  }, []);

  const moveTabToNewWindow = useCallback(async (tabId) => {
    await chromeMoveTabToNewWindow(tabId);
  }, []);

  const closeWindow = useCallback(async (windowId) => {
    await chromeCloseWindow(windowId);
  }, []);

  const minimizeWindow = useCallback(async (windowId) => {
    const win = windows.find(w => w.id === windowId);
    await chromeMinimizeWindow(windowId, win?.state);
  }, [windows]);

  const createNewTab = useCallback(async () => {
    const focused = windows.find(w => w.focused);
    await chromeCreateNewTab(focused?.id);
  }, [windows]);

  const createTabInWindow = useCallback(async (windowId) => {
    await chromeCreateTabInWindow(windowId);
  }, []);

  const createNewWindow = useCallback(async () => {
    await chromeCreateNewWindow();
  }, []);

  const renameWindow = useCallback((windowId, name) => {
    setWindowNames(prev => {
      const updated = { ...prev, [windowId]: name };
      chromeStorageSet({ windowNames: updated });
      return updated;
    });
  }, []);

  const muteAll = useCallback(async () => {
    await chromeMuteAll();
  }, []);

  const unmuteAll = useCallback(async () => {
    await chromeUnmuteAll();
  }, []);

  const closeDuplicates = useCallback(async () => {
    return await chromeCloseDuplicates();
  }, []);

  const reorderTab = useCallback(async (tabId, windowId, newIndex) => {
    await chromeMoveTab(tabId, windowId, newIndex);
  }, []);

  // closeOtherTabs used to live here, but it disagreed with the side panel's
  // "Close rest" (it killed pinned tabs and never confirmed). Both context-menu
  // and bulk paths now go through Sidebar's single handler on top of closeTabs.

  const closeTabsToRight = useCallback(async (tabId, windowId) => {
    const win = windows.find(w => w.id === windowId);
    if (!win) return;
    const idx = win.tabs.findIndex(t => t.id === tabId);
    const toClose = win.tabs.slice(idx + 1).map(t => t.id);
    for (const id of toClose) await chromeCloseTab(id);
  }, [windows]);

  const suspendTab = useCallback(async (tabId) => {
    setPendingSuspend(prev => new Set([...prev, tabId]));
    await chromeDiscardTab(tabId);
  }, []);

  const unsuspendTab = useCallback(async (tabId) => {
    setPendingSuspend(prev => { const n = new Set(prev); n.delete(tabId); return n; });
    const tab = allTabs.find(t => t.id === tabId);
    if (tab) await chromeSwitchToTab(tabId, tab.windowId);
  }, [allTabs]);

  // Returns { attempted, suspended }: Chrome refuses to discard some tabs (still
  // loading, playing media, and so on), so the two numbers can differ and the
  // caller needs both to say something truthful. Only the tabs Chrome actually
  // discarded go into the optimistic overlay.
  const suspendBackgroundTabs = useCallback(async () => {
    const toSuspend = [];
    windows.forEach(w => w.tabs?.forEach(t => {
      if (!t.active && !t.pinned && !t.audible && !t.discarded) toSuspend.push(t.id);
    }));
    const done = [];
    for (const id of toSuspend) {
      if (await chromeDiscardTab(id)) done.push(id);
    }
    if (done.length > 0) setPendingSuspend(prev => new Set([...prev, ...done]));
    return { attempted: toSuspend.length, suspended: done.length };
  }, [windows]);

  // Actually reload every discarded tab so they're truly un-suspended (the old
  // version just cleared the local count while the tabs stayed discarded).
  const unsuspendAll = useCallback(async () => {
    const discarded = allTabs.filter(t => t.discarded).map(t => t.id);
    setPendingSuspend(new Set());
    for (const id of discarded) await chromeReloadTab(id);
    return discarded.length;
  }, [allTabs]);

  const setTabNote = useCallback((tabId, note) => {
    setTabNotes(prev => {
      const updated = { ...prev };
      if (!note || !note.trim()) delete updated[tabId];
      else updated[tabId] = note.trim();
      chromeStorageSet({ tabNotes: updated });
      return updated;
    });
  }, []);

  const restoreSession = useCallback(async (session) => {
    return await chromeRestoreSession(session);
  }, []);

  const hideTabs = useCallback(async (tabIds) => {
    return await chromeHideTabs(tabIds);
  }, []);

  const unhideTabs = useCallback(async () => {
    await chromeUnhideTabs();
  }, []);

  return {
    windows: windowsWithNames, tabGroups, allTabs, suspendedTabs, tabNotes,
    switchToTab, closeTab, closeTabs, undoCloseTab, undoCloseTabs, pinTab, muteTab, duplicateTab,
    moveTab, moveTabToNewWindow, closeWindow, minimizeWindow,
    createNewTab, createTabInWindow, createNewWindow, renameWindow,
    muteAll, unmuteAll, closeDuplicates,
    reorderTab, closeTabsToRight,
    suspendTab, unsuspendTab, suspendBackgroundTabs, unsuspendAll,
    setTabNote, refresh, restoreSession, hideTabs, unhideTabs,
  };
}
