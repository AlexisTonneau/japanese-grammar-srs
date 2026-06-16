import { useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { grammarData } from "../data/grammarData";
import { useSrs } from "../srs/useSrs";
import { computeStats } from "../srs/stats";
import type { ComputedStats } from "../srs/stats";

interface Props {
  onExit: () => void;
}

export function StatsView({ onExit }: Props) {
  const { progressMap, activeChapters, reviewLog } = useSrs();

  const stats = useMemo<ComputedStats>(() => {
    const items = grammarData.filter((i) => activeChapters.has(i.chapter));
    return computeStats({
      reviews: reviewLog,
      progressMap,
      items,
      now: new Date(),
    });
  }, [progressMap, activeChapters, reviewLog]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-8 flex items-center gap-3">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="text-2xl font-semibold text-neutral-900 ml-auto">
          Stats
        </h1>
      </header>

      {activeChapters.size === 0 ? (
        <div className="text-center text-neutral-500 py-16">
          Activate a chapter on the dashboard to see your stats.
        </div>
      ) : (
        <div className="space-y-10">
          <KpiStrip stats={stats} />
          <Heatmap stats={stats} />
          <Streak stats={stats} />
          <Forecast stats={stats} />
          <ChapterMastery stats={stats} />
          <IntervalDistribution stats={stats} />
          <GradeDistribution stats={stats} />
        </div>
      )}
    </div>
  );
}

function KpiStrip({ stats }: { stats: ComputedStats }) {
  const cards = [
    { label: "Active items", value: stats.kpis.totalActive, icon: Sparkles },
    { label: "Mastered", value: stats.kpis.mastered, icon: CheckCircle2 },
    { label: "Due today", value: stats.kpis.dueToday, icon: TrendingUp },
    { label: "Lifetime reviews", value: stats.kpis.lifetimeReviews, icon: Flame },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="p-4 rounded-xl border border-neutral-200 bg-white"
        >
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
            <Icon size={12} />
            <span>{label}</span>
          </div>
          <div className="text-3xl font-semibold text-neutral-900">{value}</div>
        </div>
      ))}
    </div>
  );
}

// 90-day GitHub-style heatmap. We render an SVG so the cells stay crisp at
// any width. Layout: 7 rows (days of week, Mon-top) × ~13 columns (weeks).
function Heatmap({ stats }: { stats: ComputedStats }) {
  const cells = useMemo(() => buildHeatmapCells(stats.heatmap), [stats.heatmap]);
  const max = cells.reduce((m, c) => (c.count > m ? c.count : m), 0);

  return (
    <section>
      <SectionHeader title="Activity" subtitle="Last 90 days" />
      <div className="p-4 rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <svg
            width={cells.cols * 14 + 4}
            height={7 * 14 + 4}
            className="block"
          >
            {cells.map((cell) => (
              <rect
                key={cell.date}
                x={cell.col * 14 + 2}
                y={cell.row * 14 + 2}
                width={11}
                height={11}
                rx={2}
                fill={heatmapColor(cell.count, max)}
              >
                <title>{`${cell.date}: ${cell.count} review${cell.count === 1 ? "" : "s"}`}</title>
              </rect>
            ))}
          </svg>
        </div>
        <Legend max={max} />
      </div>
    </section>
  );
}

function buildHeatmapCells(daily: Record<string, number>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 89);
  // Align start to Monday so columns map cleanly to weeks.
  const dayOfWeek = (start.getDay() + 6) % 7; // Mon=0, Sun=6
  start.setDate(start.getDate() - dayOfWeek);

  const cells: { date: string; count: number; row: number; col: number }[] = [];
  let col = 0;
  let row = 0;
  let cursor = new Date(start);
  while (cursor <= today) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    cells.push({ date: iso, count: daily[iso] ?? 0, row, col });
    row++;
    if (row === 7) {
      row = 0;
      col++;
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  // Attach total column count for SVG width.
  return Object.assign(cells, { cols: col + 1 });
}

function heatmapColor(count: number, max: number): string {
  if (count === 0) return "#f4f4f5"; // neutral-100
  if (max === 0) return "#f4f4f5";
  const intensity = count / max;
  if (intensity < 0.25) return "#bbf7d0"; // emerald-200
  if (intensity < 0.5) return "#86efac"; // emerald-300
  if (intensity < 0.75) return "#4ade80"; // emerald-400
  return "#16a34a"; // emerald-600
}

function Legend({ max }: { max: number }) {
  const stops = [0, 0.2, 0.4, 0.7, 1].map((f) => Math.round(f * max));
  return (
    <div className="flex items-center gap-2 mt-3 text-[10px] text-neutral-400">
      <span>Less</span>
      {stops.map((c, i) => (
        <span
          key={i}
          className="inline-block w-3 h-3 rounded-sm"
          style={{ background: heatmapColor(c, max) }}
        />
      ))}
      <span>More</span>
    </div>
  );
}

function Streak({ stats }: { stats: ComputedStats }) {
  return (
    <section>
      <SectionHeader title="Streak" />
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
            <Flame size={12} className="text-orange-500" />
            <span>Current</span>
          </div>
          <div className="text-3xl font-semibold text-neutral-900">
            {stats.streak.current}
            <span className="text-sm text-neutral-400 font-normal ml-1">
              day{stats.streak.current === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-neutral-200 bg-white">
          <div className="text-xs text-neutral-400 mb-2">Longest</div>
          <div className="text-3xl font-semibold text-neutral-900">
            {stats.streak.longest}
            <span className="text-sm text-neutral-400 font-normal ml-1">
              day{stats.streak.longest === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Forecast({ stats }: { stats: ComputedStats }) {
  const max = Math.max(1, ...stats.forecast.map((b) => b.count));
  return (
    <section>
      <SectionHeader title="Upcoming reviews" subtitle="Next 14 days" />
      <div className="p-4 rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-end gap-1 h-32">
          {stats.forecast.map((b, i) => {
            const h = (b.count / max) * 100;
            return (
              <div
                key={b.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0"
              >
                <div className="text-[10px] text-neutral-500">{b.count || ""}</div>
                <div
                  className={`w-full rounded-t ${
                    i === 0 ? "bg-rose-400" : "bg-neutral-300"
                  }`}
                  style={{ height: `${Math.max(h, b.count > 0 ? 4 : 0)}%` }}
                  title={`${b.date}: ${b.count}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {stats.forecast.map((b, i) => (
            <div
              key={b.date}
              className="flex-1 text-[9px] text-neutral-400 text-center min-w-0 truncate"
            >
              {i === 0 ? "today" : b.date.slice(5)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChapterMastery({ stats }: { stats: ComputedStats }) {
  return (
    <section>
      <SectionHeader title="Chapter progress" />
      <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2">
        {stats.chapterMastery.map((ch) => {
          const pct = ch.total === 0 ? 0 : (ch.mastered / ch.total) * 100;
          return (
            <div key={ch.chapter} className="flex items-center gap-3">
              <div className="w-12 text-xs text-neutral-500">Ch.{ch.chapter}</div>
              <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-neutral-500 tabular-nums w-16 text-right">
                {ch.mastered}/{ch.total}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IntervalDistribution({ stats }: { stats: ComputedStats }) {
  const total = stats.intervalBands.reduce((s, b) => s + b.count, 0);
  return (
    <section>
      <SectionHeader title="Interval distribution" />
      <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2">
        {stats.intervalBands.map((b) => {
          const pct = total === 0 ? 0 : (b.count / total) * 100;
          return (
            <div key={b.label} className="flex items-center gap-3">
              <div className="w-16 text-xs text-neutral-500">{b.label}</div>
              <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-neutral-500 tabular-nums w-12 text-right">
                {b.count}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GradeDistribution({ stats }: { stats: ComputedStats }) {
  const total =
    stats.gradeDistribution.forgot +
    stats.gradeDistribution.understood +
    stats.gradeDistribution.easy;
  const cells = [
    { label: "Forgot", count: stats.gradeDistribution.forgot, color: "bg-rose-400" },
    {
      label: "Understood",
      count: stats.gradeDistribution.understood,
      color: "bg-emerald-500",
    },
    { label: "Easy", count: stats.gradeDistribution.easy, color: "bg-sky-500" },
  ];
  if (total === 0) {
    return (
      <section>
        <SectionHeader title="Grade distribution" />
        <div className="p-4 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-400 text-center">
          No reviews yet.
        </div>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader title="Grade distribution" />
      <div className="p-4 rounded-xl border border-neutral-200 bg-white">
        <div className="flex h-3 rounded-full overflow-hidden">
          {cells.map((c) => (
            <div
              key={c.label}
              className={c.color}
              style={{ width: `${(c.count / total) * 100}%` }}
              title={`${c.label}: ${c.count}`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-3 text-xs text-neutral-500">
          {cells.map((c) => (
            <div key={c.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${c.color}`} />
              <span>
                {c.label} · {c.count} ({Math.round((c.count / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-xs uppercase tracking-wider text-neutral-400">
        {title}
      </h2>
      {subtitle && <span className="text-xs text-neutral-300">{subtitle}</span>}
    </div>
  );
}
