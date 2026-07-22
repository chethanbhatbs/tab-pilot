export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// In the extension, favicons come from Chrome's built-in _favicon API (requires
// the "favicon" permission): served from Chrome's local favicon cache, so no tab
// URL ever leaves the browser. Only the hosted web demo (no chrome.* APIs) still
// uses Google S2, since it has no local cache to read.
const IS_EXTENSION_CTX = typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.runtime?.getURL;

function _localFaviconUrl(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.toString();
}

export function getFaviconUrl(url, chromeFavIconUrl) {
  if (IS_EXTENSION_CTX) {
    if (url) {
      try {
        // Look up by ORIGIN, not the full page URL: sites that swap in
        // per-page favicons (GitHub's PR-status check/cross icons, notification
        // badges) would otherwise replace their recognizable logo in the list.
        const u = new URL(url);
        const target = (u.protocol === 'http:' || u.protocol === 'https:') ? `${u.origin}/` : url;
        return _localFaviconUrl(target);
      } catch {}
    }
    return chromeFavIconUrl || null;
  }
  // Web demo only: Google S2 (external request — never used inside the extension)
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch {
    return chromeFavIconUrl || null;
  }
}

// Favicon for a bare domain (heatmap, whitelist rows) — same local-first routing.
export function getDomainFaviconUrl(domain, size = 32) {
  if (!domain) return null;
  if (IS_EXTENSION_CTX) {
    try { return _localFaviconUrl(`https://${domain}/`, size); } catch { return null; }
  }
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

// Contrast guard: sites like GitHub serve theme-variant favicons, and Chrome
// caches whichever one it saw — browse GitHub in dark mode and the cache holds
// a near-white logo that vanishes on the light panel. _favicon images are
// same-origin so we can read their pixels: when an icon is almost entirely
// light (or dark), tag it and CSS backs it with a contrasting chip.
export function handleFaviconLoad(e) {
  const img = e.target;
  try {
    const s = 16;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, s, s);
    const { data } = ctx.getImageData(0, 0, s, s);
    let n = 0, lum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 64) continue; // skip transparent pixels
      n++;
      lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
    if (n < 8) return; // too few opaque pixels to judge
    const avg = lum / n;
    img.classList.toggle('tp-favicon-light', avg > 0.8);
    img.classList.toggle('tp-favicon-dark', avg < 0.2);
  } catch { /* cross-origin canvas (web demo) — skip */ }
}

// Fallback chain: primary source (set by getFaviconUrl) → Chrome's reported
// favIconUrl → letter avatar. The _favicon API itself falls back to a neutral
// globe icon rather than erroring, so this rarely fires in the extension.
export function handleFaviconError(e) {
  const img = e.target;
  const src = img.src || '';
  const tabUrl = img.dataset.tabUrl || '';
  const chromeFavicon = img.dataset.chromeFavicon || '';
  const tried = (img.dataset.faviconTried || '').split(',').filter(Boolean);

  if (!tried.includes('chrome') && chromeFavicon && chromeFavicon !== src) {
    img.dataset.faviconTried = [...tried, 'chrome'].join(',');
    img.src = chromeFavicon;
    return;
  }

  _showLetterAvatar(img, tabUrl || src);
}

// Deterministic color from a string — produces a vibrant hue per domain
const AVATAR_COLORS = [
  { bg: '#E8384F', fg: '#fff' }, // red
  { bg: '#FD612C', fg: '#fff' }, // orange
  { bg: '#EEC300', fg: '#fff' }, // yellow
  { bg: '#A4CF30', fg: '#fff' }, // lime
  { bg: '#37C866', fg: '#fff' }, // green
  { bg: '#20AAEA', fg: '#fff' }, // blue
  { bg: '#4186E0', fg: '#fff' }, // indigo
  { bg: '#7A6FF0', fg: '#fff' }, // violet
  { bg: '#AA62E3', fg: '#fff' }, // purple
  { bg: '#E362E3', fg: '#fff' }, // pink
  { bg: '#EA4E9D', fg: '#fff' }, // magenta
  { bg: '#FC913A', fg: '#fff' }, // tangerine
];

function _avatarColorForString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getLetterAvatar(url) {
  let letter = '?';
  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
    letter = domain.charAt(0).toUpperCase() || '?';
  } catch {}
  const color = _avatarColorForString(domain || url || '?');
  return { letter, color };
}

function _showLetterAvatar(img, urlHint) {
  img.style.display = 'none';
  const parent = img.parentElement;
  if (parent && !parent.querySelector('.tp-letter-avatar')) {
    const { letter, color } = getLetterAvatar(urlHint);
    const avatar = document.createElement('div');
    avatar.className = 'tp-letter-avatar';
    avatar.textContent = letter;
    Object.assign(avatar.style, {
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px', fontWeight: '700', letterSpacing: '0.5px',
      color: color.fg, background: color.bg, borderRadius: '3px',
    });
    parent.appendChild(avatar);
  }
}

// Smart duplicate matching (default ON, Settings → "Smart duplicate matching"):
// Google's editors encode the open worksheet/view in the URL (?gid= for Sheets),
// so the same document opened twice looks like two different URLs. When enabled,
// docs.google.com editor URLs collapse to their document ID so any view of the
// same document counts as a duplicate. useSettings syncs the flag here so every
// dedupe consumer (Sidebar, panels, chromeAdapter) applies one consistent rule.
let _smartDupMatching = true;
export function setSmartDuplicateMatching(enabled) {
  _smartDupMatching = enabled !== false;
}

// Keeps the /u/<n>/ account segment: the same doc open under two different
// Google accounts stays distinct, so dedupe never closes the other account's view.
const GDOC_EDITOR_RE = /^\/(spreadsheets|document|presentation|forms)(\/u\/\d+)?\/d\/([^/]+)/;

export function normalizeUrl(url) {
  if (!url) return url;
  // For chrome:// and chrome-extension:// URLs, use as-is (stripped of trailing slash)
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return url.replace(/\/$/, '');
  }
  try {
    const u = new URL(url);
    if (_smartDupMatching && u.hostname === 'docs.google.com') {
      const m = u.pathname.match(GDOC_EDITOR_RE);
      if (m) return `${u.origin}/${m[1]}${m[2] || ''}/d/${m[3]}`;
    }
    // Two tabs are duplicates only when they point to the SAME page. We ignore
    // the #hash (in-page anchors) but keep path + query, so different pages on
    // the same site (e.g. /inbox vs /compose) are NOT treated as duplicates.
    return u.origin + u.pathname.replace(/\/$/, '') + u.search;
  } catch {
    return url;
  }
}

export function findDuplicates(allTabs) {
  const urlMap = {};
  allTabs.forEach(tab => {
    if (!tab.url) return;
    const normalized = normalizeUrl(tab.url);
    if (!urlMap[normalized]) urlMap[normalized] = [];
    urlMap[normalized].push(tab);
  });
  return Object.entries(urlMap)
    .filter(([, tabs]) => tabs.length > 1)
    .map(([url, tabs]) => ({ url, tabs }));
}

export function groupByDomain(allTabs) {
  const domainMap = {};
  allTabs.forEach(tab => {
    const domain = getDomain(tab.url);
    if (!domainMap[domain]) domainMap[domain] = [];
    domainMap[domain].push(tab);
  });
  return Object.entries(domainMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([domain, tabs]) => ({ domain, tabs }));
}
