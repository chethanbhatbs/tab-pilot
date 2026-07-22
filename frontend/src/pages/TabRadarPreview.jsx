import { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/tabpilot/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { isExtensionContext } from '@/utils/chromeAdapter';
import {
  TreePine, Search, Layers, Flame, Focus, Pause, Keyboard,
  StickyNote, Briefcase, Timer, GripVertical, Zap, Download,
  Monitor, MousePointerClick, ArrowRight, PanelLeftOpen,
  Shield, Cpu, Clock, Star, Link
} from 'lucide-react';

export default function TabRadarPreview() {
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(380);

  const handleMouseDown = useCallback((e) => {
    if (sidebarCollapsed) return;
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, sidebarCollapsed]);

  const handleCollapse = useCallback(() => setSidebarCollapsed(true), []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(Math.max(startWidth.current + delta, 320), 700);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ── Extension mode: render sidebar ONLY (no homepage, full panel width) ──
  if (isExtensionContext()) {
    return (
      <div className="h-screen w-screen bg-background text-foreground overflow-hidden flex flex-col" data-testid="tabpilot-extension">
        <Toaster richColors closeButton position="bottom-center" offset="36px" toastOptions={{ duration: 2000 }} />
        <div className="flex-1 overflow-hidden">
          <Sidebar />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex" data-testid="tabpilot-preview">
      <Toaster richColors position="bottom-right" toastOptions={{ duration: 2000 }} />

      {/* Sidebar */}
      <div
        className={`shrink-0 bg-background flex flex-col border-r border-border/40 transition-all duration-300 overflow-hidden
          ${sidebarCollapsed ? 'w-0 border-r-0' : ''}`}
        style={sidebarCollapsed ? { width: 0 } : { width: `${sidebarWidth}px` }}
        data-testid="sidebar-container"
      >
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-hidden relative">
            <Sidebar onCollapse={handleCollapse} />
          </div>
        )}
      </div>

      {/* Resize handle — only when sidebar is open, auto-hides after 3s */}
      {!sidebarCollapsed && (
        <div
          data-testid="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSidebarWidth(400)}
          className="w-[5px] shrink-0 cursor-col-resize relative group"
          title="Drag to resize · Double-click to reset"
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-primary/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full
            bg-border/40 group-hover:bg-primary/60 transition-colors duration-150 resize-handle-dot" />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto relative bg-card" data-testid="homepage-content">
        {/* Expand sidebar button — only when collapsed */}
        {sidebarCollapsed && (
          <button
            data-testid="expand-sidebar-btn"
            onClick={() => setSidebarCollapsed(false)}
            className="fixed left-3 top-3 z-30 flex items-center gap-1.5 h-8 px-2.5 rounded-lg
              bg-card border border-border/50 text-muted-foreground hover:text-foreground
              hover:border-primary/30 transition-all shadow-lg shadow-black/20"
          >
            <PanelLeftOpen size={14} strokeWidth={1.5} />
            <span className="text-[11px] font-body font-medium">Tab Radar</span>
          </button>
        )}
        <LandingPage />
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-full">
      <HeroSection />
      <StatsStrip />
      <FeatureGrid />
      <HowItWorks />
      <ShortcutsSection />
      <BottomCTA />
      <footer className="text-center py-6 border-t border-border/20">
        <p className="text-[11px] text-muted-foreground/30 font-mono">
          Tab Radar v1.0 &middot; Manifest V3 &middot; React 18 &middot; Open Source
        </p>
      </footer>
    </div>
  );
}

function HeroSection() {
  return (
    <div className="relative overflow-hidden" data-testid="hero-section">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="relative max-w-2xl mx-auto px-8 pt-16 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white text-2xl"
            style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}
            aria-hidden="true"
          >
            {'✈'}
          </div>
          <div>
            <h1 className="text-3xl font-heading font-black tracking-tight leading-none">
              <span className="text-foreground">Tab</span> <span className="text-primary">Radar</span>
            </h1>
            <p className="text-xs text-muted-foreground/50 font-mono mt-0.5">Chrome Tab & Window Manager</p>
          </div>
        </div>
        <h2 className="text-lg font-heading font-bold text-foreground/90 leading-snug mb-3 max-w-md">
          Your browser, under control.
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mb-6">
          Search, organize, and manage every tab from a powerful sidebar. Focus on what matters,
          suspend what doesn't, and never lose a tab again.
        </p>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText('https://github.com/chethanbhatbs/tab-radar/releases/latest/download/tab-radar.zip');
                toast.success('Link copied!', { duration: 2000 });
              } catch {
                toast.success('Link copied!', { duration: 2000 });
              }
            }}
            className="cursor-pointer flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground
              font-heading font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20
              active:scale-[0.98]"
            data-testid="download-extension-btn"
          >
            <Download size={16} strokeWidth={2} />
            Add to Chrome
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText('https://github.com/chethanbhatbs/tab-radar/releases/latest/download/tab-radar.zip');
              } catch { /* permissions not granted */ }
              toast.success('Install link copied!', { duration: 2000 });
            }}
            className="cursor-pointer flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border/40 text-foreground/60
              text-sm font-body hover:border-primary/40 hover:text-foreground transition-all"
            data-testid="copy-install-link-btn"
          >
            <Link size={14} strokeWidth={1.5} />
            Copy install link
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-border/30 w-fit">
          <ArrowRight size={13} className="text-primary animate-pulse" />
          <span className="text-[12px] text-muted-foreground font-body">
            The sidebar on the left is a <span className="text-foreground font-medium">live interactive demo</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function StatsStrip() {
  const stats = [
    { value: '16+', label: 'Features' },
    { value: '0', label: 'Data collected' },
    { value: '<1MB', label: 'Extension size' },
    { value: 'MV3', label: 'Manifest V3' },
  ];
  return (
    <div className="border-y border-border/20 bg-card/30" data-testid="stats-strip">
      <div className="max-w-2xl mx-auto px-8 py-4 flex items-center justify-between">
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-lg font-heading font-black text-foreground">{s.value}</div>
            <div className="text-[10px] text-muted-foreground/50 font-body">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureGrid() {
  const features = [
    { icon: TreePine, color: 'text-emerald-400', bg: 'bg-emerald-400/10', title: 'Tab Tree View',
      desc: 'See all windows and tabs in a collapsible tree. Grouped tabs show with colored borders matching their Chrome group.' },
    { icon: Search, color: 'text-primary', bg: 'bg-primary/10', title: 'Fuzzy Search + Cmd+K',
      desc: 'Find any tab instantly by title or URL. The command palette gives you Spotlight-style quick switching.' },
    { icon: Flame, color: 'text-rose-400', bg: 'bg-rose-400/10', title: 'Activity Heatmap',
      desc: 'Visualize browsing patterns. See which tabs consume the most time and memory across day, week, or month.' },
    { icon: Focus, color: 'text-violet-400', bg: 'bg-violet-400/10', title: 'Focus Mode',
      desc: 'Pick your focus tabs, start a timer, and everything else fades away. Distraction-free deep work.' },
    { icon: Pause, color: 'text-amber-400', bg: 'bg-amber-400/10', title: 'Tab Suspension',
      desc: 'Reclaim memory by suspending inactive tabs. They stay in your tree but free up system resources.' },
    { icon: Layers, color: 'text-orange-400', bg: 'bg-orange-400/10', title: 'Duplicate Detection',
      desc: 'Spots URLs open in multiple tabs and highlights them. Close extras with one click, keeping one of each.' },
    { icon: Briefcase, color: 'text-sky-400', bg: 'bg-sky-400/10', title: 'Smart Workspaces',
      desc: 'Save tab collections as workspaces. Switch between "Dev", "Research", or your own custom presets.' },
    { icon: Timer, color: 'text-teal-400', bg: 'bg-teal-400/10', title: 'Auto-Close Rules',
      desc: 'Set timers to close idle tabs after 15, 30, or 60 min. Whitelist domains to keep important tabs safe.' },
    { icon: StickyNote, color: 'text-primary/70', bg: 'bg-primary/5', title: 'Tab Notes',
      desc: 'Right-click any tab to attach a note. Notes persist and show as a badge so you never forget context.' },
    { icon: GripVertical, color: 'text-muted-foreground', bg: 'bg-muted-foreground/10', title: 'Drag & Drop',
      desc: 'Reorder tabs within a window or drag between windows. Grip handles appear on hover for precision.' },
    { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10', title: 'Session Manager',
      desc: 'Snapshot your entire browser state. Name it, save it, restore it later to pick up right where you left off.' },
    { icon: Keyboard, color: 'text-foreground/60', bg: 'bg-foreground/5', title: 'Keyboard-First',
      desc: 'Arrow keys to browse, Enter to switch, Delete to close, Cmd+K to search. Full control, no mouse needed.' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-8 py-10" data-testid="feature-showcase">
      <SectionHeader title="Everything you need" subtitle="Built for power users who live in their browser" />
      <div className="grid grid-cols-2 gap-3">
        {features.map((f) => (
          <div key={f.title}
            className="group p-3.5 rounded-xl bg-card/50 border border-border/30 hover:border-primary/20 transition-all duration-200"
            data-testid={`feature-card-${f.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center mb-2.5
              group-hover:scale-110 transition-transform duration-200`}>
              <f.icon size={16} className={f.color} strokeWidth={1.5} />
            </div>
            <h3 className="text-[13px] font-heading font-bold text-foreground leading-tight mb-1">{f.title}</h3>
            <p className="text-[11px] text-muted-foreground/60 font-body leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { num: '1', title: 'Install the extension', desc: 'One click from the Chrome Web Store. No sign-up, no configuration needed.' },
    { num: '2', title: 'Open the sidebar', desc: 'Click the Tab Radar icon or use a keyboard shortcut to open the sidebar panel.' },
    { num: '3', title: 'Take control', desc: 'Search, organize, suspend, and manage all your tabs from one place.' },
  ];
  return (
    <div className="bg-card/30 border-y border-border/20" data-testid="how-it-works">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <SectionHeader title="Get started in seconds" subtitle="No configuration required" />
        <div className="grid grid-cols-3 gap-4">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-sm font-heading font-black text-primary">{s.num}</span>
              </div>
              <h3 className="text-[13px] font-heading font-bold text-foreground mb-1">{s.title}</h3>
              <p className="text-[11px] text-muted-foreground/60 font-body leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortcutsSection() {
  const shortcuts = [
    ['Cmd+K', 'Quick switch to any tab'],
    ['Ctrl+Shift+F', 'Focus the search bar'],
    ['\u2191 \u2193', 'Navigate through the tab list'],
    ['Enter', 'Switch to selected tab'],
    ['Delete', 'Close selected tab'],
    ['Right-click', 'Context menu for any tab'],
  ];
  return (
    <div className="max-w-2xl mx-auto px-8 py-10" data-testid="shortcuts-section">
      <SectionHeader title="Keyboard shortcuts" subtitle="Navigate without touching your mouse" />
      <div className="grid grid-cols-2 gap-1.5">
        {shortcuts.map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-card/50 border border-border/30">
            <span className="text-[12px] text-muted-foreground/70 font-body">{desc}</span>
            <kbd className="text-[10px] font-mono bg-background px-2 py-0.5 rounded border border-border/50 text-foreground/50 ml-3 shrink-0">
              {key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomCTA() {
  return (
    <div className="bg-gradient-to-t from-primary/[0.04] to-transparent" data-testid="bottom-cta">
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <h2 className="text-lg font-heading font-bold text-foreground mb-2">Ready to take control?</h2>
        <p className="text-sm text-muted-foreground mb-6">Join thousands of power users who manage their browser like pros.</p>
        <button className="flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground
          font-heading font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20
          active:scale-[0.98] mx-auto" data-testid="download-extension-btn-bottom">
          <Download size={16} strokeWidth={2} />
          Add to Chrome — It's Free
        </button>
        <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-muted-foreground/40">
          <span className="flex items-center gap-1"><Shield size={11} /> Privacy-first</span>
          <span className="flex items-center gap-1"><Cpu size={11} /> Lightweight</span>
          <span className="flex items-center gap-1"><Clock size={11} /> Setup in 10s</span>
          <span className="flex items-center gap-1"><Star size={11} /> Open source</span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-base font-heading font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-[12px] text-muted-foreground/50 font-body mt-0.5">{subtitle}</p>}
    </div>
  );
}
