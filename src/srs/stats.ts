// Pure functions over the SRS state. No React, no localStorage, no clock —
// everything takes inputs and returns derived values, so we can unit-test
// them later and the Stats view stays a thin shell.

import type { GrammarItem } from "../data/grammarData";
import { isMastered } from "./algorithm";
import type { Grade, Progress, ReviewLogEntry } from "./types";

export interface StatsInputs {
  reviews: ReviewLogEntry[];
  progressMap: Record<string, Progress>;
  items: GrammarItem[]; // typically grammarData filtered to active chapters
  now: Date;
}

export interface KpiSummary {
  totalActive: number;
  mastered: number;
  dueToday: number;
  lifetimeReviews: number;
}

export interface ChapterMastery {
  chapter: number;
  mastered: number;
  total: number;
}

// ISO-date (YYYY-MM-DD) → review count.
export type DailyCounts = Record<string, number>;

export interface ForecastBucket {
  // ISO-date label for the bucket. Today, then +1d, +2d, …
  date: string;
  count: number;
}

export interface IntervalBand {
  label: string;
  count: number;
}

export interface GradeDistribution {
  forgot: number;
  understood: number;
  easy: number;
}

export interface StreakInfo {
  current: number;
  longest: number;
}

export interface ComputedStats {
  kpis: KpiSummary;
  chapterMastery: ChapterMastery[];
  forecast: ForecastBucket[];
  intervalBands: IntervalBand[];
  gradeDistribution: GradeDistribution;
  streak: StreakInfo;
  heatmap: DailyCounts; // 90-day window keyed by YYYY-MM-DD
  reviewedDates: string[]; // sorted unique YYYY-MM-DD dates with ≥1 review
}

// Format a Date as YYYY-MM-DD in the user's local timezone. Using local time
// (not UTC) so streaks line up with the user's day boundaries.
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function computeStats(inputs: StatsInputs): ComputedStats {
  const { reviews, progressMap, items, now } = inputs;
  const activeIds = new Set(items.map((i) => i.id));

  // KPIs
  const masteredCount = items.filter((i) =>
    isMastered(progressMap[i.id] ?? null)
  ).length;
  const dueTodayCount = items.filter((i) => {
    const p = progressMap[i.id];
    if (!p) return true; // never reviewed
    return new Date(p.nextReviewDate).getTime() <= now.getTime();
  }).length;
  const lifetimeReviews = Object.values(progressMap).reduce(
    (sum, p) => sum + (p.reviewCount ?? 0),
    0
  );

  // Chapter mastery
  const byChapter = new Map<number, { mastered: number; total: number }>();
  for (const item of items) {
    const ch = byChapter.get(item.chapter) ?? { mastered: 0, total: 0 };
    ch.total++;
    if (isMastered(progressMap[item.id] ?? null)) ch.mastered++;
    byChapter.set(item.chapter, ch);
  }
  const chapterMastery: ChapterMastery[] = [...byChapter.entries()]
    .map(([chapter, { mastered, total }]) => ({ chapter, mastered, total }))
    .sort((a, b) => a.chapter - b.chapter);

  // Forecast — for each of the next 14 days, count items whose nextReviewDate
  // falls in that day. Items already due today are bucketed into today.
  const forecast: ForecastBucket[] = [];
  const today = startOfDay(now);
  for (let d = 0; d < 14; d++) {
    const bucketStart = addDays(today, d);
    const bucketEnd = addDays(today, d + 1);
    let count = 0;
    for (const item of items) {
      const p = progressMap[item.id];
      if (!p) {
        if (d === 0) count++; // never-reviewed items are due "now"
        continue;
      }
      const next = new Date(p.nextReviewDate);
      if (d === 0 && next.getTime() <= bucketEnd.getTime()) {
        // Anything due strictly before today still rolls into today's bucket.
        count++;
      } else if (
        next.getTime() >= bucketStart.getTime() &&
        next.getTime() < bucketEnd.getTime()
      ) {
        count++;
      }
    }
    forecast.push({ date: isoDate(bucketStart), count });
  }

  // Interval distribution. Bands chosen to match SRS-typical phases.
  const bands = [
    { label: "New", min: -1, max: 0 }, // interval 0 = new / just reset
    { label: "1-3d", min: 1, max: 3 },
    { label: "4-7d", min: 4, max: 7 },
    { label: "8-21d", min: 8, max: 21 },
    { label: "22-90d", min: 22, max: 90 },
    { label: "90d+", min: 91, max: Infinity },
  ];
  const intervalBands: IntervalBand[] = bands.map((b) => ({
    label: b.label,
    count: 0,
  }));
  for (const item of items) {
    const p = progressMap[item.id];
    const interval = p?.interval ?? 0;
    const idx = bands.findIndex((b) => interval >= b.min && interval <= b.max);
    if (idx >= 0) intervalBands[idx].count++;
  }

  // Grade distribution — total counts of each grade across the review log.
  // Filtered to active items only so toggling chapters off cleans the chart.
  const gradeDistribution: GradeDistribution = {
    forgot: 0,
    understood: 0,
    easy: 0,
  };
  for (const r of reviews) {
    if (!activeIds.has(r.itemId)) continue;
    incrementGrade(gradeDistribution, r.grade);
  }

  // Heatmap: last 90 days, daily review counts keyed by local YYYY-MM-DD.
  const heatmap: DailyCounts = {};
  const horizon = startOfDay(addDays(now, -89)); // 90 days inclusive of today
  for (const r of reviews) {
    if (!activeIds.has(r.itemId)) continue;
    const d = new Date(r.reviewedAt);
    if (d.getTime() < horizon.getTime()) continue;
    const key = isoDate(d);
    heatmap[key] = (heatmap[key] ?? 0) + 1;
  }

  // Streak — count consecutive days back from today (inclusive) with ≥1 review.
  // Longest is the longest run anywhere in the log.
  const reviewedDates = collectReviewedDates(reviews, activeIds);
  const streak = computeStreak(reviewedDates, today);

  return {
    kpis: {
      totalActive: items.length,
      mastered: masteredCount,
      dueToday: dueTodayCount,
      lifetimeReviews,
    },
    chapterMastery,
    forecast,
    intervalBands,
    gradeDistribution,
    streak,
    heatmap,
    reviewedDates,
  };
}

function incrementGrade(dist: GradeDistribution, grade: Grade): void {
  dist[grade]++;
}

function collectReviewedDates(
  reviews: ReviewLogEntry[],
  activeIds: Set<string>
): string[] {
  const set = new Set<string>();
  for (const r of reviews) {
    if (!activeIds.has(r.itemId)) continue;
    set.add(isoDate(new Date(r.reviewedAt)));
  }
  return [...set].sort();
}

function computeStreak(reviewedDates: string[], today: Date): StreakInfo {
  if (reviewedDates.length === 0) return { current: 0, longest: 0 };
  const set = new Set(reviewedDates);

  // Current: walk back from today; if today is missing but yesterday is
  // present, start counting from yesterday (a forgiving rule that lets you
  // open the app at midnight without resetting the streak).
  let cursor = startOfDay(today);
  if (!set.has(isoDate(cursor))) {
    cursor = addDays(cursor, -1);
    if (!set.has(isoDate(cursor))) {
      // Neither today nor yesterday — current streak is 0, but compute longest.
      return { current: 0, longest: longestRun(reviewedDates) };
    }
  }
  let current = 0;
  while (set.has(isoDate(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest: Math.max(current, longestRun(reviewedDates)) };
}

function longestRun(reviewedDates: string[]): number {
  if (reviewedDates.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < reviewedDates.length; i++) {
    const prev = new Date(reviewedDates[i - 1]);
    const cur = new Date(reviewedDates[i]);
    const diffDays = Math.round(
      (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}
