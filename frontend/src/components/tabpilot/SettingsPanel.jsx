import { Settings, Sun, Moon, Laptop, Check, Users, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const themes = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Laptop, label: 'System' },
];

const accentColors = [
  { id: 'blue',   label: 'Blue',   swatch: '#3b82f6' },
  { id: 'green',  label: 'Green',  swatch: '#22c55e' },
  { id: 'orange', label: 'Orange', swatch: '#f97316' },
  { id: 'purple', label: 'Purple', swatch: '#a855f7' },
  { id: 'rose',   label: 'Rose',   swatch: '#f43f5e' },
  { id: 'teal',   label: 'Teal',   swatch: '#14b8a6' },
];

export function SettingsPanel({ settings, onUpdate, onOpenProfiles }) {
  return (
    <div className="p-3 space-y-3" data-testid="settings-panel">
      <div className="flex items-center gap-1.5 mb-2">
        <Settings size={13} className="text-primary" strokeWidth={1.5} />
        <span className="text-xs font-heading font-bold">Settings</span>
      </div>

      {/* Theme */}
      <div>
        <span className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Theme</span>
        <div className="flex gap-1 mt-1.5">
          {themes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              data-testid={`theme-${value}`}
              onClick={() => onUpdate('theme', value)}
              className={`cursor-pointer flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-body
                transition-all duration-150
                ${settings.theme === value
                  ? 'bg-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.25)]'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--hover-medium))]'
                }
              `}
            >
              <Icon size={12} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div>
        <span className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Accent Color</span>
        <div className="flex gap-1.5 mt-1.5">
          {accentColors.map(({ id, label, swatch }) => (
            <button
              key={id}
              data-testid={`accent-${id}`}
              onClick={() => onUpdate('accentColor', id)}
              title={label}
              className="cursor-pointer relative w-5 h-5 rounded-full transition-all duration-150 hover:scale-110 active:scale-95
                flex items-center justify-center"
              style={{
                backgroundColor: swatch,
                boxShadow: settings.accentColor === id ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${swatch}` : 'none',
              }}
            >
              {settings.accentColor === id && (
                <Check size={10} className="text-white" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      </div>

      <Separator className="opacity-20" />

      {/* Toggles */}
      <div className="space-y-2.5">
        <SettingToggle
          label="Show favicons"
          description="Display tab favicons"
          checked={settings.showFavicons}
          onChange={(v) => onUpdate('showFavicons', v)}
          testId="setting-favicons"
        />
        <SettingToggle
          label="Show URLs"
          description="Display domain below title"
          checked={settings.showUrls}
          onChange={(v) => onUpdate('showUrls', v)}
          testId="setting-urls"
        />
        <SettingToggle
          label="Compact mode"
          description="Reduce padding for density"
          checked={settings.compactMode}
          onChange={(v) => onUpdate('compactMode', v)}
          testId="setting-compact"
        />
        <SettingToggle
          label="Ask before actions"
          description="Confirm create, close & switch"
          checked={settings.confirmActions}
          onChange={(v) => onUpdate('confirmActions', v)}
          testId="setting-confirm-actions"
        />
        <SettingToggle
          label="Smart duplicate matching"
          description="Treat tabs opening the same document as duplicates, even at different sections (e.g. two worksheets of one Google Sheet). Off = exact same URL only"
          checked={settings.smartDuplicateMatching}
          onChange={(v) => onUpdate('smartDuplicateMatching', v)}
          testId="setting-smart-duplicates"
        />
      </div>

      {onOpenProfiles && (
        <>
          <Separator className="opacity-20" />
          <div>
            <span className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">Profiles</span>
            <button
              onClick={onOpenProfiles}
              data-testid="settings-open-profiles"
              className="cursor-pointer w-full flex items-center justify-between mt-1.5 px-2.5 py-2 rounded-md
                bg-secondary hover:bg-[hsl(var(--hover-medium))] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users size={13} className="text-muted-foreground" strokeWidth={1.5} />
                <div className="text-left">
                  <div className="text-[11px] font-body font-medium">Chrome Profiles</div>
                  <div className="text-[11px] text-muted-foreground">Switch or manage browser profiles</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" strokeWidth={1.5} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange, testId }) {
  return (
    <div className="flex items-center justify-between" data-testid={testId}>
      <div>
        <div className="text-[11px] font-body font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}
