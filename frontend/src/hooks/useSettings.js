import { useState, useCallback, useEffect } from 'react';
import { isExtensionContext, chromeStorageGet, chromeStorageSet } from '@/utils/chromeAdapter';
import { setSmartDuplicateMatching } from '@/utils/grouping';

const STORAGE_KEY = 'tabpilot_settings';

const DEFAULT_SETTINGS = {
  theme: 'light',
  accentColor: 'blue',
  defaultView: 'window',
  showFavicons: true,
  showUrls: true,
  confirmActions: false,
  smartDuplicateMatching: true,
  showTabCountBadge: true,
  compactMode: false,
  // Auto-close rules (persisted so they survive panel switches)
  autoCloseEnabled: false,
  autoClosePreset: '30',
  autoCloseCustomMinutes: '',
  autoCloseWhitelist: ['mail.google.com', 'docs.google.com'],
};

function loadSettingsFromLocalStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const settings = data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    // Sync before first render so dedupe never runs one frame with the wrong rule
    setSmartDuplicateMatching(settings.smartDuplicateMatching);
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettingsFromLocalStorage);

  // On mount in extension context: load from chrome.storage (source of truth)
  useEffect(() => {
    if (!isExtensionContext()) return;
    chromeStorageGet([STORAGE_KEY]).then(data => {
      if (data?.[STORAGE_KEY]) {
        const merged = { ...DEFAULT_SETTINGS, ...data[STORAGE_KEY] };
        setSettings(merged);
        // Also sync to localStorage for fast initial load next time
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
    });
  }, []);

  // Cross-window sync: listen for settings changes from other windows
  useEffect(() => {
    if (!isExtensionContext() || !chrome?.storage?.onChanged) return;
    const handler = (changes) => {
      if (!changes[STORAGE_KEY]) return;
      const newVal = changes[STORAGE_KEY].newValue;
      if (newVal) {
        const merged = { ...DEFAULT_SETTINGS, ...newVal };
        setSettings(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // In extension context, also write to chrome.storage for cross-window sync
      if (isExtensionContext()) {
        chromeStorageSet({ [STORAGE_KEY]: updated });
      }
      return updated;
    });
  }, []);

  // Keep the module-level dedupe rule in grouping.js in sync (covers
  // chrome.storage loads and cross-window changes, not just local toggles)
  useEffect(() => {
    setSmartDuplicateMatching(settings.smartDuplicateMatching);
  }, [settings.smartDuplicateMatching]);

  // Apply theme (light/dark)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) root.classList.add('dark');
      else root.classList.remove('dark');
      const handler = (e) => {
        if (e.matches) root.classList.add('dark');
        else root.classList.remove('dark');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.theme]);

  // Apply accent color
  useEffect(() => {
    const root = document.documentElement;
    if (settings.accentColor && settings.accentColor !== 'blue') {
      root.setAttribute('data-accent', settings.accentColor);
    } else {
      root.removeAttribute('data-accent');
    }
  }, [settings.accentColor]);

  return { settings, updateSetting };
}
