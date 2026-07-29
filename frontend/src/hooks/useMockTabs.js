import { useState, useCallback, useMemo, useRef } from 'react';
import { MOCK_WINDOWS, MOCK_TAB_GROUPS, INITIAL_TAB_NOTES } from '@/utils/mockData';

let nextTabId = 400;
let nextWindowId = 4;

const MAX_CLOSED_HISTORY = 50;

export function useMockTabs() {
  const [windows, setWindows] = useState(MOCK_WINDOWS);
  const [tabGroups] = useState(MOCK_TAB_GROUPS);
  const [suspendedTabs, setSuspendedTabs] = useState(new Set());
  const [tabNotes, setTabNotes] = useState(INITIAL_TAB_NOTES);

  const allTabs = useMemo(() =>
    windows.flatMap(w => w.tabs.map(t => ({ ...t, windowId: w.id }))),
    [windows]
  );

  const switchToTab = useCallback((tabId) => {
    setWindows(prev => prev.map(w => ({
      ...w,
      focused: w.tabs.some(t => t.id === tabId),
      tabs: w.tabs.map(t => ({
        ...t,
        active: t.id === tabId,
        lastAccessed: t.id === tabId ? Date.now() : t.lastAccessed,
      }))
    })));
  }, []);

  // Deep enough that undoing a bulk close actually brings everything back.
  const closedTabHistory = useRef([]);

  const closeTab = useCallback((tabId) => {
    setWindows(prev => {
      let closedTab = null;
      let closedWindowId = null;
      const updated = prev.map(w => {
        const tab = w.tabs.find(t => t.id === tabId);
        if (tab) { closedTab = tab; closedWindowId = w.id; }
        return { ...w, tabs: w.tabs.filter(t => t.id !== tabId) };
      });
      if (closedTab) {
        closedTabHistory.current = [
          ...closedTabHistory.current.slice(-(MAX_CLOSED_HISTORY - 1)),
          { ...closedTab, windowId: closedWindowId }
        ];
      }
      return updated.filter(w => w.tabs.length > 0);
    });
  }, []);

  // Batch equivalent of closeTab — one state pass, mirrors chrome.tabs.remove(array).
  const closeTabs = useCallback((tabIds) => {
    const ids = new Set(tabIds || []);
    if (ids.size === 0) return 0;
    setWindows(prev => {
      const closed = [];
      const updated = prev.map(w => {
        w.tabs.forEach(t => { if (ids.has(t.id)) closed.push({ ...t, windowId: w.id }); });
        return { ...w, tabs: w.tabs.filter(t => !ids.has(t.id)) };
      });
      closedTabHistory.current = [
        ...closedTabHistory.current, ...closed
      ].slice(-MAX_CLOSED_HISTORY);
      return updated.filter(w => w.tabs.length > 0);
    });
    return ids.size;
  }, []);

  const undoCloseTabs = useCallback((count = 1) => {
    const history = closedTabHistory.current;
    if (history.length === 0) return 0;
    const toRestore = history.slice(-Math.max(1, count));
    closedTabHistory.current = history.slice(0, history.length - toRestore.length);
    setWindows(prev => {
      let next = prev;
      for (const tab of toRestore) {
        const winExists = next.find(w => w.id === tab.windowId);
        next = winExists
          ? next.map(w => w.id === tab.windowId
              ? { ...w, tabs: [...w.tabs, { ...tab, active: false }] }
              : w)
          // Window was closed — recreate it
          : [...next, { id: tab.windowId, focused: false, tabs: [{ ...tab, active: false }] }];
      }
      return next;
    });
    return toRestore.length;
  }, []);

  const undoCloseTab = useCallback(() => undoCloseTabs(1) > 0, [undoCloseTabs]);

  const pinTab = useCallback((tabId) => {
    setWindows(prev => prev.map(w => ({
      ...w,
      tabs: w.tabs.map(t =>
        t.id === tabId ? { ...t, pinned: !t.pinned } : t
      )
    })));
  }, []);

  const muteTab = useCallback((tabId) => {
    setWindows(prev => prev.map(w => ({
      ...w,
      tabs: w.tabs.map(t => {
        if (t.id !== tabId) return t;
        if (t.mutedInfo?.muted) {
          // Unmuting: restore original audible state that was saved when muting
          return { ...t, mutedInfo: { muted: false }, audible: t.mutedInfo.wasAudible ?? false };
        } else {
          // Muting: save current audible state so we can restore it on unmute
          return { ...t, mutedInfo: { muted: true, wasAudible: t.audible }, audible: false };
        }
      })
    })));
  }, []);

  const duplicateTab = useCallback((tabId) => {
    setWindows(prev => prev.map(w => {
      const tab = w.tabs.find(t => t.id === tabId);
      if (!tab) return w;
      const newTab = { ...tab, id: nextTabId++, active: false, pinned: false };
      const idx = w.tabs.findIndex(t => t.id === tabId);
      const newTabs = [...w.tabs];
      newTabs.splice(idx + 1, 0, newTab);
      return { ...w, tabs: newTabs };
    }));
  }, []);

  const moveTab = useCallback((tabId, targetWindowId, index = -1) => {
    setWindows(prev => {
      let movedTab = null;
      let updated = prev.map(w => {
        const tab = w.tabs.find(t => t.id === tabId);
        if (tab) {
          movedTab = { ...tab, windowId: targetWindowId, active: false };
          return { ...w, tabs: w.tabs.filter(t => t.id !== tabId) };
        }
        return w;
      });
      if (!movedTab) return prev;
      updated = updated.map(w => {
        if (w.id === targetWindowId) {
          const newTabs = [...w.tabs];
          if (index === -1) newTabs.push(movedTab);
          else newTabs.splice(index, 0, movedTab);
          return { ...w, tabs: newTabs };
        }
        return w;
      });
      return updated.filter(w => w.tabs.length > 0);
    });
  }, []);

  const moveTabToNewWindow = useCallback((tabId) => {
    setWindows(prev => {
      let movedTab = null;
      let updated = prev.map(w => {
        const tab = w.tabs.find(t => t.id === tabId);
        if (tab) {
          movedTab = { ...tab };
          return { ...w, tabs: w.tabs.filter(t => t.id !== tabId) };
        }
        return w;
      });
      if (!movedTab) return prev;
      const newWindowId = nextWindowId++;
      movedTab.windowId = newWindowId;
      movedTab.active = true;
      updated.push({ id: newWindowId, focused: true, state: 'normal', tabs: [movedTab] });
      updated = updated.map(w => ({ ...w, focused: w.id === newWindowId }));
      return updated.filter(w => w.tabs.length > 0);
    });
  }, []);

  const closeWindow = useCallback((windowId) => {
    setWindows(prev => prev.filter(w => w.id !== windowId));
  }, []);

  const minimizeWindow = useCallback((windowId) => {
    setWindows(prev => prev.map(w =>
      w.id === windowId ? { ...w, state: w.state === 'minimized' ? 'normal' : 'minimized' } : w
    ));
  }, []);

  const createNewTab = useCallback(() => {
    setWindows(prev => {
      const focusedWindow = prev.find(w => w.focused) || prev[0];
      if (!focusedWindow) return prev;
      const newTab = {
        id: nextTabId++, windowId: focusedWindow.id,
        index: focusedWindow.tabs.length,
        title: 'New Tab', url: 'chrome://newtab',
        active: true, pinned: false, audible: false,
        mutedInfo: { muted: false }, status: 'complete', groupId: -1,
      };
      return prev.map(w => {
        if (w.id === focusedWindow.id) {
          return { ...w, tabs: [newTab, ...w.tabs.map(t => ({ ...t, active: false }))] };
        }
        return { ...w, tabs: w.tabs.map(t => ({ ...t, active: false })) };
      });
    });
  }, []);

  const createTabInWindow = useCallback((windowId) => {
    setWindows(prev => {
      const targetWin = prev.find(w => w.id === windowId);
      if (!targetWin) return prev;
      const newTab = {
        id: nextTabId++, windowId,
        index: targetWin.tabs.length,
        title: 'New Tab', url: 'chrome://newtab',
        active: true, pinned: false, audible: false,
        mutedInfo: { muted: false }, status: 'complete', groupId: -1,
      };
      return prev.map(w => {
        if (w.id === windowId) {
          return { ...w, focused: true, tabs: [newTab, ...w.tabs.map(t => ({ ...t, active: false }))] };
        }
        return { ...w, focused: false, tabs: w.tabs.map(t => ({ ...t, active: false })) };
      });
    });
  }, []);

  const renameWindow = useCallback((windowId, name) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, name } : w));
  }, []);

  const createNewWindow = useCallback(() => {
    const newWinId = nextWindowId++;
    const newTab = {
      id: nextTabId++, windowId: newWinId, index: 0,
      title: 'New Tab', url: 'chrome://newtab',
      active: true, pinned: false, audible: false,
      mutedInfo: { muted: false }, status: 'complete', groupId: -1,
    };
    setWindows(prev => [
      ...prev.map(w => ({ ...w, focused: false })),
      { id: newWinId, focused: true, state: 'normal', tabs: [newTab] }
    ]);
  }, []);

  const muteAll = useCallback(() => {
    setWindows(prev => prev.map(w => ({
      ...w,
      tabs: w.tabs.map(t =>
        t.audible ? { ...t, mutedInfo: { muted: true }, audible: false } : t
      )
    })));
  }, []);

  const unmuteAll = useCallback(() => {
    setWindows(prev => prev.map(w => ({
      ...w,
      tabs: w.tabs.map(t =>
        t.mutedInfo?.muted ? { ...t, mutedInfo: { muted: false } } : t
      )
    })));
  }, []);

  const closeDuplicates = useCallback(() => {
    const urlMap = {};
    const tabsToClose = [];
    windows.forEach(w => {
      w.tabs.forEach(t => {
        try {
          const u = new URL(t.url);
          const normalized = u.origin + u.pathname.replace(/\/$/, '') + u.search;
          if (urlMap[normalized]) tabsToClose.push(t.id);
          else urlMap[normalized] = t.id;
        } catch { /* skip */ }
      });
    });
    if (tabsToClose.length === 0) return 0;
    setWindows(prev => {
      const updated = prev.map(w => ({
        ...w, tabs: w.tabs.filter(t => !tabsToClose.includes(t.id))
      }));
      return updated.filter(w => w.tabs.length > 0);
    });
    return tabsToClose.length;
  }, [windows]);

  const reorderTab = useCallback((tabId, windowId, newIndex) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w;
      const tabIdx = w.tabs.findIndex(t => t.id === tabId);
      if (tabIdx === -1) return w;
      const newTabs = [...w.tabs];
      const [tab] = newTabs.splice(tabIdx, 1);
      newTabs.splice(newIndex, 0, tab);
      return { ...w, tabs: newTabs };
    }));
  }, []);

  // closeOtherTabs removed on purpose — see the note in useChromeTabs. The single
  // implementation now lives in Sidebar and runs through closeTabs.

  const closeTabsToRight = useCallback((tabId, windowId) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w;
      const idx = w.tabs.findIndex(t => t.id === tabId);
      return { ...w, tabs: w.tabs.slice(0, idx + 1) };
    }));
  }, []);

  const suspendTab = useCallback((tabId) => {
    setSuspendedTabs(prev => new Set([...prev, tabId]));
  }, []);

  const unsuspendTab = useCallback((tabId) => {
    setSuspendedTabs(prev => { const n = new Set(prev); n.delete(tabId); return n; });
  }, []);

  // Same { attempted, suspended } shape as the Chrome hook — the demo has nothing
  // that can refuse, so the two always match.
  const suspendInactive = useCallback(async () => {
    const toSuspend = new Set();
    windows.forEach(w => w.tabs.forEach(t => {
      if (!t.active && !t.pinned && !t.audible) toSuspend.add(t.id);
    }));
    setSuspendedTabs(toSuspend);
    return { attempted: toSuspend.size, suspended: toSuspend.size };
  }, [windows]);

  const unsuspendAll = useCallback(() => {
    const count = suspendedTabs.size;
    setSuspendedTabs(new Set());
    return count;
  }, [suspendedTabs]);

  const setTabNote = useCallback((tabId, note) => {
    setTabNotes(prev => {
      if (!note || !note.trim()) {
        const next = { ...prev };
        delete next[tabId];
        return next;
      }
      return { ...prev, [tabId]: note.trim() };
    });
  }, []);

  const hideTabs = useCallback(() => null, []);
  const unhideTabs = useCallback(() => {}, []);
  const restoreSession = useCallback(() => 0, []);

  return {
    windows, tabGroups, allTabs, suspendedTabs, tabNotes,
    switchToTab, closeTab, closeTabs, undoCloseTab, undoCloseTabs, pinTab, muteTab, duplicateTab,
    moveTab, moveTabToNewWindow, closeWindow, minimizeWindow,
    createNewTab, createNewWindow, createTabInWindow, renameWindow,
    muteAll, unmuteAll, closeDuplicates,
    reorderTab, closeTabsToRight,
    suspendTab, unsuspendTab, suspendInactive, unsuspendAll,
    setTabNote, hideTabs, unhideTabs, restoreSession,
  };
}
