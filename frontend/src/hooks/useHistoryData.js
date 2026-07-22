import { useState, useEffect } from 'react';
import { isExtensionContext } from '@/utils/chromeAdapter';

const AVG_MIN_PER_VISIT = 2; // conservative estimate per page visit

function msFor(filter) {
  const d = 86_400_000;
  return { day: d, week: 7 * d, month: 30 * d }[filter] ?? 7 * d;
}

function getStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// How many history URLs to resolve per refresh. search() returns newest-first,
// so the cap keeps the freshest URLs; each needs one getVisits() call.
const MAX_URLS = 3000;

function getVisits(url) {
  return new Promise(resolve => {
    try { chrome.history.getVisits({ url }, v => resolve(v || [])); }
    catch { resolve([]); }
  });
}

// Run async fn over arr with bounded concurrency so we don't fire thousands of
// getVisits() calls at once and stall the panel.
async function mapLimit(arr, limit, fn) {
  const out = [];
  for (let i = 0; i < arr.length; i += limit) {
    const chunk = await Promise.all(arr.slice(i, i + limit).map(fn));
    out.push(...chunk);
  }
  return out;
}

// Bucket ACTUAL visit timestamps for the trend chart (real, not estimated).
function bucketTimeline(times, timeFilter, now) {
  if (timeFilter === 'day') {
    const labels = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
    const buckets = labels.map(h => ({ hour: h, visits: 0 }));
    times.forEach(t => { buckets[Math.floor(new Date(t).getHours() / 3)].visits += 1; });
    return buckets;
  }
  if (timeFilter === 'week') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets = days.map(d => ({ day: d, visits: 0 }));
    times.forEach(t => { buckets[(new Date(t).getDay() + 6) % 7].visits += 1; });
    return buckets;
  }
  const weeks = ['W1', 'W2', 'W3', 'W4'];
  const buckets = weeks.map(w => ({ week: w, visits: 0 }));
  times.forEach(t => {
    const wIdx = Math.min(3, Math.floor((now - t) / (7 * 86_400_000)));
    buckets[3 - wIdx].visits += 1;
  });
  return buckets;
}

/**
 * Real Chrome history, counted by ACTUAL VISITS in the selected window.
 *
 * chrome.history.search() returns one item per unique URL (deduped), and its
 * visitCount is lifetime — so counting items undercounts revisits (opening
 * Gmail 10× registered as 1, which is the "count never changes" bug). We pull
 * each URL's visit timestamps via getVisits() and count those inside
 * [startTime, now], so every revisit is counted.
 */
export function useHistoryData(timeFilter) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isExtensionContext()) return;
    let cancelled = false;

    (async () => {
      try {
        const now = Date.now();
        const startTime = timeFilter === 'day' ? getStartOfToday() : now - msFor(timeFilter);
        const items = await chrome.history.search({ text: '', startTime, maxResults: 10_000 });
        const urls = items.map(i => i.url).filter(Boolean).slice(0, MAX_URLS);

        const perUrl = await mapLimit(urls, 200, async (url) => {
          const visits = await getVisits(url);
          const times = visits.map(v => v.visitTime).filter(t => t >= startTime && t <= now);
          return { url, times };
        });
        if (cancelled) return;

        const domainMap = {};
        const allTimes = [];
        let totalVisits = 0;
        for (const { url, times } of perUrl) {
          if (!times.length) continue;
          let host;
          try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
          if (host.startsWith('chrome') || host === 'newtab') continue;
          domainMap[host] = (domainMap[host] || 0) + times.length;
          totalVisits += times.length;
          for (const t of times) allTimes.push(t);
        }

        const topDomains = Object.entries(domainMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([domain, visits]) => ({ domain, visits }));

        setData({
          topDomains,
          timelineData: bucketTimeline(allTimes, timeFilter, now),
          totalVisits,
        });
      } catch (e) {
        console.error('Tab Radar history error:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [timeFilter]);

  return data;
}

/**
 * Returns real Chrome history for 7-day timeline grid (TabTimeline).
 */
export function useTimelineGrid() {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isExtensionContext()) return;

    async function fetchHistory() {
      try {
        const startTime = Date.now() - 7 * 86_400_000;
        const items = await chrome.history.search({ text: '', startTime, maxResults: 10_000 });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const grid = [];
        const currentHour = new Date().getHours();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oldestStart = today.getTime() - 6 * 86_400_000;

        // Single pass: bucket each history item into [day 0..6][hour 0..23].
        // Previously each of the 168 cells filtered the full item list — O(items*168),
        // which froze the panel on large histories. This is O(items + 168).
        const counts = Array.from({ length: 7 }, () => new Array(24).fill(0));
        const domainBuckets = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => new Set()));
        for (const item of items) {
          const t = item.lastVisitTime;
          if (t == null || t < oldestStart) continue;
          const dayIdx = Math.floor((t - oldestStart) / 86_400_000);
          if (dayIdx < 0 || dayIdx > 6) continue;
          const hour = Math.floor((t - (oldestStart + dayIdx * 86_400_000)) / 3_600_000);
          if (hour < 0 || hour > 23) continue;
          counts[dayIdx][hour]++;
          const set = domainBuckets[dayIdx][hour];
          if (set.size < 3) {
            try {
              const host = new URL(item.url).hostname.replace(/^www\./, '');
              if (!host.startsWith('chrome') && host !== 'newtab') set.add(host);
            } catch {}
          }
        }

        // Heatmap intensity is scaled against the busiest hour so the colour ramp
        // has contrast. The metric is the REAL page-visit count from Chrome history
        // — we deliberately don't invent "minutes/hours" here (that fabricated number
        // contradicted the measured time-spent tracker). The Timeline answers "when
        // do I browse", not "how long".
        let maxHourly = 0;
        for (let d = 0; d <= 6; d++) for (let h = 0; h <= 23; h++) {
          if (counts[d][h] > maxHourly) maxHourly = counts[d][h];
        }

        for (let dayIdx = 0; dayIdx <= 6; dayIdx++) {
          const date = new Date(oldestStart + dayIdx * 86_400_000);
          const dayName = days[date.getDay()];
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const isToday = dayIdx === 6;

          const hours = [];
          for (let h = 0; h <= 23; h++) {
            // Skip future hours on today
            if (isToday && h > currentHour) {
              hours.push({ hour: h, visits: 0, activity: 0, domains: [] });
              continue;
            }

            const visits = counts[dayIdx][h];
            const activity = maxHourly ? visits / maxHourly : 0;

            hours.push({
              hour: h,
              visits,
              activity,
              domains: Array.from(domainBuckets[dayIdx][h]).slice(0, 3),
            });
          }

          grid.push({ dayName, dateStr, hours, date });
        }

        const totalVisits = grid.reduce((sum, day) =>
          sum + day.hours.reduce((s, h) => s + h.visits, 0), 0
        );

        let mostActiveDay = { day: '', visits: 0 };
        grid.forEach(day => {
          const total = day.hours.reduce((s, h) => s + h.visits, 0);
          if (total > mostActiveDay.visits) {
            mostActiveDay = { day: day.dayName, visits: total };
          }
        });

        setData({ grid, totalVisits, mostActiveDay });
      } catch (e) {
        console.error('Tab Radar timeline error:', e);
      }
    }

    fetchHistory();
  }, []);

  return data;
}

function timeDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * REAL measured active-time per site, written by the background tracker into
 * chrome.storage.local['tabpilot_time'] = { 'YYYY-MM-DD': { domain: seconds } }.
 * Forward-only — empty until the tracker has accrued time. Never estimated.
 */
export function useTimeSpent(timeFilter) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isExtensionContext() || !chrome?.storage?.local) { setData(null); return; }
    let cancelled = false;

    const load = () => {
      chrome.storage.local.get('tabpilot_time', (store) => {
        if (cancelled) return;
        const all = store?.tabpilot_time || {};
        // Build the set of day-keys in range (today back N days), summing what exists.
        const span = timeFilter === 'day' ? 1 : timeFilter === 'week' ? 7 : 30;
        const totals = {};
        let totalSeconds = 0;
        for (let i = 0; i < span; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const day = all[timeDayKey(d)];
          if (!day) continue;
          Object.entries(day).forEach(([domain, secs]) => {
            totals[domain] = (totals[domain] || 0) + secs;
            totalSeconds += secs;
          });
        }
        const sites = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([domain, seconds]) => ({ domain, seconds }));
        setData({ sites, totalSeconds });
      });
    };

    load();
    const iv = setInterval(load, 5000); // refresh while the panel is open
    return () => { cancelled = true; clearInterval(iv); };
  }, [timeFilter]);

  return data;
}
