import { memo } from 'react';
import { getDomain, getFaviconUrl, handleFaviconError, handleFaviconLoad, getLetterAvatar } from '@/utils/grouping';
import { Pin, Volume2, VolumeX, X, Loader2, Copy, GripVertical, Pause, Check, Star } from 'lucide-react';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger,
  ContextMenuSubContent, ContextMenuTrigger
} from '@/components/ui/context-menu';
import {
  Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

function TabItemImpl({
  tab, isActive, showFavicons, showUrls, compact, suspended, isDuplicate,
  highlightText, onSwitch, onClose, onPin, onMute, onDuplicate,
  onMoveToNewWindow, onMoveToWindow, onCloseOthers, onCloseToRight,
  onSuspend, onUnsuspend,
  windows, currentWindowId,
  onDragStart, onDragEnd,
  onHoverEnter, onHoverLeave,
  selectMode, isSelected, onToggleSelect,
  isFavorite, toggleFavorite,
  hideStar = false,  // suppress the star slot (used inside the Favorites box)
}) {
  const domain = getDomain(tab.url);
  const faviconUrl = showFavicons ? getFaviconUrl(tab.url, tab.favIconUrl) : null;
  const avatar = !faviconUrl ? getLetterAvatar(tab.url) : null;
  const isLoading = tab.status === 'loading';
  const isPinned = tab.pinned;
  const isAudible = tab.audible && !tab.mutedInfo?.muted;
  const isMuted = tab.mutedInfo?.muted;
  const isSuspended = suspended;
  const tabIsFavorite = isFavorite?.(tab.url);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(tab.url);
    toast.success('URL copied');
  };

  const otherWindows = windows?.filter(w => w.id !== currentWindowId) || [];

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          data-testid={`tab-item-${tab.id}`}
          draggable
          onDragStart={(e) => { e.currentTarget.classList.add('tp-dragging'); onDragStart?.(e, tab); }}
          onDragEnd={(e) => { e.currentTarget.classList.remove('tp-dragging'); onDragEnd?.(e); }}
          onMouseEnter={(e) => onHoverEnter?.(tab, e)}
          onMouseLeave={() => onHoverLeave?.()}
          onClick={() => {
            if (selectMode) { onToggleSelect?.(tab.id); return; }
            if (isSuspended) onUnsuspend?.(tab.id);
            onSwitch(tab.id);
          }}
          className={`group flex items-center gap-1.5 cursor-pointer transition-all duration-150 select-none relative
            ${compact ? 'px-2 py-[3px]' : 'px-2 py-[5px]'}
            ${isActive
              ? 'bg-primary/[0.16] text-foreground font-medium'
              : 'hover:bg-[hsl(var(--hover-subtle))] text-foreground/75'
            }
            ${isSuspended ? 'opacity-35' : ''}
          `}
        >

          {/* Select checkbox or drag handle */}
          {selectMode ? (
            <div
              className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center cursor-pointer shrink-0 transition-all duration-150
                ${isSelected
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground/30 hover:border-muted-foreground/50'
                }`}
              data-testid={`select-checkbox-${tab.id}`}
            >
              {isSelected && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
            </div>
          ) : (
            <div className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0 cursor-grab active:cursor-grabbing"
              data-testid={`drag-handle-${tab.id}`}
            >
              <GripVertical size={10} strokeWidth={1.5} />
            </div>
          )}

          {/* Favicon + status indicators */}
          <div className="w-4 h-4 shrink-0 flex items-center justify-center relative rounded bg-secondary/50">
            {isLoading ? (
              <Loader2 size={12} className="animate-spin text-primary" strokeWidth={1.5} />
            ) : isSuspended ? (
              <Pause size={12} className="text-muted-foreground/40" strokeWidth={1.5} />
            ) : faviconUrl ? (
              <img src={faviconUrl} alt="" className="w-4 h-4 rounded-[3px]" data-tab-url={tab.url} data-chrome-favicon={tab.favIconUrl || ''} onLoad={handleFaviconLoad} onError={handleFaviconError} />
            ) : (
              <div className="w-4 h-4 rounded-[3px] flex items-center justify-center text-[11px] font-bold"
                style={{ background: avatar?.color.bg, color: avatar?.color.fg }}
              >{avatar?.letter}</div>
            )}
          </div>

          {/* Title + URL */}
          <div className="flex-1 min-w-0">
            <div className={`font-body leading-tight truncate ${compact ? 'text-[11px]' : 'text-[11.5px]'}`}>
              {highlightText ? highlightText(tab.title) : tab.title}
            </div>
            {showUrls && !compact && (
              <div className="text-[10px] text-muted-foreground/60 truncate leading-tight mt-0.5">
                {highlightText ? highlightText(domain) : domain}
              </div>
            )}
          </div>

          {/* Right-side action rail — intentionally minimal.
              Pin: reserved 16px slot (icon only when pinned).
              Mute: inline only for audible / muted tabs.
              Close: absolute far-right, hover-only.
              Favorite star is NOT shown on individual rows — favorited tabs
              are surfaced in the Favorites box at the top of the sidebar, and
              the right-click menu handles add / remove. This keeps every row
              visually quiet. */}
          <div className="flex items-center gap-0 shrink-0 relative pr-[18px]">
            {/* Pin slot */}
            <div className="w-[16px] h-[16px] flex items-center justify-center">
              {isPinned && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="cursor-pointer w-full h-full rounded-[3px] hover:bg-tp-pinned/20 transition-colors active:scale-90 text-tp-pinned flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onPin(tab.id); }}
                      data-testid={`pin-badge-${tab.id}`}
                    >
                      <Pin size={11} strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">Click to unpin</TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* Mute — inline only when the tab is audible/muted */}
            {(isAudible || isMuted) && (
              <div className="w-[16px] h-[16px] flex items-center justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      data-testid={`tab-mute-${tab.id}`}
                      onClick={(e) => { e.stopPropagation(); onMute(tab.id); }}
                      className={`cursor-pointer w-full h-full rounded-[3px] transition-all duration-150 hover:bg-[hsl(var(--hover-medium))] flex items-center justify-center
                        ${isAudible ? 'text-tp-audible' : 'text-muted-foreground/60'}`}
                    >
                      {isMuted ? <VolumeX size={11} strokeWidth={1.5} /> : <Volume2 size={11} strokeWidth={1.5} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">{isMuted ? 'Unmute tab' : 'Mute tab'}</TooltipContent>
                </Tooltip>
              </div>
            )}
            {/* Close — absolute far-right, hover-only */}
            <button
              data-testid={`tab-close-${tab.id}`}
              aria-label="Close tab"
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer w-[16px] h-[16px] rounded-[3px] text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10
                opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center"
            >
              <X size={11} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52 font-body text-xs" data-testid={`tab-context-menu-${tab.id}`}>
        {/* Navigation */}
        <ContextMenuItem className="cursor-pointer" onClick={() => onSwitch(tab.id)}>Switch to tab</ContextMenuItem>
        <ContextMenuSeparator />

        {/* Favorite toggle */}
        <ContextMenuItem
          className="cursor-pointer"
          onClick={() => {
            toggleFavorite?.(tab.url);
            const title = tab.title?.slice(0, 40) || 'Tab';
            if (tabIsFavorite) toast.info(`Unfavorited: ${title}`, { duration: 1500 });
            else toast.success(`Favorited: ${title}`, { duration: 1500 });
          }}
          data-testid={`tab-ctx-fav-${tab.id}`}
        >
          <Star size={12} className="mr-1.5" strokeWidth={1.5} fill={tabIsFavorite ? 'currentColor' : 'none'} />
          {tabIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
        </ContextMenuItem>

        {/* Tab state */}
        <ContextMenuItem className="cursor-pointer" onClick={() => onPin(tab.id)}>
          <Pin size={12} className="mr-1.5" strokeWidth={1.5} />
          {isPinned ? 'Unpin tab' : 'Pin tab'}
        </ContextMenuItem>
        <ContextMenuItem className="cursor-pointer" onClick={() => onMute(tab.id)}>
          {isMuted ? <Volume2 size={12} className="mr-1.5" strokeWidth={1.5} /> : <VolumeX size={12} className="mr-1.5" strokeWidth={1.5} />}
          {isMuted ? 'Unmute tab' : 'Mute tab'}
        </ContextMenuItem>
        {isSuspended ? (
          <ContextMenuItem className="cursor-pointer" onClick={() => onUnsuspend?.(tab.id)}>Reload tab</ContextMenuItem>
        ) : (
          <ContextMenuItem className="cursor-pointer" onClick={() => onSuspend?.(tab.id)}>Suspend tab</ContextMenuItem>
        )}
        <ContextMenuSeparator />

        {/* Organization */}
        <ContextMenuItem className="cursor-pointer" onClick={() => onDuplicate(tab.id)}>
          <Copy size={12} className="mr-1.5" strokeWidth={1.5} />
          Duplicate tab
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">Move to</ContextMenuSubTrigger>
          <ContextMenuSubContent className="font-body text-xs">
            {isPinned ? (
              <ContextMenuItem className="text-muted-foreground cursor-default" disabled>
                Pinned tabs cannot be moved. Unpin first.
              </ContextMenuItem>
            ) : (
              <>
                {otherWindows.map(w => (
                  <ContextMenuItem className="cursor-pointer" key={w.id} onClick={() => onMoveToWindow(tab.id, w.id)}>
                    {w.name || 'Window'} ({w.tabs.length} tabs)
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator />
                <ContextMenuItem className="cursor-pointer" onClick={() => onMoveToNewWindow(tab.id)}>New Window</ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />

        {/* Clipboard */}
        <ContextMenuItem className="cursor-pointer" onClick={handleCopyUrl}>
          <Copy size={12} className="mr-1.5" strokeWidth={1.5} /> Copy URL
        </ContextMenuItem>
        <ContextMenuSeparator />

        {/* Destructive actions */}
        <ContextMenuItem onClick={() => onCloseToRight(tab.id, currentWindowId)} className="cursor-pointer text-destructive/70 focus:text-destructive">
          Close tabs to the right
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCloseOthers(tab.id, currentWindowId)} className="cursor-pointer text-destructive/70 focus:text-destructive">
          Close other tabs
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onClose(tab.id)} className="cursor-pointer text-destructive focus:text-destructive font-semibold">
          Close tab
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Memoized so a change to one tab (or a parent re-render) doesn't re-render
// every row. Most props are stable (useCallback handlers); the per-render arrow
// props are few, so shallow comparison still avoids the bulk of row re-renders.
export const TabItem = memo(TabItemImpl);
