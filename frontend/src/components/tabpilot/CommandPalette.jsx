import { useState, useEffect, useRef, useMemo } from 'react';
import { Command, X } from 'lucide-react';
import { getFaviconUrl, getDomain, handleFaviconError } from '@/utils/grouping';

export function CommandPalette({ allTabs, onSwitch, isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return allTabs.slice(0, 10);
    const q = query.toLowerCase();
    return allTabs.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.url.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, allTabs]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(prev => Math.max(prev - 1, 0)); }
      if (e.key === 'Enter' && filtered[selectedIdx]) {
        e.preventDefault();
        onSwitch(filtered[selectedIdx].id);
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, filtered, selectedIdx, onSwitch, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
      data-testid="command-palette-overlay"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-md bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Command size={14} className="text-primary shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to switch to any tab..."
            className="flex-1 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--hover-medium))] transition-colors">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-1" data-testid="command-palette-results">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground font-body">No tabs found</div>
          ) : (
            filtered.map((tab, idx) => (
              <button
                key={tab.id}
                data-testid={`cmd-result-${tab.id}`}
                onClick={() => { onSwitch(tab.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                  ${idx === selectedIdx ? 'bg-primary/10' : 'hover:bg-[hsl(var(--hover-subtle))]'}`}
              >
                <img
                  src={getFaviconUrl(tab.url, tab.favIconUrl)}
                  alt=""
                  className="w-4 h-4 rounded-[3px] shrink-0"
                  data-tab-url={tab.url}
                  data-chrome-favicon={tab.favIconUrl || ''}
                  onError={handleFaviconError}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-body truncate text-foreground">{tab.title}</div>
                  <div className="text-[10px] text-muted-foreground/50 truncate">{getDomain(tab.url)}</div>
                </div>
                {tab.active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 text-[11px] text-muted-foreground/50 font-mono">
          <span>Arrow keys to navigate</span>
          <span>Enter to switch</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
