/**
 * Tab Radar Background Service Worker
 * Uses Chrome Side Panel API for persistent sidebar across all tabs.
 * Auto-opens side panel everywhere so users rely on Tab Radar instead of the tab bar.
 */

// Enable side panel to auto-open when toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Auto-open side panel in all existing windows
async function openSidePanelEverywhere() {
  try {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    for (const win of windows) {
      try {
        await chrome.sidePanel.open({ windowId: win.id });
        panelOpenWindows.add(win.id);
      } catch { /* window may not support side panel */ }
    }
  } catch {}
}

// On install or update — auto-open in all windows
chrome.runtime.onInstalled.addListener(() => {
  setTimeout(openSidePanelEverywhere, 500);
});

// On browser startup — auto-open in all windows
chrome.runtime.onStartup.addListener(() => {
  setTimeout(openSidePanelEverywhere, 500);
});

// Update badge with open tab count
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#1f6feb' });
  } catch (e) {
    console.error('Badge update error:', e);
  }
}

// Debounced notification — prevents cascade of rapid-fire events from overwhelming
// the side panel with refreshes (which causes lag and can make Chrome kill the panel)
let notifyTimer = null;
function notifySidepanel() {
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'tabs-updated' }).catch(() => {});
    updateBadge();
  }, 100);
}

// The in-page command center (content script) is gone — both keyboard commands
// now land on the side panel, which hosts the Cmd+K palette.
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-command-center') {
    chrome.windows.getLastFocused().then((win) => {
      if (win?.id) chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
    }).catch(() => {});
  }
});

// ── Focus Mode: strict tab/window restriction ─────────────────────
// When focus mode is active:
// - Block switching to non-focus tabs (force back to a focus tab)
// - Close any newly created tabs immediately
// - Close any newly created windows and refocus a focus window
// - Block window switches to windows without focus tabs
let focusModeState = null; // { focusTabIds: Set<number>, focusWindowIds: Set<number> }

// Build focus state from storage data
function buildFocusState(saved) {
  if (!saved?.active || !saved.focusTabIds?.length) return null;
  const focusTabIds = new Set(saved.focusTabIds);
  // Derive which windows contain focus tabs (computed async below)
  return { focusTabIds, focusWindowIds: new Set() };
}

// Refresh focusWindowIds from actual tab state
async function refreshFocusWindowIds() {
  if (!focusModeState) return;
  try {
    const allTabs = await chrome.tabs.query({});
    const windowIds = new Set();
    for (const tab of allTabs) {
      if (focusModeState.focusTabIds.has(tab.id)) {
        windowIds.add(tab.windowId);
      }
    }
    focusModeState.focusWindowIds = windowIds;
  } catch {}
}

// Load persisted focus state on startup
chrome.storage.local.get(['tabpilot_focus'], (data) => {
  focusModeState = buildFocusState(data?.tabpilot_focus);
  if (focusModeState) { refreshFocusWindowIds(); startFocusGuard(); }
});

// Listen for focus state changes from the sidepanel
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.tabpilot_focus) {
    focusModeState = buildFocusState(changes.tabpilot_focus.newValue);
    if (focusModeState) { refreshFocusWindowIds(); startFocusGuard(); }
    else { stopFocusGuard(); }
  }
});

// Helper: find the best focus tab to switch to (prefer same window, then any)
async function findFocusTab(preferWindowId) {
  const allTabs = await chrome.tabs.query({});
  // Prefer a focus tab in the same window
  if (preferWindowId) {
    const sameWindow = allTabs.find(t => t.windowId === preferWindowId && focusModeState.focusTabIds.has(t.id));
    if (sameWindow) return sameWindow;
  }
  // Any focus tab in any window
  return allTabs.find(t => focusModeState.focusTabIds.has(t.id)) || null;
}

// Helper: force-switch to a focus tab
async function enforceActiveFocusTab(preferWindowId) {
  const tab = await findFocusTab(preferWindowId);
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

// Notify about a blocked focus-mode action. The side panel shows the toast;
// the old in-page overlay went away with the scripting permission.
let _lastNotifyTime = 0;
function notifyFocusBlocked(reason) {
  // Throttle — max once per 2 seconds
  const now = Date.now();
  if (now - _lastNotifyTime < 2000) return;
  _lastNotifyTime = now;
  chrome.runtime.sendMessage({ action: 'focus-blocked', reason }).catch(() => {});
}

// Re-collapse hidden groups AND move them to the end (user may have expanded them)
async function recollapseHiddenGroups() {
  try {
    const groups = await chrome.tabGroups.query({});
    for (const g of groups) {
      if (g.title === 'Hidden' && !g.collapsed) {
        await chrome.tabGroups.update(g.id, { collapsed: true });
      }
    }
  } catch {}
}

// Periodic guard — catches cases where event listeners miss (e.g. Chrome internal navigation)
let focusGuardInterval = null;
function startFocusGuard() {
  if (focusGuardInterval) return;
  focusGuardInterval = setInterval(async () => {
    if (!focusModeState) { stopFocusGuard(); return; }
    try {
      // Re-collapse any expanded Hidden groups
      recollapseHiddenGroups();
      // Ensure active tab in the focused Chrome window is a focus tab
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!activeTab) return;
      if (!focusModeState.focusTabIds.has(activeTab.id)) {
        // Wrong tab or wrong window — force back
        const focusTab = await findFocusTab();
        if (focusTab) {
          await chrome.windows.update(focusTab.windowId, { focused: true });
          await chrome.tabs.update(focusTab.id, { active: true });
        }
      }
    } catch {}
  }, 1500); // light safety poll — event listeners do the real work
}
function stopFocusGuard() {
  if (focusGuardInterval) { clearInterval(focusGuardInterval); focusGuardInterval = null; }
}

// Tab events
chrome.tabs.onCreated.addListener((tab) => {
  notifySidepanel();
  // Focus mode: keep the user on their focus tabs WITHOUT destroying content.
  if (focusModeState && !focusModeState.focusTabIds.has(tab.id)) {
    // Only auto-close a brand-new BLANK tab (Ctrl+T / new-tab page) — there is
    // nothing to lose. Tabs opened with a real URL (links, restored sessions)
    // are never closed; we just pull focus back to a focus tab and notify.
    const url = tab.pendingUrl || tab.url || '';
    const isBlank = url === '' || url === 'about:blank' || url.startsWith('chrome://newtab');
    if (isBlank) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
    enforceActiveFocusTab(tab.windowId);
    notifyFocusBlocked('new-tab');
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  notifySidepanel();
  // If a focus tab was closed, update our state
  if (focusModeState && focusModeState.focusTabIds.has(tabId)) {
    focusModeState.focusTabIds.delete(tabId);
    refreshFocusWindowIds();
    // If no focus tabs left, auto-exit focus mode
    if (focusModeState.focusTabIds.size === 0) {
      focusModeState = null;
      chrome.storage.local.set({ tabpilot_focus: null });
    }
  }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status || changeInfo.title || changeInfo.url || changeInfo.audible !== undefined || changeInfo.mutedInfo) {
    notifySidepanel();
  }
});
chrome.tabs.onMoved.addListener(notifySidepanel);
chrome.tabs.onActivated.addListener((activeInfo) => {
  notifySidepanel();
  // Focus mode: if user activated a non-focus tab, force back + re-collapse hidden groups
  if (focusModeState && !focusModeState.focusTabIds.has(activeInfo.tabId)) {
    enforceActiveFocusTab(activeInfo.windowId);
    recollapseHiddenGroups();
    notifyFocusBlocked('switch-tab');
  }
});
chrome.tabs.onAttached.addListener(notifySidepanel);
chrome.tabs.onDetached.addListener(notifySidepanel);

// Retry sidePanel.open with multiple attempts — Chrome often rejects the first
// call when a window is newly created or focused (no user gesture context yet)
async function retrySidePanelOpen(windowId, delays) {
  for (const delay of delays) {
    await new Promise(r => setTimeout(r, delay));
    try {
      await chrome.sidePanel.open({ windowId });
      return; // success — stop retrying
    } catch { /* expected on early attempts */ }
  }
}

// Track which windows have the side panel confirmed open
const panelOpenWindows = new Set();

// Window events — also auto-open side panel in new/focused windows
chrome.windows.onCreated.addListener((window) => {
  notifySidepanel();
  // Focus mode: NEVER close a window (it may hold real tabs the user wants).
  // Just pull focus back to a focus window and notify — onFocusChanged also
  // keeps the user on a focus window after this.
  if (focusModeState && window.type === 'normal') {
    enforceActiveFocusTab();
    notifyFocusBlocked('new-window');
  }
  if (window.type === 'normal') {
    retrySidePanelOpen(window.id, [100, 300, 700, 1500, 3000]).then(() => {
      panelOpenWindows.add(window.id);
    });
  }
});
chrome.windows.onRemoved.addListener((windowId) => {
  notifySidepanel();
  panelOpenWindows.delete(windowId);
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  notifySidepanel();

  // WINDOW_ID_NONE means Chrome lost focus (user switched to another app) — allow this
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  if (!panelOpenWindows.has(windowId)) {
    retrySidePanelOpen(windowId, [50, 200, 500, 1200]).then(() => {
      panelOpenWindows.add(windowId);
    });
  }

  // Focus mode: block switching between Chrome windows
  // Only allow the window(s) that contain focus tabs
  if (focusModeState) {
    (async () => {
      try {
        // Check if this Chrome window has any focus tabs
        const winTabs = await chrome.tabs.query({ windowId });
        const hasFocusTab = winTabs.some(t => focusModeState?.focusTabIds.has(t.id));

        if (!hasFocusTab) {
          // This is a non-focus Chrome window — force back to a focus window
          const focusTab = await findFocusTab();
          if (focusTab) {
            // Focus the correct window first, then activate the tab
            await chrome.windows.update(focusTab.windowId, { focused: true });
            await chrome.tabs.update(focusTab.id, { active: true });
          }
          notifyFocusBlocked('switch-tab');
        } else {
          // Correct window, but ensure active tab is a focus tab
          const [activeTab] = await chrome.tabs.query({ windowId, active: true });
          if (activeTab && !focusModeState.focusTabIds.has(activeTab.id)) {
            const focusTab = winTabs.find(t => focusModeState.focusTabIds.has(t.id));
            if (focusTab) await chrome.tabs.update(focusTab.id, { active: true });
          }
        }
      } catch {}
    })();
  }
});

// Tab group events
try {
  chrome.tabGroups.onCreated.addListener(notifySidepanel);
  chrome.tabGroups.onUpdated.addListener(notifySidepanel);
  chrome.tabGroups.onRemoved.addListener(notifySidepanel);
} catch {}

// Initial badge
updateBadge();

// ── Active time tracking ──────────────────────────────────────────────────────
// REAL, measured "time spent per site". Chrome's history API has no dwell time,
// so we measure it ourselves: while a tab is the active tab in the focused window
// AND the user is not idle, we accrue elapsed seconds to that tab's domain.
// Forward-only (no historical data) and capped per segment to avoid counting a
// tab left open while the user is away.
const TIME_KEY = 'tabpilot_time';            // local: { 'YYYY-MM-DD': { domain: seconds } }
const TIME_SEG_KEY = 'tabpilot_time_segment'; // session: { domain, startedAt }
const SEGMENT_CAP_S = 1800;                   // never bank >30min from one segment
const IDLE_THRESHOLD_S = 60;

function timeDomain(url) {
  try {
    const u = new URL(url);
    // Only track real web pages. Checking the protocol (not the hostname)
    // keeps chrome:// internals out — chrome://extensions has hostname
    // "extensions", which used to slip through and show up as a "site".
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const h = u.hostname.replace(/^www\./, '');
    return h || null;
  } catch { return null; }
}

function timeDayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function bankTimeSegment() {
  try {
    const { [TIME_SEG_KEY]: seg } = await chrome.storage.session.get(TIME_SEG_KEY);
    if (!seg?.domain || !seg.startedAt) return;
    const secs = Math.min(SEGMENT_CAP_S, Math.round((Date.now() - seg.startedAt) / 1000));
    if (secs <= 0) return;
    const key = timeDayKey(seg.startedAt);
    const store = await chrome.storage.local.get(TIME_KEY);
    const data = store[TIME_KEY] || {};
    const day = data[key] || {};
    day[seg.domain] = (day[seg.domain] || 0) + secs;
    data[key] = day;
    // Keep ~35 days of history; prune older.
    const days = Object.keys(data).sort();
    while (days.length > 35) delete data[days.shift()];
    await chrome.storage.local.set({ [TIME_KEY]: data });
  } catch {}
}

async function startTimeSegment(domain) {
  if (!domain) { await chrome.storage.session.remove(TIME_SEG_KEY); return; }
  await chrome.storage.session.set({ [TIME_SEG_KEY]: { domain, startedAt: Date.now() } });
}

// Bank whatever was accruing, then start a fresh segment for the currently
// focused tab — or pause (no segment) if idle / no focused window.
let _retrackLock = false;
async function retrackTime() {
  if (_retrackLock) return;
  _retrackLock = true;
  try {
    await bankTimeSegment();
    let domain = null;
    try {
      const idle = await chrome.idle.queryState(IDLE_THRESHOLD_S);
      if (idle === 'active') {
        const win = await chrome.windows.getLastFocused({ populate: false });
        if (win?.focused && win.id !== chrome.windows.WINDOW_ID_NONE) {
          const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
          domain = tab ? timeDomain(tab.url) : null;
        }
      }
    } catch {}
    await startTimeSegment(domain);
  } finally {
    _retrackLock = false;
  }
}

try {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_S);
  chrome.idle.onStateChanged.addListener(retrackTime);
  chrome.tabs.onActivated.addListener(retrackTime);
  chrome.windows.onFocusChanged.addListener(retrackTime);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) retrackTime();
  });
  // Periodic flush so long uninterrupted focus still accrues (and survives the
  // service worker suspending — the alarm wakes it back up).
  chrome.alarms.create('tabpilot-time-flush', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tabpilot-time-flush') retrackTime(); });
  retrackTime(); // start on SW load
} catch (e) { console.error('time tracking init error:', e); }

// ── Background auto-close ────────────────────────────────────────────────
// Closes idle tabs even when the side panel is shut. Previously the closing
// logic lived ONLY in the Auto-Close panel's React effect, so tabs were closed
// just when that panel happened to be open (that's the "tabs vanished the
// moment I opened the panel" bug). Now an alarm evaluates every minute, plus a
// settings-change listener so toggling it on closes overdue tabs immediately.
const AC_SETTINGS_KEY = 'tabpilot_settings';

function acHostMatches(host, whitelist) {
  if (!host) return false;
  return whitelist.some(w => host === w || host.endsWith('.' + w));
}

async function runAutoClose() {
  try {
    const store = await chrome.storage.local.get(AC_SETTINGS_KEY);
    const s = store[AC_SETTINGS_KEY];
    if (!s || !s.autoCloseEnabled) return;

    const minutes = s.autoClosePreset === 'custom'
      ? parseInt(s.autoCloseCustomMinutes, 10) || 0
      : parseInt(s.autoClosePreset, 10) || 0;
    if (!minutes || minutes <= 0) return;

    const whitelist = (s.autoCloseWhitelist || []).map(d => String(d).toLowerCase());
    const thresholdMs = minutes * 60000;
    const now = Date.now();

    // Tabs hidden by Focus mode live in a "Hidden" group — never auto-close those.
    let hiddenGroupIds = new Set();
    try {
      const groups = await chrome.tabGroups.query({});
      hiddenGroupIds = new Set(groups.filter(g => g.title === 'Hidden').map(g => g.id));
    } catch {}

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.active || tab.pinned || tab.audible) continue;       // safe tabs
      if (tab.groupId != null && hiddenGroupIds.has(tab.groupId)) continue;
      if (!/^https?:\/\//.test(tab.url || '')) continue;           // leave chrome:// / new-tab alone
      let host = '';
      try { host = new URL(tab.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { continue; }
      if (acHostMatches(host, whitelist)) continue;                // whitelisted
      const last = tab.lastAccessed || 0;                          // Chrome-native last-active time
      if (!last) continue;                                         // unknown → don't touch
      if (now - last >= thresholdMs) {
        try { await chrome.tabs.remove(tab.id); } catch {}
      }
    }
  } catch (e) { console.error('auto-close error:', e); }
}

try {
  chrome.alarms.create('tabpilot-autoclose', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tabpilot-autoclose') runAutoClose(); });
  // React promptly when the user enables/changes the rule (don't wait a minute).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[AC_SETTINGS_KEY]) runAutoClose();
  });
} catch (e) { console.error('auto-close init error:', e); }
