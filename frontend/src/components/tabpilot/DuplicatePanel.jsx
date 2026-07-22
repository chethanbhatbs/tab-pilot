import { findDuplicates, normalizeUrl } from '@/utils/grouping';
import { AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getFaviconUrl, getDomain, handleFaviconError } from '@/utils/grouping';
import { useState } from 'react';

export function DuplicatePanel({ allTabs, duplicates: duplicatesProp, onCloseDuplicates, onCloseTab }) {
  const [isOpen, setIsOpen] = useState(false);
  // Prefer the precomputed list from the parent; fall back to computing locally
  // so the component still works standalone.
  const duplicates = duplicatesProp ?? findDuplicates(allTabs);

  if (duplicates.length === 0) return null;

  const totalDupes = duplicates.reduce((sum, d) => sum + d.tabs.length - 1, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mx-2 my-1.5 rounded-md border border-tp-duplicate/30 bg-tp-duplicate/5 overflow-hidden" data-testid="duplicate-panel">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer hover:bg-tp-duplicate/10 transition-colors rounded-md">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <AlertTriangle size={12} className="text-tp-duplicate shrink-0" strokeWidth={2} />
              <span className="text-[11px] font-body text-tp-duplicate font-semibold truncate">
                {totalDupes} duplicate{totalDupes !== 1 ? 's' : ''} found
              </span>
            </div>
            <button
              data-testid="close-all-duplicates-btn"
              onClick={(e) => { e.stopPropagation(); onCloseDuplicates(); }}
              className="text-[10px] font-heading font-semibold text-tp-duplicate hover:text-foreground
                bg-tp-duplicate/20 hover:bg-tp-duplicate/30 px-2 py-0.5 rounded transition-colors shrink-0"
            >
              Fix All
            </button>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-2.5 pb-2 space-y-1.5">
            {duplicates.map(({ url, tabs }) => {
              const domain = getDomain(url);
              const favicon = getFaviconUrl(url, tabs[0]?.favIconUrl);
              return (
                <div key={url} className="rounded-md bg-background/50 p-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <img src={favicon} alt="" className="w-3.5 h-3.5 rounded-[2px] shrink-0" data-tab-url={url} data-chrome-favicon={tabs[0]?.favIconUrl || ''} onError={handleFaviconError} />
                    <span className="text-[10px] text-muted-foreground truncate font-body">{domain}</span>
                    <span className="text-[11px] font-mono text-tp-duplicate ml-auto">{tabs.length}x open</span>
                  </div>
                  {(() => {
                    // Keep the active tab; fall back to most recently accessed
                    const keepId = (tabs.find(t => t.active) || [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0])?.id;
                    return tabs.map((tab) => {
                      const isKeep = tab.id === keepId;
                      return (
                        <div key={tab.id} className="flex items-center justify-between py-0.5 pl-6">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {isKeep ? (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 border-tp-audible/50 text-tp-audible shrink-0">
                                keep
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 border-tp-duplicate/50 text-tp-duplicate shrink-0">
                                extra
                              </Badge>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] text-foreground/60 truncate">{tab.title}</span>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {tab.active ? 'Active' : `Window ${tab.windowId}`}
                              </span>
                            </div>
                          </div>
                          {!isKeep && (
                            <button
                              data-testid={`close-dupe-${tab.id}`}
                              onClick={() => onCloseTab(tab.id)}
                              className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1"
                            >
                              <X size={10} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Helper to compute duplicate tab IDs set for inline marking
export function getDuplicateTabIds(allTabs) {
  const urlMap = {};
  const duplicateIds = new Set();
  allTabs.forEach(t => {
    if (!t.url) return;
    const normalized = normalizeUrl(t.url);
    if (urlMap[normalized]) {
      duplicateIds.add(t.id);
      duplicateIds.add(urlMap[normalized]);
    } else {
      urlMap[normalized] = t.id;
    }
  });
  return duplicateIds;
}
