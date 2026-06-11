import type { Grade, Progress } from "./types";

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const MASTERY_THRESHOLD_DAYS = 21;

export function initialProgress(itemId: string, now: Date): Progress {
  return {
    itemId,
    interval: 0,
    easeFactor: DEFAULT_EASE,
    nextReviewDate: now.toISOString(),
    lastReviewedAt: null,
    reviewCount: 0,
  };
}

export function gradeProgress(prev: Progress, grade: Grade, now: Date): Progress {
  let { interval, easeFactor } = prev;

  if (grade === "forgot") {
    interval = 0;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
  } else if (grade === "understood") {
    if (interval === 0) interval = 1;
    else if (interval === 1) interval = 3;
    else interval = Math.round(interval * easeFactor);
  } else {
    if (interval === 0) interval = 4;
    else interval = Math.round(interval * easeFactor * 1.3);
    easeFactor = easeFactor + 0.15;
  }

  const next = new Date(now);
  next.setDate(next.getDate() + Math.max(interval, 0));
  if (interval === 0) next.setMinutes(next.getMinutes() + 10);

  return {
    ...prev,
    interval,
    easeFactor,
    nextReviewDate: next.toISOString(),
    lastReviewedAt: now.toISOString(),
    reviewCount: prev.reviewCount + 1,
  };
}

export function isDue(progress: Progress | null, now: Date): boolean {
  if (!progress) return true;
  return new Date(progress.nextReviewDate).getTime() <= now.getTime();
}

export function isMastered(progress: Progress | null): boolean {
  if (!progress) return false;
  return progress.interval >= MASTERY_THRESHOLD_DAYS;
}
