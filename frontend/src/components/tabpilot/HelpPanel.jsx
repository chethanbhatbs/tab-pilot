import { useState } from 'react';
import {
  Search, GripVertical, Focus, Pause, Timer, Keyboard, Mail, ShieldCheck,
  Command, Star, ChevronDown, Zap, Trash2, MousePointer, Eye,
  Lightbulb, LayoutGrid, Copy, Clock
} from 'lucide-react';

function Section({ icon: Icon, iconColor, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="cursor-pointer w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--hover-subtle))] transition-colors"
        aria-expanded={open}
      >
        <Icon size={13} className={iconColor || 'text-primary'} strokeWidth={1.8} />
        <span className="text-[11px] font-heading font-bold text-foreground flex-1 text-left">{title}</span>
        <ChevronDown size={12} className={`text-muted-foreground/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {open && <div className="px-3 pb-2.5 pt-0.5">{children}</div>}
    </div>
  );
}

function FeatureItem({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <Icon size={11} className="text-muted-foreground/50 shrink-0 mt-[2px]" strokeWidth={1.5} />
      <span className="text-[11px] text-foreground/75 leading-snug font-body">{text}</span>
    </div>
  );
}

function ShortcutRow({ keys, action }) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <kbd className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded border border-border/40 text-foreground/70">{keys}</kbd>
      <span className="text-[11px] text-foreground/65 font-body">{action}</span>
    </div>
  );
}

export function HelpPanel({ onBack }) {
  const handleFeedback = () => {
    const subject = encodeURIComponent('Tab Radar Feedback');
    const body = encodeURIComponent('Hi,\n\nI have the following feedback about Tab Radar:\n\n');
    window.open(`mailto:bschethanbhat@gmail.com?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="p-3 space-y-2" data-testid="help-panel">
      {/* Hero */}
      <div className="text-center py-3">
        <h1 className="text-[16px] font-heading font-bold text-foreground tracking-tight brand-text">Tab Radar</h1>
        <p className="text-[11px] text-muted-foreground/70 font-body mt-0.5">Your browser, mastered.</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-[11px] font-mono text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded">v1.2.0</span>
          <span className="text-[11px] font-mono text-primary/70 bg-primary/[0.08] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
            <ShieldCheck size={9} strokeWidth={2} /> 100% local
          </span>
        </div>
      </div>

      {/* Quick Start */}
      <Section icon={Zap} iconColor="text-amber-500" title="Quick Start" defaultOpen={true}>
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold text-primary/70 bg-primary/10 w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-[1px]">1</span>
            <span className="text-[11px] text-foreground/75 leading-snug font-body">Click any tab to switch to it instantly</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold text-primary/70 bg-primary/10 w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-[1px]">2</span>
            <span className="text-[11px] text-foreground/75 leading-snug font-body">Click the star, or right-click a tab → <em>Add to favorites</em></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono font-bold text-primary/70 bg-primary/10 w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-[1px]">3</span>
            <span className="text-[11px] text-foreground/75 leading-snug font-body">Press <kbd className="text-[10px] font-mono bg-secondary px-1 py-0 rounded border border-border/40">⌘K / Ctrl+K</kbd> for the command palette</span>
          </div>
        </div>
      </Section>

      {/* Find & Navigate */}
      <Section icon={Search} iconColor="text-blue-500" title="Find & Navigate">
        <div className="space-y-0.5">
          <FeatureItem icon={Search} text="Fuzzy search any tab by title or URL" />
          <FeatureItem icon={Command} text="Command palette (Cmd+K) for quick switching" />
          <FeatureItem icon={LayoutGrid} text="Sites view groups tabs by domain" />
          <FeatureItem icon={GripVertical} text="Drag tabs to reorder or move between windows" />
          <FeatureItem icon={MousePointer} text="Right-click for pin, mute, move, copy URL, and more" />
        </div>
      </Section>

      {/* Focus & Control */}
      <Section icon={Focus} iconColor="text-violet-500" title="Focus & Control">
        <div className="space-y-0.5">
          <FeatureItem icon={Focus} text="Focus Mode highlights your chosen tabs and dims the rest" />
          <FeatureItem icon={Eye} text="Gently nudges you back if you stray — nothing is closed" />
          <FeatureItem icon={Copy} text="Select mode for bulk-closing multiple tabs at once" />
          <FeatureItem icon={Pause} text="Suspend inactive tabs to free memory" />
        </div>
      </Section>

      {/* Clean Up */}
      <Section icon={Trash2} iconColor="text-rose-500" title="Clean Up">
        <div className="space-y-0.5">
          <FeatureItem icon={Copy} text="Duplicate detection with one-click Fix All" />
          <FeatureItem icon={Timer} text="Auto-Close rules close idle tabs on a timer" />
          <FeatureItem icon={Clock} text="30-second warning before auto-close with Keep Open option" />
          <FeatureItem icon={Clock} text="Activity view: visits per day, top sites, and real time spent" />
        </div>
      </Section>

      {/* Favorites */}
      <Section icon={Star} iconColor="text-yellow-500" title="Favorites">
        <div className="space-y-0.5">
          <FeatureItem icon={Star} text="Star any tab to add it to favorites" />
          <FeatureItem icon={MousePointer} text="Right-click a tab → Add / Remove from favorites" />
          <FeatureItem icon={Star} text="Favorited tabs pinned in a section at the top" />
        </div>
      </Section>

      {/* Keyboard Shortcuts */}
      <Section icon={Keyboard} iconColor="text-emerald-500" title="Keyboard Shortcuts">
        <div className="space-y-0">
          <ShortcutRow keys="⌘K / Ctrl+K" action="Command palette" />
          <ShortcutRow keys="Cmd+Shift+E" action="Toggle sidebar" />
          <ShortcutRow keys="Up / Down" action="Navigate tabs" />
          <ShortcutRow keys="Enter" action="Switch to tab" />
          <ShortcutRow keys="Delete / Backspace" action="Close tab" />
          <ShortcutRow keys="Right-click tab" action="Context menu (favorite, pin, mute, move, close)" />
        </div>
      </Section>

      {/* Pro Tips */}
      <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Lightbulb size={11} className="text-primary" strokeWidth={2} />
          <span className="text-[10px] font-heading font-bold text-primary">Pro Tips</span>
        </div>
        <ul className="space-y-1 list-none">
          <li className="text-[11px] text-foreground/70 leading-snug font-body flex items-start gap-1.5">
            <span className="text-primary/50 shrink-0 mt-[3px]">&bull;</span>
            Right-click any tab for a quick menu (favorite, pin, mute, close)
          </li>
          <li className="text-[11px] text-foreground/70 leading-snug font-body flex items-start gap-1.5">
            <span className="text-primary/50 shrink-0 mt-[3px]">&bull;</span>
            ⌘K / Ctrl+K from anywhere to open the command palette
          </li>
          <li className="text-[11px] text-foreground/70 leading-snug font-body flex items-start gap-1.5">
            <span className="text-primary/50 shrink-0 mt-[3px]">&bull;</span>
            Right-click a tab for the full context menu
          </li>
          <li className="text-[11px] text-foreground/70 leading-snug font-body flex items-start gap-1.5">
            <span className="text-primary/50 shrink-0 mt-[3px]">&bull;</span>
            Star icon sits next to the close button on hover
          </li>
          <li className="text-[11px] text-foreground/70 leading-snug font-body flex items-start gap-1.5">
            <span className="text-primary/50 shrink-0 mt-[3px]">&bull;</span>
            Focus Mode gently redirects you back; only blank new tabs are closed
          </li>
        </ul>
      </div>

      {/* Privacy */}
      <div className="rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2 flex items-center gap-2" data-testid="privacy-disclaimer">
        <ShieldCheck size={12} className="text-primary shrink-0" strokeWidth={2} />
        <p className="text-[10px] text-muted-foreground/80 leading-snug font-body">
          <span className="font-semibold text-primary">100% Private</span> — Runs entirely in your browser. No data leaves your machine.
        </p>
      </div>

      {/* Feedback */}
      <button
        onClick={handleFeedback}
        className="cursor-pointer w-full flex items-center justify-center gap-1.5 h-7 text-[10px] font-heading font-semibold
          rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        data-testid="feedback-email-btn"
      >
        <Mail size={11} strokeWidth={1.5} />
        Send Feedback
      </button>
    </div>
  );
}
