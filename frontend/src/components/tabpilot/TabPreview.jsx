import { useState, useRef, useEffect } from 'react';
import { getDomain, getFaviconUrl, handleFaviconError } from '@/utils/grouping';
import { Pin, Volume2, Pause, StickyNote } from 'lucide-react';

export function TabPreview({ tab, suspended, tabNote, anchorRect, onClose }) {
  const ref = useRef(null);
  const domain = getDomain(tab.url);
  const faviconUrl = getFaviconUrl(tab.url, tab.favIconUrl);

  // Position the preview at the sidebar's right edge, aligned with the hovered tab
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRect) return;
    const previewH = 160;
    const previewW = 240;

    const sidebar = document.querySelector('[data-testid="sidebar-container"]');
    const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : anchorRect.right;

    let top = anchorRect.top;
    let left = sidebarRight + 8;

    if (top + previewH > window.innerHeight) {
      top = window.innerHeight - previewH - 8;
    }
    if (top < 8) top = 8;

    if (left + previewW > window.innerWidth) {
      left = (sidebar ? sidebar.getBoundingClientRect().left : anchorRect.left) - previewW - 8;
    }

    setPosition({ top, left });
  }, [anchorRect]);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[240px] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-in"
      style={{ top: position.top, left: position.left }}
      onMouseLeave={onClose}
      data-testid={`tab-preview-${tab.id}`}
    >
      {/* Visual preview header */}
      <div className="relative overflow-hidden" style={{ height: '70px', background: `linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.1))` }}>
        <div className="absolute top-0 left-0 right-0 h-5 bg-black/30 backdrop-blur-sm flex items-center gap-1.5 px-2">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 h-2.5 bg-white/10 rounded-sm flex items-center px-1">
            <span className="text-[5px] text-white/50 truncate">{tab.url}</span>
          </div>
        </div>
        <div className="absolute inset-0 top-5 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            {faviconUrl && (
              <img src={faviconUrl} alt="" className="w-6 h-6 rounded-lg shadow-lg"
                data-tab-url={tab.url} data-chrome-favicon={tab.favIconUrl || ''} onError={handleFaviconError} />
            )}
            <span className="text-[11px] text-white/60 font-mono">{domain}</span>
          </div>
        </div>
        {/* Status badges */}
        <div className="absolute top-6 right-1.5 flex gap-0.5">
          {tab.pinned && (
            <div className="p-0.5 rounded bg-black/30 backdrop-blur-sm">
              <Pin size={8} className="text-tp-pinned" strokeWidth={2} />
            </div>
          )}
          {tab.audible && !tab.mutedInfo?.muted && (
            <div className="p-0.5 rounded bg-black/30 backdrop-blur-sm">
              <Volume2 size={8} className="text-tp-audible" strokeWidth={2} />
            </div>
          )}
          {suspended && (
            <div className="p-0.5 rounded bg-black/30 backdrop-blur-sm">
              <Pause size={8} className="text-blue-400" strokeWidth={2} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-2.5 space-y-2">
        <div>
          <div className="text-[11px] font-body font-medium leading-tight line-clamp-2">{tab.title}</div>
          <div className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{domain}</div>
        </div>

        {/* Note */}
        {tabNote && (
          <div className="flex items-start gap-1.5 p-1.5 rounded-md bg-primary/[0.06] border border-primary/10">
            <StickyNote size={9} className="text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
            <span className="text-[11px] text-foreground/70 leading-relaxed">{tabNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to manage tab preview state
 */
export function useTabPreview() {
  const [preview, setPreview] = useState(null);
  const timerRef = useRef(null);

  const showPreview = (tab, event, extraProps = {}) => {
    clearTimeout(timerRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    timerRef.current = setTimeout(() => {
      setPreview({ tab, anchorRect: rect, ...extraProps });
    }, 350);
  };

  const hidePreview = () => {
    clearTimeout(timerRef.current);
    setPreview(null);
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { preview, showPreview, hidePreview };
}
