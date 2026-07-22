import { getDomain, getFaviconUrl, groupByDomain, handleFaviconError } from '@/utils/grouping';
import { Globe, ChevronRight, Check, X, Pin, Volume2, Pause } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function DomainView({
  allTabs, windows, showFavicons, showUrls, compact,
  highlightText, matchingTabIds,
  onSwitch, onClose, onPin, onMute, onDuplicate,
  onMoveToWindow, onMoveToNewWindow, onCloseOthers, onCloseToRight,
  onReorderTab, onMoveTab, suspendedTabs, onSuspend, onUnsuspend,
  onHoverEnter, onHoverLeave, duplicateTabIds,
  selectMode, selectedTabIds, onToggleSelect, onSelectAllInWindow
}) {
  const filteredTabs = matchingTabIds
    ? allTabs.filter(t => matchingTabIds.has(t.id))
    : allTabs;

  const domains = groupByDomain(filteredTabs);
  const focusedWindowId = windows?.find(w => w.focused)?.id;

  return (
    <div className="py-0.5" data-testid="domain-view">
      {domains.map(({ domain, tabs }) => (
        <DomainGroup
          key={domain}
          domain={domain}
          tabs={tabs}
          showFavicons={showFavicons}
          compact={compact}
          highlightText={highlightText}
          onSwitch={onSwitch}
          onClose={onClose}
          suspendedTabs={suspendedTabs}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          focusedWindowId={focusedWindowId}
          selectMode={selectMode}
          selectedTabIds={selectedTabIds}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

function DomainGroup({
  domain, tabs, showFavicons, compact,
  highlightText, onSwitch, onClose,
  suspendedTabs,
  onHoverEnter, onHoverLeave, focusedWindowId,
  selectMode, selectedTabIds, onToggleSelect
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const faviconUrl = getFaviconUrl(tabs[0]?.url, tabs[0]?.favIconUrl);
  const activeTabs = tabs.filter(t => t.active).length;
  // Short domain for display
  const shortDomain = domain.replace(/^www\./, '');

  const allSelected = tabs.length > 0 && tabs.every(t => selectedTabIds?.has(t.id));
  const someSelected = tabs.some(t => selectedTabIds?.has(t.id));

  const handleSelectAllDomain = (e) => {
    e.stopPropagation();
    if (allSelected) {
      tabs.forEach(t => onToggleSelect?.(t.id));
    } else {
      tabs.forEach(t => { if (!selectedTabIds?.has(t.id)) onToggleSelect?.(t.id); });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div data-testid={`domain-group-${domain}`}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer
            hover:bg-[hsl(var(--hover-subtle))] transition-colors duration-150"
          >
            {selectMode ? (
              <button
                onClick={handleSelectAllDomain}
                className="cursor-pointer shrink-0"
              >
                <div className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center cursor-pointer transition-all duration-150
                  ${allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/30 border-primary/60' : 'border-muted-foreground/30'}`}>
                  {allSelected && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                  {someSelected && !allSelected && <div className="w-1.5 h-0.5 rounded-full bg-primary" />}
                </div>
              </button>
            ) : (
              <ChevronRight
                size={11}
                className={`text-muted-foreground/60 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                strokeWidth={2}
              />
            )}
            {showFavicons && faviconUrl ? (
              <img src={faviconUrl} alt="" className="w-4 h-4 rounded-[3px] shrink-0" data-tab-url={tabs[0]?.url} data-chrome-favicon={tabs[0]?.favIconUrl || ''} onError={handleFaviconError} />
            ) : (
              <Globe size={12} className="text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
            )}
            <span className="text-[11px] font-heading font-semibold truncate flex-1 min-w-0">{shortDomain}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {activeTabs > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              <span className="text-[11px] text-muted-foreground/60 font-mono">{tabs.length}</span>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* Indented + a subtle guide line so child tabs read as nested under the domain */}
          <div className="ml-[19px] pl-2.5 border-l border-border/60 pb-0.5">
            {(() => {
              const TAB_LIMIT = 10;
              const visibleTabs = (!showAll && tabs.length > TAB_LIMIT) ? tabs.slice(0, TAB_LIMIT) : tabs;
              const remaining = tabs.length - TAB_LIMIT;
              return (
                <>
                  {visibleTabs.map(tab => (
                    <DomainTabItem
                      key={tab.id}
                      tab={tab}
                      compact={compact}
                      highlightText={highlightText}
                      onSwitch={onSwitch}
                      onClose={onClose}
                      suspended={suspendedTabs?.has(tab.id)}
                      onHoverEnter={onHoverEnter}
                      onHoverLeave={onHoverLeave}
                      focusedWindowId={focusedWindowId}
                      selectMode={selectMode}
                      isSelected={selectedTabIds?.has(tab.id)}
                      onToggleSelect={onToggleSelect}
                    />
                  ))}
                  {!showAll && remaining > 0 && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="flex items-center gap-1 w-full px-2 py-1 text-[10px] text-primary/70
                        hover:text-primary hover:bg-primary/[0.04] transition-colors font-body cursor-pointer"
                    >
                      <ChevronRight size={10} strokeWidth={2} />
                      Show {remaining} more tab{remaining > 1 ? 's' : ''}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DomainTabItem({ tab, compact, highlightText, onSwitch, onClose, suspended, onHoverEnter, onHoverLeave, focusedWindowId, selectMode, isSelected, onToggleSelect }) {
  return (
    <div
      data-testid={`domain-tab-${tab.id}`}
      onClick={() => {
        if (suspended) return;
        if (selectMode) { onToggleSelect?.(tab.id); return; }
        onSwitch(tab.id);
      }}
      onMouseEnter={(e) => onHoverEnter?.(tab, e)}
      onMouseLeave={() => onHoverLeave?.()}
      className={`group flex items-center gap-1.5 cursor-pointer transition-all duration-150 relative
        ${compact ? 'px-2 py-[3px]' : 'px-2 py-[5px]'}
        ${(tab.active && tab.windowId === focusedWindowId)
          ? 'bg-primary/[0.10] text-foreground'
          : 'hover:bg-[hsl(var(--hover-subtle))] text-foreground/75'
        }
        ${suspended ? 'opacity-35' : ''}
        ${isSelected ? 'bg-primary/[0.08]' : ''}
      `}
    >
      {selectMode && (
        <div className={`w-3 h-3 rounded-[2px] border flex items-center justify-center shrink-0 transition-all duration-150
          ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
          {isSelected && <Check size={8} className="text-primary-foreground" strokeWidth={3} />}
        </div>
      )}
      <span className={`font-body leading-tight truncate flex-1 min-w-0 ${compact ? 'text-[11px]' : 'text-[11.5px]'}`}>
        {highlightText ? highlightText(tab.title) : tab.title}
      </span>
      <div className="flex items-center gap-0 shrink-0">
        {tab.pinned && <Pin size={9} className="text-tp-pinned" strokeWidth={2} />}
        {tab.audible && !tab.mutedInfo?.muted && <Volume2 size={9} className="text-tp-audible" strokeWidth={2} />}
        {suspended && <Pause size={9} className="text-muted-foreground/40" strokeWidth={2} />}
      </div>
      {!selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
          className="cursor-pointer p-0.5 rounded-[3px] text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10
            opacity-0 group-hover:opacity-100 transition-all duration-100 shrink-0"
        >
          <X size={10} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
