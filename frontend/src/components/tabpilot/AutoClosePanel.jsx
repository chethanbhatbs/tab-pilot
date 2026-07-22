import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Timer, Shield, Plus, X, AlertTriangle, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { getDomain, getFaviconUrl, handleFaviconError } from '@/utils/grouping';

const PRESETS = [
  { id: '15', label: '15 min', minutes: 15 },
  { id: '30', label: '30 min', minutes: 30 },
  { id: '60', label: '1 hour', minutes: 60 },
  { id: '120', label: '2 hours', minutes: 120 },
];

function formatTimeLeft(lastAccessed, activeMinutes) {
  if (!lastAccessed || !activeMinutes) return `${activeMinutes}m left`;
  const elapsedMs = Date.now() - lastAccessed;
  const elapsedMin = elapsedMs / 60000;
  const remaining = Math.max(0, activeMinutes - elapsedMin);
  if (remaining < 1) return '< 1m left';
  if (remaining < 60) return `${Math.round(remaining)}m left`;
  const h = Math.floor(remaining / 60);
  const m = Math.round(remaining % 60);
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

export function AutoClosePanel({ allTabs, onClose, onAutoClose, settings, onUpdateSetting, visitCounts = {}, onKeepOpen }) {
  const enabled = settings.autoCloseEnabled;
  const selectedPreset = settings.autoClosePreset || '30';
  const customMinutes = settings.autoCloseCustomMinutes || '';
  const whitelist = settings.autoCloseWhitelist || ['mail.google.com', 'docs.google.com'];

  const activeMinutes = selectedPreset === 'custom'
    ? parseInt(customMinutes) || 0
    : PRESETS.find(p => p.id === selectedPreset)?.minutes || 0;

  const handleToggle = useCallback((val) => {
    onUpdateSetting('autoCloseEnabled', val);
    if (val) toast.success(`Auto-close enabled: ${activeMinutes}min inactivity`);
    else toast.info('Auto-close disabled');
  }, [activeMinutes, onUpdateSetting]);

  const addWhitelistDomain = useCallback((newDomain) => {
    const d = newDomain.trim().toLowerCase();
    if (!d) return false;
    if (whitelist.includes(d)) { toast.info('Already whitelisted'); return false; }
    onUpdateSetting('autoCloseWhitelist', [...whitelist, d]);
    toast.success(`${d} whitelisted`);
    return true;
  }, [whitelist, onUpdateSetting]);

  const removeWhitelistDomain = useCallback((domain) => {
    onUpdateSetting('autoCloseWhitelist', whitelist.filter(d => d !== domain));
  }, [whitelist, onUpdateSetting]);

  // Subdomain-aware whitelist check: "google.com" matches "docs.google.com", "mail.google.com" etc.
  const isWhitelisted = useCallback((hostname) => {
    if (!hostname) return false;
    return whitelist.some(w => hostname === w || hostname.endsWith('.' + w));
  }, [whitelist]);

  // Tick every 3s to force re-evaluation — ensures tabs disappear when visited
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || activeMinutes === 0) return;
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, [enabled, activeMinutes]);

  // Tabs that would be closed — only truly inactive tabs
  const atRiskTabs = useMemo(() => {
    if (!enabled || activeMinutes === 0) return [];
    const thresholdMs = activeMinutes * 60000;
    const now = Date.now();
    return allTabs
      .filter(tab => {
        // Skip active, pinned, and recently visited (via Tab Pilot click) tabs
        if (tab.active || tab.pinned) return false;
        if (visitCounts[tab.id]) return false;
        const domain = getDomain(tab.url);
        if (isWhitelisted(domain)) return false;
        // Skip tabs accessed within threshold — covers tabs opened directly in Chrome
        if (tab.lastAccessed && (now - tab.lastAccessed) < thresholdMs) return false;
        return true;
      })
      .map(tab => ({
        ...tab,
        timeLeft: formatTimeLeft(tab.lastAccessed, activeMinutes),
      }))
      .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
  }, [allTabs, enabled, activeMinutes, isWhitelisted, visitCounts, tick]);

  // Pre-warning toast: 30 seconds before auto-close threshold, warn the user
  // with a "Keep Open" action button that resets the tab's inactivity timer.
  // NOTE: In-page overlay (via chrome.scripting) not implemented — only sidepanel toast shown.
  const warnedRef = useRef(new Set());
  useEffect(() => {
    if (!enabled || activeMinutes === 0 || !onKeepOpen) return;
    const thresholdMs = activeMinutes * 60000;
    const warningMs = thresholdMs - 30000; // 30s before threshold
    if (warningMs <= 0) return; // threshold too short for pre-warning
    const now = Date.now();
    atRiskTabs.forEach(tab => {
      if (warnedRef.current.has(tab.id)) return;
      const elapsed = tab.lastAccessed ? (now - tab.lastAccessed) : thresholdMs + 1;
      if (elapsed >= warningMs && elapsed < thresholdMs) {
        warnedRef.current.add(tab.id);
        const secondsLeft = Math.max(0, Math.round((thresholdMs - elapsed) / 1000));
        toast.warning(
          `"${tab.title?.slice(0, 35) || 'Tab'}" will be closed in ${secondsLeft}s — inactive tab`,
          {
            duration: 30000,
            action: {
              label: 'Keep Open',
              onClick: () => {
                warnedRef.current.delete(tab.id);
                onKeepOpen(tab.id);
              },
            },
          }
        );
      }
    });
  }, [atRiskTabs, enabled, activeMinutes, onKeepOpen, tick]);

  // Actually auto-close expired tabs
  const closedRef = useRef(new Set());
  useEffect(() => {
    if (!enabled || activeMinutes === 0 || !onAutoClose) return;
    const thresholdMs = activeMinutes * 60000;
    const now = Date.now();
    atRiskTabs.forEach(tab => {
      if (closedRef.current.has(tab.id)) return;
      const elapsed = tab.lastAccessed ? (now - tab.lastAccessed) : thresholdMs + 1;
      if (elapsed >= thresholdMs) {
        closedRef.current.add(tab.id);
        // Clear warned state for this tab since it's being closed
        warnedRef.current.delete(tab.id);
        onAutoClose(tab.id);
        toast.success(`Auto-closed: ${tab.title?.slice(0, 40) || 'Tab'}`, { duration: 3000 });
      }
    });
  }, [atRiskTabs, enabled, activeMinutes, onAutoClose, tick]);

  return (
    <div className="p-3 space-y-3" data-testid="auto-close-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer size={13} className="text-primary" strokeWidth={2} />
          <span className="text-xs font-heading font-bold">Auto-Close Rules</span>
        </div>
        <Switch
          data-testid="auto-close-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
          className="scale-75"
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Automatically close tabs you haven't visited within a set time. Pinned, active, and whitelisted tabs are always safe.
      </p>

      {/* Inactivity timer presets */}
      <div>
        <span className="text-[11px] font-heading text-muted-foreground/60 uppercase tracking-wider font-semibold">Inactivity Threshold</span>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`auto-close-preset-${p.id}`}
              onClick={() => onUpdateSetting('autoClosePreset', p.id)}
              className={`cursor-pointer px-2 py-1 rounded-md text-[10px] font-body transition-all
                ${selectedPreset === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                }`}
            >
              {p.label}
            </button>
          ))}
          <button
            data-testid="auto-close-preset-custom"
            onClick={() => onUpdateSetting('autoClosePreset', 'custom')}
            className={`cursor-pointer px-2 py-1 rounded-md text-[10px] font-body transition-all
              ${selectedPreset === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
          >
            Custom
          </button>
        </div>
        {selectedPreset === 'custom' && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              data-testid="auto-close-custom-input"
              type="number"
              value={customMinutes}
              onChange={(e) => onUpdateSetting('autoCloseCustomMinutes', e.target.value)}
              placeholder="Minutes"
              min={1}
              className="w-20 h-7 px-2 text-[10px] font-body bg-card border border-border rounded-md
                text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <span className="text-[10px] text-muted-foreground">minutes</span>
          </div>
        )}
      </div>

      {/* Whitelist */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Shield size={10} className="text-primary/60" strokeWidth={2} />
          <span className="text-[11px] font-heading text-foreground/60 uppercase tracking-wider font-semibold">Whitelisted Domains</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-1.5">These domains will never be auto-closed.</p>
        <div className="space-y-0.5 mb-2">
          {whitelist.map(domain => (
            <div key={domain} className="flex items-center justify-between py-1 px-2 rounded-md bg-card/50 border border-border/30"
              data-testid={`whitelist-${domain}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-4 h-4 rounded bg-secondary/60 flex items-center justify-center shrink-0">
                  <img
                    src={getFaviconUrl(`https://${domain}`)}
                    alt=""
                    className="w-3.5 h-3.5 rounded-[2px]"
                    data-tab-url={`https://${domain}`}
                    data-chrome-favicon=""
                    onError={handleFaviconError}
                  />
                </div>
                <span className="text-[10px] font-body text-foreground/70 truncate">{domain}</span>
              </div>
              <button
                onClick={() => removeWhitelistDomain(domain)}
                className="cursor-pointer p-0.5 rounded text-muted-foreground/50 hover:text-destructive transition-colors shrink-0 ml-1"
              >
                <X size={10} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
        <WhitelistInput onAdd={addWhitelistDomain} />
      </div>

      {/* At-risk preview with time remaining */}
      {enabled && activeMinutes > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-2.5" data-testid="at-risk-tabs">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={10} className="text-destructive/70" strokeWidth={2} />
            <span className="text-[10px] font-heading font-semibold text-foreground/70">
              {atRiskTabs.length} tab{atRiskTabs.length !== 1 ? 's' : ''} subject to auto-close
            </span>
          </div>
          <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
            {atRiskTabs.slice(0, 10).map(tab => (
              <div key={tab.id} className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-[hsl(var(--hover-subtle))]">
                <div className="w-4 h-4 rounded bg-secondary/60 flex items-center justify-center shrink-0">
                  <img
                    src={getFaviconUrl(tab.url, tab.favIconUrl)}
                    alt=""
                    className="w-3.5 h-3.5 rounded-[2px]"
                    data-tab-url={tab.url}
                    data-chrome-favicon={tab.favIconUrl || ''}
                    onError={handleFaviconError}
                  />
                </div>
                <span className="text-[10px] font-body truncate flex-1 text-foreground/70">{tab.title}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Clock size={8} className="text-destructive/50" strokeWidth={2} />
                  <span className="text-[11px] font-mono text-destructive/60">{tab.timeLeft}</span>
                </div>
              </div>
            ))}
            {atRiskTabs.length > 10 && (
              <div className="text-[11px] text-muted-foreground/60 text-center py-1">
                +{atRiskTabs.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component so the input text resets on add but doesn't need global persistence
function WhitelistInput({ onAdd }) {
  const [value, setValue] = useState('');
  const handleAdd = () => {
    if (onAdd(value)) setValue('');
  };
  return (
    <div className="flex gap-1">
      <input
        data-testid="whitelist-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="Add domain (e.g., github.com)"
        className="flex-1 h-7 px-2 text-[10px] font-body bg-card border border-border rounded-md
          text-foreground placeholder:text-muted-foreground/50
          focus:outline-none focus:ring-1 focus:ring-primary/40"
      />
      <button
        data-testid="whitelist-add-btn"
        onClick={handleAdd}
        className="cursor-pointer h-7 px-2 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}
