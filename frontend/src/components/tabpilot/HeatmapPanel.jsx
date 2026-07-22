import { useState, useRef } from 'react';
import { Flame, BarChart3, Hourglass, TrendingUp } from 'lucide-react';
import { useHistoryData, useTimeSpent } from '@/hooks/useHistoryData';
import { isExtensionContext } from '@/utils/chromeAdapter';
import { getDomainFaviconUrl } from '@/utils/grouping';

// Format measured seconds as a readable duration. Real data only.
function fmtDuration(s) {
  if (!s || s < 1) return '0m';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function getHeatColor(ratio) {
  if (ratio > 0.8) return { bar: 'hsl(var(--destructive))', text: 'text-destructive' };
  if (ratio > 0.6) return { bar: 'hsl(var(--chart-3))', text: 'text-orange-400' };
  if (ratio > 0.4) return { bar: 'hsl(var(--chart-3))', text: 'text-amber-400' };
  if (ratio > 0.2) return { bar: 'hsl(var(--primary))', text: 'text-primary' };
  return { bar: 'hsl(var(--muted-foreground))', text: 'text-muted-foreground' };
}

function BarChart({ data, maxVal, labelKey, valueKey, unitLabel, formatValue }) {
  const barH = 18;
  const gap = 5;
  const labelW = 90;
  const chartW = 280;
  const barAreaW = chartW - labelW - 50;
  const svgH = data.length * (barH + gap) + 4;

  return (
    <svg viewBox={`0 0 ${chartW} ${svgH}`} className="w-full" data-testid="bar-chart">
      {data.map((item, i) => {
        const y = i * (barH + gap) + 2;
        const ratio = item[valueKey] / maxVal;
        const heat = getHeatColor(ratio);
        const barW = Math.max(2, ratio * barAreaW);
        return (
          <g key={item[labelKey]} className="chart-bar-animate">
            <text x={labelW - 4} y={y + 13} textAnchor="end"
              className="fill-muted-foreground" style={{ fontSize: '9px', fontFamily: 'inherit' }}>
              {item[labelKey].length > 14 ? item[labelKey].slice(0, 14) + '..' : item[labelKey]}
            </text>
            <rect x={labelW} y={y} width={barAreaW} height={barH} rx={3}
              className="fill-muted/30" />
            <rect x={labelW} y={y} width={barW} height={barH} rx={3}
              fill={heat.bar} opacity={0.85} />
            <text x={labelW + barW + 4} y={y + 13}
              className="fill-foreground" style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'inherit' }}>
              {formatValue ? formatValue(item[valueKey]) : `${item[valueKey]}${unitLabel}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Line/area trend chart with a stock-style hover crosshair + value tooltip.
function LineChart({ points }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const w = 280, h = 66, padX = 8, padTop = 10, padBottom = 16;
  const max = Math.max(...points.map(p => p.value), 1);
  const n = points.length;
  const plotH = h - padTop - padBottom;
  const stepX = (w - padX * 2) / Math.max(1, n - 1);
  const xy = points.map((p, i) => [padX + i * stepX, padTop + plotH * (1 - p.value / max)]);
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[n - 1][0].toFixed(1)},${(padTop + plotH).toFixed(1)} L${xy[0][0].toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  };

  const hx = hover != null ? xy[hover][0] : 0;
  // Clamp tooltip horizontally so it doesn't spill past the card edges.
  const tipPct = Math.max(12, Math.min(88, (hx / w) * 100));

  return (
    <div className="relative" data-testid="visits-line-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="tp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tp-area)" />
        <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <line x1={hx} x2={hx} y1={padTop - 2} y2={padTop + plotH} stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 2" />
        )}
        {xy.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={hover === i ? 3.4 : (i === n - 1 ? 2.6 : 1.6)} fill="hsl(var(--primary))" />
            <text x={x} y={h - 4} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '8px', fontFamily: 'inherit' }}>
              {points[i].label}
            </text>
          </g>
        ))}
      </svg>
      {hover != null && (
        <div
          className="absolute top-0 -translate-x-1/2 pointer-events-none px-1.5 py-0.5 rounded bg-popover border border-border shadow-sm whitespace-nowrap"
          style={{ left: `${tipPct}%` }}
        >
          <span className="text-[9px] font-body text-muted-foreground">{points[hover].label}: </span>
          <span className="text-[9px] font-mono font-semibold text-foreground">{points[hover].value} visits</span>
        </div>
      )}
    </div>
  );
}

const TIME_FILTERS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

export function HeatmapPanel({ allTabs, onSwitch, selectMode, selectedTabIds, onToggleSelect }) {
  const [timeFilter, setTimeFilter] = useState('week');
  const isExt = isExtensionContext();

  // Real Chrome history data (null in web preview)
  const historyData = useHistoryData(timeFilter);
  // Real measured active-time per site (null in web preview; empty until accrued)
  const timeData = useTimeSpent(timeFilter);

  // No data available — show placeholder
  if (!isExt && !historyData) {
    return (
      <div className="p-3 space-y-3" data-testid="heatmap-panel">
        <div className="flex items-center gap-2">
          <Flame size={13} className="text-orange-400" strokeWidth={2} />
          <span className="text-[12px] font-heading font-bold">Activity Heatmap</span>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <Flame size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-[11px]">Activity data is available when running as a Chrome extension.</p>
        </div>
      </div>
    );
  }

  // Waiting for data to load
  if (!historyData) {
    return (
      <div className="p-3 space-y-3" data-testid="heatmap-panel">
        <div className="flex items-center gap-2">
          <Flame size={13} className="text-orange-400" strokeWidth={2} />
          <span className="text-[12px] font-heading font-bold">Activity Heatmap</span>
        </div>
        <div className="text-center py-6 text-muted-foreground text-[11px]">Loading history...</div>
      </div>
    );
  }

  return <HeatmapContent
    historyData={historyData}
    timeData={timeData}
    timeFilter={timeFilter}
    setTimeFilter={setTimeFilter}
  />;
}


function HeatmapContent({ historyData, timeData, timeFilter, setTimeFilter }) {
  const domainTimeData = historyData.topDomains;
  const maxDomainVal = domainTimeData[0]?.visits || 1;

  // Trend line — uses the SAME per-filter history buckets as the visit counts,
  // so the graph moves when you switch Today / Week / Month (it previously used
  // a separate fixed 7-day source and never changed).
  const lineLabelKey = timeFilter === 'day' ? 'hour' : timeFilter === 'week' ? 'day' : 'week';
  const linePoints = (historyData.timelineData || []).map(b => ({ label: b[lineLabelKey], value: b.visits }));
  const lineTitle = timeFilter === 'day' ? 'Visits by time of day'
    : timeFilter === 'week' ? 'Visits per day — last 7 days'
    : 'Visits per week — last 4 weeks';

  return (
    <div className="p-3 space-y-3.5" data-testid="heatmap-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={13} className="text-orange-400" strokeWidth={2} />
          <span className="text-[12px] font-heading font-bold">Activity</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-muted-foreground">{historyData.totalVisits} page visits</span>
        </div>
      </div>

      {/* Trend line — page visits per day over the last 7 days (real history). */}
      {linePoints && linePoints.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp size={9} className="text-muted-foreground/60" strokeWidth={1.5} />
            <span className="text-[11px] font-heading text-muted-foreground/70 uppercase tracking-wider">{lineTitle}</span>
          </div>
          <div className="bg-card rounded-lg border border-border/50 p-2">
            <LineChart points={linePoints} />
          </div>
        </div>
      )}

      {/* Time filter */}
      <div className="flex items-center gap-1.5" data-testid="heatmap-time-filters">
        <div className="flex gap-1 flex-1">
          {TIME_FILTERS.map(f => (
            <button
              key={f.id}
              data-testid={`heatmap-filter-${f.id}`}
              onClick={() => setTimeFilter(f.id)}
              className={`cursor-pointer flex-1 py-1 rounded-md text-[10px] font-body font-medium transition-all duration-150
                ${timeFilter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top sites — ranked leaderboard with favicons + slim bars */}
      {domainTimeData.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 size={9} className="text-muted-foreground/60" strokeWidth={1.5} />
            <span className="text-[11px] font-heading text-muted-foreground/70 uppercase tracking-wider">Top sites — page visits</span>
          </div>
          <div className="bg-card rounded-lg border border-border/50 p-2.5 space-y-2" data-testid="top-sites-list">
            {domainTimeData.map((d, i) => {
              const ratio = d.visits / maxDomainVal;
              return (
                <div key={d.domain} className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-muted-foreground/40 w-3 text-right shrink-0">{i + 1}</span>
                  <img
                    src={getDomainFaviconUrl(d.domain)}
                    alt="" className="w-3.5 h-3.5 rounded-sm shrink-0"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] text-foreground/80 truncate">{d.domain}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{d.visits}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, ratio * 100)}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.45))' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time spent — REAL measured active-tab time (forward-only, never estimated) */}
      {timeData && timeData.sites.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Hourglass size={9} className="text-muted-foreground/60" strokeWidth={1.5} />
            <span className="text-[11px] font-heading text-muted-foreground/70 uppercase tracking-wider">
              Time spent {timeFilter === 'day' ? 'today' : timeFilter === 'week' ? 'this week' : 'this month'}
            </span>
            <span className="ml-auto text-[11px] font-mono text-muted-foreground">{fmtDuration(timeData.totalSeconds)} total</span>
          </div>
          <div className="bg-card rounded-lg border border-border/50 p-2">
            <BarChart data={timeData.sites} maxVal={timeData.sites[0].seconds} labelKey="domain" valueKey="seconds" formatValue={fmtDuration} />
          </div>
        </div>
      )}
      {timeData && timeData.sites.length === 0 && (
        <div className="bg-card/60 rounded-lg border border-dashed border-border/60 p-3 text-center">
          <Hourglass size={16} className="mx-auto mb-1 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-[11px] text-muted-foreground">Measuring time spent…</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Real active-tab time shows here as you browse. Nothing is estimated.</p>
        </div>
      )}

    </div>
  );
}
