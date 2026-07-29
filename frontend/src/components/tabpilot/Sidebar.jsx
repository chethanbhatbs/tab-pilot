import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, Timer, X as XIcon, Check, Minus, Trash2, ListX, Star, Flame, SlidersHorizontal, Pause, Play, VolumeX, Volume2, ClipboardCheck } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchBar } from './SearchBar';
import { QuickActions } from './QuickActions';
import { WindowGroup } from './WindowGroup';
import { DomainView } from './DomainView';
import { DuplicatePanel } from './DuplicatePanel';
import { findDuplicates } from '@/utils/grouping';
import { TabItem } from './TabItem';
import { SettingsPanel } from './SettingsPanel';
import { HeatmapPanel } from './HeatmapPanel';
import { FocusMode, getPersistedFocus } from './FocusMode';
import { HelpPanel } from './HelpPanel';
import { CommandPalette } from './CommandPalette';
import { AutoClosePanel } from './AutoClosePanel';
import { ProfilePanel } from './ProfilePanel';
import { ProfileSwitcher } from './ProfileSwitcher';
import { StatsBar } from './StatsBar';
import { TourGuide, shouldShowTour } from './TourGuide';
import { isExtensionContext } from '@/utils/chromeAdapter';
import { useMockTabs } from '@/hooks/useMockTabs';
import { useChromeTabs } from '@/hooks/useChromeTabs';
import { useSearch } from '@/hooks/useSearch';
import { useSettings } from '@/hooks/useSettings';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';

// Adaptive hook: both always called (React rules of hooks), Chrome one used in extension context
function useTabsAdapter() {
  const mockTabs = useMockTabs();
  const chromeTabs = useChromeTabs();
  return isExtensionContext() ? chromeTabs : mockTabs;
}

export function Sidebar({ onCollapse }) {
  const tabs = useTabsAdapter();
  const search = useSearch(tabs.allTabs);
  const { settings, updateSetting } = useSettings();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const searchInputRef = useRef(null);

  const [activePanel, setActivePanel] = useState(null);
  const [viewMode, setViewMode] = useState('window');
  const [selectedTabIdx, setSelectedTabIdx] = useState(-1);
  const [visitCounts, setVisitCounts] = useState({});
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [showTour, setShowTour] = useState(() => shouldShowTour());
  const [confirmPending, setConfirmPending] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTabIds, setSelectedTabIds] = useState(new Set());
  const [persistedFocus, setPersistedFocus] = useState(null); // restored from chrome.storage

  // On mount: check if focus mode was active (survives panel reload / window switch)
  useEffect(() => {
    getPersistedFocus().then(saved => {
      if (saved) {
        setPersistedFocus(saved);
        setActivePanel('focus');
      }
    });
  }, []);

  // Cross-window sync: listen for focus state changes from other windows
  useEffect(() => {
    if (!isExtensionContext() || !chrome?.storage?.onChanged) return;
    const handler = (changes) => {
      if (!changes.tabpilot_focus) return;
      const newVal = changes.tabpilot_focus.newValue;
      if (!newVal || !newVal.active) {
        // Focus was exited in another window — exit here too
        setPersistedFocus(null);
        if (activePanel === 'focus') setActivePanel(null);
      } else if (newVal.active && activePanel !== 'focus') {
        // Focus was started in another window — enter here too
        setPersistedFocus(newVal);
        setActivePanel('focus');
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [activePanel]);


  const withConfirm = useCallback((message, action) => {
    if (!settings.confirmActions) { action(); return; }
    setConfirmPending({ message, action });
  }, [settings.confirmActions]);

  // Hidden group IDs — filter these from display (focus mode)
  const hiddenGroupIds = useMemo(() => {
    const ids = new Set();
    tabs.tabGroups.forEach(g => { if (g.title === 'Hidden') ids.add(g.id); });
    return ids;
  }, [tabs.tabGroups]);

  const isTabVisible = useCallback((t) => {
    return !t.groupId || t.groupId === -1 || !hiddenGroupIds.has(t.groupId);
  }, [hiddenGroupIds]);

  // Display-layer filtering: remove hidden group tabs
  const filteredAllTabs = useMemo(() => {
    return tabs.allTabs.filter(isTabVisible);
  }, [tabs.allTabs, isTabVisible]);

  const filteredWindows = useMemo(() => {
    return tabs.windows
      .map(w => ({ ...w, tabs: (w.tabs || []).filter(isTabVisible) }))
      .filter(w => w.tabs.length > 0);
  }, [tabs.windows, isTabVisible]);

  // Single source of duplicate info for the whole sidebar — computed once and
  // shared with the banner, the footer, and the inline row markers (previously
  // each scanned all tabs independently).
  const duplicateInfo = useMemo(() => {
    const groups = findDuplicates(filteredAllTabs);
    const ids = new Set();
    let count = 0;
    for (const g of groups) {
      count += g.tabs.length - 1;
      for (const t of g.tabs) ids.add(t.id);
    }
    return { groups, ids, count };
  }, [filteredAllTabs]);
  const duplicateTabIds = duplicateInfo.ids;

  const toggleSelectMode = useCallback(() => {
    setSelectMode(prev => !prev);
    setSelectedTabIds(new Set());
  }, []);

  const toggleTabSelection = useCallback((tabId) => {
    setSelectedTabIds(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  }, []);

  const selectAllTabs = useCallback(() => {
    setSelectedTabIds(new Set(filteredAllTabs.map(t => t.id)));
  }, [filteredAllTabs]);

  const deselectAllTabs = useCallback(() => {
    setSelectedTabIds(new Set());
  }, []);

  const selectAllInWindow = useCallback((windowId) => {
    const win = tabs.windows.find(w => w.id === windowId);
    if (!win) return;
    setSelectedTabIds(prev => {
      const next = new Set(prev);
      const winTabIds = win.tabs.map(t => t.id);
      const allSelected = winTabIds.every(id => next.has(id));
      if (allSelected) winTabIds.forEach(id => next.delete(id));
      else winTabIds.forEach(id => next.add(id));
      return next;
    });
  }, [tabs.windows]);

  // How many windows vanish entirely if these ids go — the user deserves to know
  // that before confirming, not after.
  const countWindowsLost = useCallback((ids) => {
    const closing = new Set(ids);
    return filteredWindows.filter(w => w.tabs.length > 0 && w.tabs.every(t => closing.has(t.id))).length;
  }, [filteredWindows]);

  // Every bulk close goes through here: one batched remove, one toast, one undo.
  const closeTabsWithUndo = useCallback((ids, summary) => {
    tabs.closeTabs(ids);
    toast.success(summary, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const restored = await tabs.undoCloseTabs(ids.length);
          toast.info(
            restored > 0 ? `Restored ${restored} tab${restored > 1 ? 's' : ''}` : 'Nothing left to restore',
            { duration: 2000 }
          );
        },
      },
    });
  }, [tabs]);

  const handleBulkClose = useCallback(() => {
    const ids = [...selectedTabIds];
    if (ids.length === 0) return;
    setSelectedTabIds(new Set());
    setSelectMode(false);
    closeTabsWithUndo(ids, `Closed ${ids.length} tab${ids.length > 1 ? 's' : ''}`);
  }, [selectedTabIds, closeTabsWithUndo]);

  // Inverse of bulk close: keep what's selected, close everything else. Scoped to
  // filteredAllTabs so focus-mode hidden tabs are never touched, and pinned tabs
  // are skipped to match Chrome's own "Close other tabs".
  const othersToClose = useMemo(() => {
    if (selectedTabIds.size === 0) return [];
    return filteredAllTabs.filter(t => !selectedTabIds.has(t.id) && !t.pinned);
  }, [filteredAllTabs, selectedTabIds]);

  const handleCloseOthers = useCallback(() => {
    const keptCount = selectedTabIds.size;
    if (keptCount === 0) return;
    const ids = othersToClose.map(t => t.id);
    if (ids.length === 0) { toast.info('No other tabs to close'); return; }
    const pinnedSkipped = filteredAllTabs.filter(t => !selectedTabIds.has(t.id) && t.pinned).length;
    const windowsLost = countWindowsLost(ids);
    // Always confirm, even when the "confirm actions" setting is off: this is the
    // one action that can wipe out the whole window in a single click.
    setConfirmPending({
      message: `Close ${ids.length} other tab${ids.length > 1 ? 's' : ''} and keep the ${keptCount} selected?` +
        (windowsLost > 0 ? ` This closes ${windowsLost} window${windowsLost > 1 ? 's' : ''} entirely.` : ''),
      action: () => {
        setSelectedTabIds(new Set());
        setSelectMode(false);
        closeTabsWithUndo(
          ids,
          `Closed ${ids.length} tab${ids.length > 1 ? 's' : ''}, kept ${keptCount}` +
          (pinnedSkipped > 0 ? ` and ${pinnedSkipped} pinned` : '')
        );
      },
    });
  }, [othersToClose, filteredAllTabs, selectedTabIds, countWindowsLost, closeTabsWithUndo]);

  // Right-click "Close other tabs". Same rules as the bulk "Close rest" above —
  // pinned tabs survive, focus-mode hidden tabs are untouched, always confirms —
  // but scoped to the clicked tab's own window.
  const handleCloseOthersInWindow = useCallback((tabId, windowId) => {
    const win = filteredWindows.find(w => w.id === windowId);
    if (!win) return;
    const ids = win.tabs.filter(t => t.id !== tabId && !t.pinned).map(t => t.id);
    if (ids.length === 0) { toast.info('No other tabs to close in this window'); return; }
    const pinnedSkipped = win.tabs.filter(t => t.id !== tabId && t.pinned).length;
    setConfirmPending({
      message: `Close ${ids.length} other tab${ids.length > 1 ? 's' : ''} in this window?`,
      action: () => closeTabsWithUndo(
        ids,
        `Closed ${ids.length} tab${ids.length > 1 ? 's' : ''}` +
        (pinnedSkipped > 0 ? `, kept ${pinnedSkipped} pinned` : '')
      ),
    });
  }, [filteredWindows, closeTabsWithUndo]);

  const handleDuplicate = useCallback((tabId) => {
    tabs.duplicateTab(tabId);
    toast.success('Tab duplicated', { duration: 1500 });
  }, [tabs]);

  const handleSwitchTab = useCallback((tabId) => {
    const tab = tabs.allTabs.find(t => t.id === tabId);
    // `active` is per-window — every window has its own active tab. So "already
    // here" is only true when the tab is active AND its window is the focused
    // one. Otherwise it's the active tab of *another* window and clicking it
    // must switch windows (the old check fired the "already on this tab" toast
    // and refused to switch).
    const focusedWin = tabs.windows.find(w => w.focused);
    const alreadyHere = tab?.active && (!focusedWin || tab.windowId === focusedWin.id);
    if (alreadyHere) {
      toast.info("You're already on this tab", { duration: 1500 });
      return;
    }
    tabs.switchToTab(tabId);
    setVisitCounts(prev => ({ ...prev, [tabId]: (prev[tabId] || 0) + 1 }));
    if (tab) toast.info(`Switched to: ${tab.title}`, { duration: 1500 });
  }, [tabs]);

  const handleCloseTab = useCallback((tabId) => {
    const tabTitle = tabs.allTabs.find(t => t.id === tabId)?.title?.slice(0, 35) || 'Tab';
    withConfirm(`Close "${tabTitle}"?`, () => {
      tabs.closeTab(tabId);
      toast.success(`Closed: ${tabTitle}`, {
        duration: 3000,
        action: { label: 'Undo', onClick: () => tabs.undoCloseTab() },
      });
    });
  }, [tabs, withConfirm]);

  const handleCloseDuplicates = useCallback(async () => {
    const count = await tabs.closeDuplicates();
    if (count > 0) toast.success(`Closed ${count} duplicate tab${count > 1 ? 's' : ''}`);
    else toast.info('No duplicates found');
  }, [tabs]);

  const handleToggleGrouping = useCallback(() => {
    setViewMode(prev => prev === 'window' ? 'domain' : 'window');
    if (activePanel === 'heatmap' || activePanel === 'focus') setActivePanel(null);
  }, [activePanel]);

  const handleToggleHeatmap = useCallback(() => {
    setActivePanel(prev => prev === 'heatmap' ? null : 'heatmap');
    setViewMode('window');
  }, []);

  const handleToggleFocus = useCallback(() => {
    setActivePanel(prev => prev === 'focus' ? null : 'focus');
    setViewMode('window');
  }, []);

  const handleSuspendInactive = useCallback(() => {
    const count = tabs.suspendInactive();
    if (count > 0) toast.success(`Suspended ${count} inactive tab${count > 1 ? 's' : ''}`);
    else toast.info('No inactive tabs to suspend');
  }, [tabs]);

  const handleUnsuspendAll = useCallback(async () => {
    const count = await tabs.unsuspendAll();
    if (count > 0) toast.success(`Restored ${count} tab${count > 1 ? 's' : ''}`);
    else toast.info('No suspended tabs');
  }, [tabs]);

  const handleUnmuteAll = useCallback(() => {
    tabs.unmuteAll();
    toast.success('All tabs unmuted');
  }, [tabs]);

  // Keep-open handler for auto-close pre-warning — adds tab to visitCounts which
  // removes it from atRiskTabs evaluation, effectively resetting the auto-close timer
  const handleKeepOpenTab = useCallback((tabId) => {
    setVisitCounts(prev => ({ ...prev, [tabId]: (prev[tabId] || 0) + 1 }));
    const tab = tabs.allTabs.find(t => t.id === tabId);
    toast.success(`Kept open: ${tab?.title?.slice(0, 35) || 'Tab'}`, { duration: 1500 });
  }, [tabs]);

  const quickActionHandlers = {
    onNewTab: () => withConfirm('Open a new tab?', tabs.createNewTab),
    onNewWindow: () => withConfirm('Open a new window?', tabs.createNewWindow),
    onCloseDuplicates: handleCloseDuplicates,
    onMuteAll: () => { tabs.muteAll(); toast.success('All tabs muted'); },
    onUnmuteAll: handleUnmuteAll,
    onToggleGrouping: handleToggleGrouping,
    onToggleHeatmap: handleToggleHeatmap,
    onToggleFocus: handleToggleFocus,
    onSuspendInactive: handleSuspendInactive,
    onUnsuspendAll: handleUnsuspendAll,
  };

  useEffect(() => {
    const handler = (e) => {
      // Cmd+K (mac) / Ctrl+K (win/linux) opens the command palette — the
      // Spotlight-style quick switcher advertised on the landing page. This is a
      // visible overlay (unambiguous feedback), unlike silently focusing the
      // inline search. toLowerCase() so it fires regardless of caps/shift.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(true);
        return;
      }
      if (cmdPaletteOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedTabIdx(prev => Math.min(prev + 1, filteredAllTabs.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedTabIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && selectedTabIdx >= 0) {
        // Index into the SAME list the arrow keys navigate (filtered), not the
        // full tab list — otherwise a search filter selects the wrong tab.
        const tab = filteredAllTabs[selectedTabIdx];
        if (tab) handleSwitchTab(tab.id);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTabIdx >= 0 && document.activeElement?.tagName !== 'INPUT') {
        const tab = filteredAllTabs[selectedTabIdx];
        if (tab) handleCloseTab(tab.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTabIdx, filteredAllTabs, handleSwitchTab, handleCloseTab, cmdPaletteOpen, tabs]);

  const sharedTabProps = {
    showFavicons: settings.showFavicons,
    showUrls: settings.showUrls,
    compact: settings.compactMode,
    highlightText: search.query ? search.highlightText : null,
    matchingTabIds: search.matchingTabIds,
    windows: filteredWindows,
    suspendedTabs: tabs.suspendedTabs,
    duplicateTabIds,
    onSwitch: handleSwitchTab,
    onClose: handleCloseTab,
    onPin: tabs.pinTab,
    onMute: tabs.muteTab,
    onDuplicate: handleDuplicate,
    onMoveToWindow: tabs.moveTab,
    onMoveToNewWindow: tabs.moveTabToNewWindow,
    onCloseOthers: handleCloseOthersInWindow,
    onCloseToRight: tabs.closeTabsToRight,
    onReorderTab: tabs.reorderTab,
    onMoveTab: tabs.moveTab,
    onSuspend: tabs.suspendTab,
    onUnsuspend: tabs.unsuspendTab,
    isFavorite,
    toggleFavorite,
    selectMode,
    selectedTabIds,
    onToggleSelect: toggleTabSelection,
    onSelectAllInWindow: selectAllInWindow,
  };

  // Advanced / secondary features — consolidated into a single header menu so the
  // common path (search + tabs) stays uncluttered. Nothing removed, just demoted.
  // Single overflow menu — replaces the old separate toolbar "More" + header
  // "Advanced" menus. Sectioned so views and bulk actions stay distinct.
  const advancedItems = [
    { type: 'label', text: 'Views' },
    { id: 'heatmap', icon: Flame, label: 'Activity', onClick: () => setActivePanel(prev => prev === 'heatmap' ? null : 'heatmap') },
    { id: 'autoclose', icon: Timer, label: 'Auto-Close', onClick: () => setActivePanel('autoclose') },
    { id: 'sep1' },
    { type: 'label', text: 'Tab actions' },
    { id: 'suspend', icon: Pause, label: 'Suspend inactive', onClick: quickActionHandlers.onSuspendInactive },
    { id: 'resume', icon: Play, label: 'Resume all', onClick: quickActionHandlers.onUnsuspendAll },
    { id: 'mute', icon: VolumeX, label: 'Mute all', onClick: quickActionHandlers.onMuteAll },
    { id: 'unmute', icon: Volume2, label: 'Unmute all', onClick: quickActionHandlers.onUnmuteAll },
    { id: 'dupes', icon: ClipboardCheck, label: 'Close duplicates', onClick: quickActionHandlers.onCloseDuplicates },
  ];

  const showBackButton = ['settings', 'heatmap', 'help', 'autoclose', 'profiles'].includes(activePanel);

  if (activePanel === 'focus') {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-col h-full bg-background font-body" data-testid="sidebar">
          <FocusMode
            allTabs={tabs.allTabs}
            windows={tabs.windows}
            onSwitch={handleSwitchTab}
            onExit={() => { setActivePanel(null); setPersistedFocus(null); }}
            onHideTabs={tabs.hideTabs}
            onUnhideTabs={tabs.unhideTabs}
            persistedFocus={persistedFocus}
          />
          <StatsBar allTabs={tabs.allTabs} suspendedCount={tabs.suspendedTabs.size} dupCount={duplicateInfo.count} />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-background font-body" data-testid="sidebar">
        <CommandPalette allTabs={tabs.allTabs} onSwitch={handleSwitchTab} isOpen={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />

        {/* First-time tour */}
        {showTour && <TourGuide onComplete={() => setShowTour(false)} />}

        {/* Confirm action dialog */}
        {confirmPending && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50" onClick={() => setConfirmPending(null)}>
            <div
              className="bg-popover border border-border rounded-2xl p-5 shadow-2xl w-[280px] space-y-4 animate-slide-in"
              onClick={(e) => e.stopPropagation()}
              data-testid="confirm-dialog"
            >
              <p className="text-[13px] font-body text-foreground leading-relaxed">{confirmPending.message}</p>
              <div className="flex gap-2">
                <button
                  data-testid="confirm-action-btn"
                  onClick={() => { confirmPending.action(); setConfirmPending(null); }}
                  className="cursor-pointer flex-1 h-8 text-[11px] font-heading font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Confirm
                </button>
                <button
                  data-testid="cancel-action-btn"
                  onClick={() => setConfirmPending(null)}
                  className="cursor-pointer flex-1 h-8 text-[11px] font-heading text-muted-foreground border border-border rounded-lg hover:text-foreground hover:bg-[hsl(var(--hover-subtle))] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="px-2 pt-2 pb-1 space-y-1 bg-background/95 border-b border-border backdrop-blur-md sticky top-0 z-10" data-testid="sidebar-header">
          {/* Row 1: title + panel buttons */}
          <div className="flex items-center gap-1.5">
            {/* Wordmark only — the plane mark lives on the Chrome toolbar icon, no need
                to duplicate it inside the panel. Two-tone matches the landing page. */}
            <span className="text-[13px] font-heading font-bold tracking-tight shrink-0" data-testid="brand-lockup">
              <span className="text-foreground">Tab</span>{' '}
              <span className="text-primary">Radar</span>
            </span>
            <div className="flex-1" />
            {/* More menu — genuinely secondary panels (Settings lives bottom-right) */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="advanced-menu-btn"
                      aria-label="Advanced menu"
                      className={`cursor-pointer p-1.5 rounded-md transition-all duration-150 active:scale-95
                        ${['heatmap', 'autoclose', 'help'].includes(activePanel)
                          ? 'text-primary bg-primary/15'
                          : 'text-foreground/50 hover:text-foreground hover:bg-[hsl(var(--hover-medium))]'
                        }`}
                    >
                      <SlidersHorizontal size={13} strokeWidth={1.8} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] font-body">Advanced</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44 font-body">
                {advancedItems.map((item, i) => {
                  if (item.type === 'label') {
                    return <DropdownMenuLabel key={`l${i}`} className="text-[10px] text-muted-foreground/60 font-normal uppercase tracking-wider">{item.text}</DropdownMenuLabel>;
                  }
                  if (item.id?.startsWith('sep')) {
                    return <DropdownMenuSeparator key={item.id} />;
                  }
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.id} onClick={item.onClick} data-testid={`advanced-${item.id}`} className="text-xs gap-2 cursor-pointer">
                      <Icon size={13} strokeWidth={1.5} /> {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Collapse — only in web preview mode (sidePanel has no collapse API) */}
            {onCollapse && !isExtensionContext() && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="collapse-sidebar-btn"
                    aria-label="Collapse sidebar"
                    onClick={() => onCollapse()}
                    className="p-1.5 rounded-md transition-all duration-150 text-foreground/50 hover:text-foreground hover:bg-[hsl(var(--hover-medium))] active:scale-95"
                  >
                    <ArrowLeft size={13} strokeWidth={1.8} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] font-body">Collapse sidebar</TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Row 2: full-width search bar */}
          <SearchBar
            query={search.query} setQuery={search.setQuery}
            resultCount={search.resultCount} clearSearch={search.clearSearch}
            inputRef={searchInputRef} suggestions={search.suggestions}
            onSwitchTab={handleSwitchTab}
          />
          {/* Only show toolbar when viewing tabs (no active panel or heatmap/focus which are tab-related) */}
          {(!activePanel || activePanel === 'heatmap' || activePanel === 'focus') && (
            <QuickActions handlers={quickActionHandlers} viewMode={viewMode} activePanel={activePanel}
              selectMode={selectMode} onToggleSelectMode={toggleSelectMode} />
          )}
        </div>

        {/* Bulk action bar */}
        {selectMode && (
          <div className="px-2.5 py-1.5 bg-primary/[0.08] border-b border-primary/20 flex flex-wrap items-center gap-2.5" data-testid="bulk-action-bar">
            {/* Select all / deselect all checkbox */}
            <button
              onClick={selectedTabIds.size === filteredAllTabs.length ? deselectAllTabs : selectAllTabs}
              className="cursor-pointer shrink-0"
              data-testid="select-all-checkbox"
              title={selectedTabIds.size === filteredAllTabs.length ? 'Deselect all' : 'Select all'}
            >
              <div className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center cursor-pointer transition-all duration-150
                ${selectedTabIds.size === filteredAllTabs.length
                  ? 'bg-primary border-primary'
                  : selectedTabIds.size > 0
                    ? 'bg-primary/30 border-primary/60'
                    : 'border-muted-foreground/40 hover:border-muted-foreground/60'
                }`}
              >
                {selectedTabIds.size === filteredAllTabs.length && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                {selectedTabIds.size > 0 && selectedTabIds.size < filteredAllTabs.length && <Minus size={10} className="text-primary" strokeWidth={3} />}
              </div>
            </button>
            <span className="text-[11px] font-heading font-semibold text-foreground/80 flex-1">
              {selectedTabIds.size} selected
            </span>
            {selectedTabIds.size > 0 && (
              <button
                onClick={deselectAllTabs}
                className="cursor-pointer flex items-center gap-1 text-[10px] font-heading font-semibold text-muted-foreground hover:text-foreground
                  transition-colors px-2 py-1 rounded-md hover:bg-[hsl(var(--hover-medium))]"
                data-testid="clear-selection-btn"
              >
                <XIcon size={10} strokeWidth={2} />
                Clear
              </button>
            )}
            <button
              onClick={handleBulkClose}
              disabled={selectedTabIds.size === 0}
              className="cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1 text-[10px] font-heading font-semibold text-destructive hover:text-destructive/80
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-md bg-destructive/10 hover:bg-destructive/15"
              data-testid="bulk-close-btn"
            >
              <Trash2 size={11} strokeWidth={2} />
              Close {selectedTabIds.size}
            </button>
            <button
              onClick={handleCloseOthers}
              disabled={selectedTabIds.size === 0 || othersToClose.length === 0}
              className="cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1 text-[10px] font-heading font-semibold text-destructive hover:text-destructive/80
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-md bg-destructive/10 hover:bg-destructive/15"
              data-testid="bulk-close-others-btn"
              title={selectedTabIds.size === 0
                ? 'Select the tabs you want to keep first'
                : `Keep the ${selectedTabIds.size} selected tab${selectedTabIds.size > 1 ? 's' : ''} and close the other ${othersToClose.length} (pinned tabs are kept)`}
            >
              <ListX size={11} strokeWidth={2} />
              Close rest{othersToClose.length > 0 ? ` (${othersToClose.length})` : ''}
            </button>
          </div>
        )}

        {/* Back button — always visible outside scroll area */}
        {showBackButton && (
          <button
            data-testid={`back-from-${activePanel}`}
            onClick={() => setActivePanel(null)}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full border-b border-border/30 bg-background"
          >
            <ArrowLeft size={10} strokeWidth={1.5} /> Back to tabs
          </button>
        )}

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="w-full pr-1.5" data-testid="sidebar-scroll-content">
          {activePanel === 'settings' ? (
            <div className="animate-panel-enter"><SettingsPanel settings={settings} onUpdate={updateSetting} onOpenProfiles={() => setActivePanel('profiles')} /></div>
          ) : activePanel === 'heatmap' ? (
            <div className="animate-panel-enter">
              <HeatmapPanel allTabs={tabs.allTabs} onSwitch={handleSwitchTab} selectMode={selectMode} selectedTabIds={selectedTabIds} onToggleSelect={toggleTabSelection} />
            </div>
          ) : activePanel === 'help' ? (
            <div className="animate-panel-enter"><HelpPanel onBack={() => setActivePanel(null)} /></div>
          ) : activePanel === 'autoclose' ? (
            <div className="animate-panel-enter">
              <AutoClosePanel allTabs={filteredAllTabs} onClose={handleCloseTab} onAutoClose={tabs.closeTab} settings={settings} onUpdateSetting={updateSetting} visitCounts={visitCounts} onKeepOpen={handleKeepOpenTab} />
            </div>
          ) : activePanel === 'profiles' ? (
            <div className="animate-panel-enter"><ProfilePanel /></div>
          ) : (
            <div>
              {/* Duplicate banner sits at the top, next to the tabs it refers to */}
              <DuplicatePanel allTabs={filteredAllTabs} duplicates={duplicateInfo.groups} onCloseDuplicates={handleCloseDuplicates} onCloseTab={handleCloseTab} />
              {/* Favorites section — proper card (border + rounded + tint)
                  so it reads as a distinct group. Stars are hidden on
                  TabItems inside (via hideStar) because the section header
                  already marks these as favorites — no need to repeat it
                  per row. User can still unfavorite via right-click menu. */}
              {(() => {
                const favoritedTabs = filteredAllTabs.filter(t => isFavorite(t.url));
                if (favoritedTabs.length === 0) return null;
                return (
                  <div className="ml-2 mr-0.5 my-1.5 rounded-md border border-primary/30 bg-primary/[0.05] overflow-hidden" data-testid="favorites-section">
                    <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                      <Star size={12} className="text-primary shrink-0" fill="currentColor" strokeWidth={2} />
                      <span className="text-[11px] font-heading font-semibold text-primary/90 truncate">
                        Favorites
                      </span>
                      <span className="text-[11px] font-mono text-primary/50 ml-auto">{favoritedTabs.length}</span>
                    </div>
                    <div className="pb-1">
                      {favoritedTabs.map(tab => (
                        <TabItem
                          key={tab.id}
                          tab={tab}
                          isActive={tab.active}
                          showFavicons={settings.showFavicons}
                          showUrls={false}
                          compact={true}
                          suspended={tabs.suspendedTabs.has(tab.id)}
                          isDuplicate={duplicateTabIds.has(tab.id)}
                          onSwitch={handleSwitchTab}
                          onClose={handleCloseTab}
                          onPin={tabs.pinTab}
                          onMute={tabs.muteTab}
                          onDuplicate={handleDuplicate}
                          onMoveToNewWindow={tabs.moveTabToNewWindow}
                          onMoveToWindow={tabs.moveTab}
                          onCloseOthers={handleCloseOthersInWindow}
                          onCloseToRight={tabs.closeTabsToRight}
                          onSuspend={tabs.suspendTab}
                          onUnsuspend={tabs.unsuspendTab}
                          isFavorite={isFavorite}
                          toggleFavorite={toggleFavorite}
                          hideStar={true}
                          windows={filteredWindows}
                          currentWindowId={tab.windowId}
                          selectMode={selectMode}
                          isSelected={selectedTabIds.has(tab.id)}
                          onToggleSelect={toggleTabSelection}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
              {viewMode === 'window' ? (
                filteredWindows.map(win => (
                  <WindowGroup
                    key={win.id} window={win} tabGroups={tabs.tabGroups}
                    onCloseWindow={(winId) => {
                      // Always confirm window close regardless of settings
                      setConfirmPending({ message: 'Close this window and all its tabs?', action: () => tabs.closeWindow(winId) });
                    }}
                    onMinimizeWindow={tabs.minimizeWindow}
                    onCreateTabInWindow={tabs.createTabInWindow}
                    onRenameWindow={tabs.renameWindow}
                    {...sharedTabProps}
                  />
                ))
              ) : (
                <DomainView allTabs={filteredAllTabs} {...sharedTabProps} />
              )}
              {(filteredAllTabs.length === 0 || (search.query.trim() && search.resultCount === 0)) && (
                <div className="px-4 py-12 text-center" data-testid="empty-state">
                  <p className="text-[12px] font-body text-muted-foreground">
                    {search.query ? `No tabs match "${search.query}"` : 'No tabs open'}
                  </p>
                  {search.query && (
                    <button
                      onClick={search.clearSearch}
                      className="cursor-pointer mt-2 text-[11px] font-heading font-semibold text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </ScrollArea>

        <ProfileSwitcher onOpenSettings={() => setActivePanel('settings')} onOpenHelp={() => setActivePanel('help')} onOpenProfiles={() => setActivePanel('profiles')} allTabs={filteredAllTabs} suspendedCount={tabs.suspendedTabs.size} dupCount={duplicateInfo.count} />
      </div>
    </TooltipProvider>
  );
}
