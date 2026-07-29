import { useState, useEffect, useCallback } from 'react';
import { Users, ArrowRightLeft, AlertTriangle, RefreshCw, Check, ShieldCheck, Copy, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  isExtensionContext, chromeNativeHostPing, chromeGetProfiles, chromeSwitchProfile,
  chromeStorageGet, chromeStorageSet, chromeCreateProfile,
  chromeHasNativePermission, chromeRequestNativePermission,
} from '@/utils/chromeAdapter';

const MOCK_PROFILES = [
  { directory: 'Default', name: 'Personal', userName: 'user@gmail.com', picture: null },
  { directory: 'Profile 1', name: 'Work', userName: 'user@company.com', picture: null },
  { directory: 'Profile 2', name: 'Dev', userName: '', picture: null },
];

// Color palette for profile avatars (when no picture available)
const AVATAR_COLORS = [
  '#8ab4f8', '#81c995', '#f28b82', '#fdd663', '#c58af9',
  '#78d9ec', '#fcad70', '#ff8bcb', '#a8dab5', '#b4a7d6',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Self-locating revoke command — removes the native host (no ID needed).
const UNINSTALL_CMD = `bash "$(find ~ -maxdepth 6 -path '*native-host/uninstall.sh' | head -1)"`;

export function ProfilePanel() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hostAvailable, setHostAvailable] = useState(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [hiddenProfiles, setHiddenProfiles] = useState([]);

  const loadProfiles = useCallback(async () => {
    setLoading(true);

    if (!isExtensionContext()) {
      setHostAvailable(true);
      setProfiles(MOCK_PROFILES);
      setCurrentProfile('Default');
      setLoading(false);
      return;
    }

    // nativeMessaging is optional — until the user grants it, don't even ping.
    if (!(await chromeHasNativePermission())) {
      setNeedsPermission(true);
      setHostAvailable(false);
      setLoading(false);
      return;
    }
    setNeedsPermission(false);

    const pingResult = await chromeNativeHostPing();
    if (!pingResult || pingResult.error) {
      setHostAvailable(false);
      setLoading(false);
      return;
    }
    setHostAvailable(true);

    const result = await chromeGetProfiles();
    if (result?.profiles) {
      setProfiles(result.profiles);
    } else {
      toast.error(result?.error || 'Failed to load profiles');
    }

    // Use verified cached profile — NEVER auto-detect
    const data = await chromeStorageGet(['tabpilot_my_profile', 'tabpilot_profile_verified', 'tabpilot_hidden_profiles']);
    if (data?.tabpilot_my_profile && data?.tabpilot_profile_verified) {
      setCurrentProfile(data.tabpilot_my_profile);
    } else if (result?.profiles?.length === 1) {
      setCurrentProfile(result.profiles[0].directory);
    }
    setHiddenProfiles(data?.tabpilot_hidden_profiles || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleSwitch = useCallback(async (profileDirectory, profileName) => {
    if (switching) return;
    setSwitching(profileDirectory);
    const result = await chromeSwitchProfile(profileDirectory, 'https://github.com/chethanbhatbs/tab-radar');
    if (result?.success) {
      toast.success(`Opening "${profileName}" — check GitHub for install instructions`);
    } else {
      toast.error(result?.error || 'Failed to switch profile');
    }
    setSwitching(null);
  }, [switching]);

  const handleCreateProfile = useCallback(async () => {
    const result = await chromeCreateProfile();
    if (result?.success) {
      toast.success('New profile created — set it up in Chrome');
      setTimeout(() => loadProfiles(), 2000);
    } else {
      toast.error(result?.error || 'Failed to create profile');
    }
  }, [loadProfiles]);

  const handleRemoveFromExtension = useCallback((directory) => {
    const p = profiles.find(pr => pr.directory === directory);
    const updated = [...hiddenProfiles, directory];
    setHiddenProfiles(updated);
    chromeStorageSet({ tabpilot_hidden_profiles: updated });
    toast.success(`"${p?.name || directory}" removed from Tab Radar`);
  }, [profiles, hiddenProfiles]);

  const handleSelectAsMe = useCallback((directory) => {
    setCurrentProfile(directory);
    chromeStorageSet({ tabpilot_my_profile: directory, tabpilot_profile_verified: true });
    const p = profiles.find(pr => pr.directory === directory);
    toast.success(`Profile set to "${p?.name || directory}"`);
  }, [profiles]);

  // Cache the active profile's display info (name/email/picture) so the footer
  // can render its avatar instantly without calling the native host itself.
  useEffect(() => {
    if (!isExtensionContext() || !currentProfile || !profiles.length) return;
    const p = profiles.find(pr => pr.directory === currentProfile);
    if (p) {
      chromeStorageSet({
        tabpilot_active_profile: {
          directory: p.directory, name: p.name, userName: p.userName, picture: p.picture || null,
        },
      });
    }
  }, [currentProfile, profiles]);

  // Loading
  if (loading) {
    return (
      <div className="p-3 space-y-3" data-testid="profile-panel">
        <Header />
        <div className="text-[11px] text-muted-foreground/70 text-center py-8 font-body animate-pulse">
          Checking native host...
        </div>
      </div>
    );
  }

  // Optional permission not granted yet — profile switching is fully opt-in
  if (needsPermission) {
    return (
      <div className="p-3 space-y-3" data-testid="profile-panel">
        <Header />
        <div className="rounded-lg border border-border/50 bg-card p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-primary" strokeWidth={2} />
            <span className="text-[11px] font-heading font-semibold text-foreground/90">Optional Feature</span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
            Switching Chrome profiles from Tab Radar needs the <span className="font-mono">nativeMessaging</span> permission.
            It is off by default and only ever talks to a small local helper you install yourself — nothing is requested until you enable it here.
          </p>
          <button
            onClick={async () => {
              const granted = await chromeRequestNativePermission();
              if (granted) loadProfiles();
              else toast.error('Permission not granted');
            }}
            className="cursor-pointer w-full h-7 text-[10px] font-heading font-semibold rounded-md
              bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
            data-testid="profile-grant-permission-btn"
          >
            <Users size={10} strokeWidth={1.5} />
            Enable profile switching
          </button>
        </div>
      </div>
    );
  }

  // Setup required
  if (!hostAvailable) {
    // The extension knows its own ID live — bake it into one universal command
    // that also finds the helper folder, so users never search or paste an ID.
    const extId = (isExtensionContext() && chrome.runtime?.id) || 'YOUR_EXTENSION_ID';
    const installCmd = `bash "$(find ~ -maxdepth 6 -path '*native-host/install.sh' | head -1)" ${extId}`;
    return (
      <div className="p-3 space-y-3" data-testid="profile-panel">
        <Header />

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-amber-500" strokeWidth={2} />
            <span className="text-[11px] font-heading font-semibold text-amber-500">One-Time Setup</span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
            One command does it all — it finds the helper folder and uses your extension ID automatically. Paste it into a terminal (macOS · Linux · WSL), press Enter:
          </p>

          <div className="bg-secondary rounded-md p-2 font-mono text-[10px] text-foreground/80 leading-relaxed break-all select-all" data-testid="install-command">
            {installCmd}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(installCmd); toast.success('Command copied'); }}
            data-testid="copy-install-cmd"
            className="cursor-pointer w-full flex items-center justify-center gap-1.5 h-7 text-[10px] font-heading font-semibold rounded-md bg-secondary hover:bg-[hsl(var(--hover-medium))] text-foreground/80 transition-colors"
          >
            <Copy size={11} strokeWidth={1.5} /> Copy command
          </button>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Then restart Chrome and click Connect. <span className="text-muted-foreground/40">(macOS: you can instead double-click <span className="font-mono">install.command</span> in the native-host folder.)</span>
          </p>

          {/* Safety notice */}
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-primary/[0.04] border border-primary/10">
            <ShieldCheck size={11} className="text-primary shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              <span className="font-semibold text-primary">100% Safe</span> — The script only reads Chrome's profile names (not passwords, history, or browsing data). It makes zero network requests. You can <a href="#" onClick={(e) => { e.preventDefault(); if (isExtensionContext()) chrome.tabs.create({ url: 'https://github.com/chethanbhatbs/tab-radar/blob/main/native-host/tabpilot_profiles.py' }); }} className="underline text-primary/80 hover:text-primary">review the source code</a>.
            </p>
          </div>

          <button
            onClick={loadProfiles}
            className="cursor-pointer w-full h-7 text-[10px] font-heading font-semibold rounded-md
              bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
            data-testid="profile-retry-btn"
          >
            <RefreshCw size={10} strokeWidth={1.5} />
            I've set it up — Connect
          </button>
        </div>
      </div>
    );
  }

  // Profiles loaded
  return (
    <div className="p-3 space-y-2.5" data-testid="profile-panel">
      <div className="flex items-center justify-between">
        <Header />
        <button
          onClick={() => { setHiddenProfiles([]); chromeStorageSet({ tabpilot_hidden_profiles: [] }); loadProfiles(); }}
          className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-heading font-semibold
            text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors"
          data-testid="profile-sync-btn"
        >
          <RefreshCw size={9} strokeWidth={2} />
          Sync Profiles
        </button>
      </div>

      {/* Current profile highlight */}
      {profiles.filter(p => p.directory === currentProfile).map(profile => (
        <div key={profile.directory} className="rounded-lg bg-primary/[0.06] border border-primary/30 p-3">
          <div className="flex items-center gap-3">
            <ProfileAvatar profile={profile} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-heading font-bold truncate">{profile.name}</span>
                <span className="text-[10px] font-mono font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider">
                  Active
                </span>
              </div>
              {(profile.userName || profile.gaiaName) && (
                <span className="text-[10px] text-muted-foreground/70 truncate block">{profile.userName || profile.gaiaName}</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* No current profile — prompt selection */}
      {!currentProfile && profiles.filter(p => !hiddenProfiles.includes(p.directory)).length > 1 && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5 space-y-1.5">
          <span className="text-[10px] font-heading font-semibold text-primary">Which profile is this?</span>
          {profiles.filter(p => !hiddenProfiles.includes(p.directory)).map(profile => (
            <button
              key={profile.directory}
              onClick={() => handleSelectAsMe(profile.directory)}
              className="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                hover:bg-primary/10 transition-colors text-left"
            >
              <ProfileAvatar profile={profile} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-heading font-semibold truncate block">{profile.name}</span>
              </div>
              <span className="text-[11px] text-primary font-heading font-semibold shrink-0">This is me</span>
            </button>
          ))}
        </div>
      )}

      {/* Other profiles — switch to */}
      {currentProfile && profiles.filter(p => p.directory !== currentProfile && !hiddenProfiles.includes(p.directory)).length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-heading font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5">
            Switch to
          </span>
          {profiles.filter(p => p.directory !== currentProfile && !hiddenProfiles.includes(p.directory)).map(profile => {
            const isSwitching = switching === profile.directory;
            return (
              <div key={profile.directory} className="flex items-center gap-1">
                <button
                  onClick={() => handleSwitch(profile.directory, profile.name)}
                  disabled={!!switching}
                  className="cursor-pointer flex-1 bg-card border border-border/40 rounded-lg p-2.5
                    hover:border-primary/30 hover:bg-primary/[0.03] transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed
                    flex items-center gap-2.5 text-left"
                  data-testid={`switch-profile-${profile.directory}`}
                >
                  <ProfileAvatar profile={profile} size="md" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-heading font-semibold truncate block">{profile.name}</span>
                    {(profile.userName || profile.gaiaName) && (
                      <span className="text-[11px] text-muted-foreground/60 truncate block">{profile.userName || profile.gaiaName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-primary shrink-0">
                    {isSwitching ? (
                      <RefreshCw size={12} className="animate-spin" strokeWidth={1.5} />
                    ) : (
                      <ArrowRightLeft size={12} strokeWidth={1.5} />
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleRemoveFromExtension(profile.directory)}
                  className="cursor-pointer p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive
                    hover:bg-destructive/10 transition-colors shrink-0"
                  title="Remove from Tab Radar"
                  data-testid={`remove-profile-${profile.directory}`}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {profiles.length === 0 && (
        <div className="text-[11px] text-muted-foreground/70 text-center py-4 font-body">
          No Chrome profiles found
        </div>
      )}

      {/* Actions */}
      <div className="space-y-1 pt-1">
        <button
          onClick={handleCreateProfile}
          className="cursor-pointer w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
            border border-border/40 bg-card hover:bg-[hsl(var(--hover-subtle))] transition-colors text-left"
          data-testid="profile-create-btn"
        >
          <UserPlus size={11} strokeWidth={1.5} className="text-muted-foreground/60" />
          <span className="text-[10px] font-heading font-semibold text-foreground/70">Create new profile</span>
        </button>

        {currentProfile && (
          <button
            onClick={() => { setCurrentProfile(null); chromeStorageSet({ tabpilot_profile_verified: false }); }}
            className="cursor-pointer w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
              hover:bg-[hsl(var(--hover-subtle))] transition-colors text-left"
            data-testid="profile-reidentify-btn"
          >
            <RefreshCw size={9} strokeWidth={1.5} className="text-muted-foreground/70" />
            <span className="text-[11px] font-body text-muted-foreground/70">Wrong profile? Re-identify</span>
          </button>
        )}
      </div>

      {/* Helper status + revoke — so you can see it's connected and undo the setup */}
      <div className="pt-2 mt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5 mb-1">
          <Check size={11} className="text-emerald-500" strokeWidth={2.5} />
          <span className="text-[10px] font-heading font-semibold text-emerald-600 dark:text-emerald-400">Profile helper connected</span>
        </div>
        <details data-testid="revoke-helper">
          <summary className="cursor-pointer list-none text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors">
            Remove / disconnect the helper ▾
          </summary>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-relaxed">
            Run this in a terminal, then restart Chrome:
          </p>
          <div className="bg-secondary rounded-md p-2 font-mono text-[10px] text-foreground/80 break-all select-all mt-1" data-testid="uninstall-command">
            {UNINSTALL_CMD}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(UNINSTALL_CMD); toast.success('Command copied'); }}
            data-testid="copy-uninstall-cmd"
            className="cursor-pointer w-full flex items-center justify-center gap-1.5 h-7 mt-1 text-[10px] font-heading font-semibold rounded-md bg-secondary hover:bg-[hsl(var(--hover-medium))] text-foreground/80 transition-colors"
          >
            <Copy size={11} strokeWidth={1.5} /> Copy command
          </button>
          <p className="text-[10px] text-muted-foreground/40 mt-1">macOS: you can instead double-click <span className="font-mono">uninstall.command</span>.</p>
        </details>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-1.5">
      <Users size={13} className="text-primary" strokeWidth={1.5} />
      <span className="text-xs font-heading font-bold">Profiles</span>
    </div>
  );
}

function ProfileAvatar({ profile, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-[14px]'
    : size === 'sm' ? 'w-6 h-6 text-[10px]'
    : 'w-8 h-8 text-[12px]';
  const color = getAvatarColor(profile.name);

  if (profile.picture) {
    return (
      <img
        src={profile.picture}
        alt={profile.name}
        className={`${sizeClass} rounded-full object-cover shrink-0 border-2 border-background`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-heading font-bold shrink-0 text-white`}
      style={{ backgroundColor: color }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </div>
  );
}
