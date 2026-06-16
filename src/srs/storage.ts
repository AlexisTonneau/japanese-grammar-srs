import type { Progress, ProgressStore, ReviewLogEntry } from "./types";

const STORAGE_KEY = "minna-srs:progress:v1";
const ACTIVE_CHAPTERS_KEY = "minna-srs:active-chapters:v1";
const REVIEWS_KEY = "minna-srs:reviews:v1";

function readAll(): Record<string, Progress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Progress>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Progress>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  notifyChange(STORAGE_KEY);
}

const CHANGE_EVENT = "minna-srs:change";

function notifyChange(key: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  }
}

export function onLocalChange(handler: (key: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    handler((e as CustomEvent<{ key: string }>).detail?.key ?? "");
  };
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export const localProgressStore: ProgressStore = {
  get(itemId) {
    return readAll()[itemId] ?? null;
  },
  set(progress) {
    const map = readAll();
    map[progress.itemId] = progress;
    writeAll(map);
  },
  all() {
    return readAll();
  },
};

export function readActiveChapters(): number[] {
  try {
    const raw = localStorage.getItem(ACTIVE_CHAPTERS_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function writeActiveChapters(chapters: number[]): void {
  localStorage.setItem(ACTIVE_CHAPTERS_KEY, JSON.stringify(chapters));
  notifyChange(ACTIVE_CHAPTERS_KEY);
}

// Review log — append-only. Reads are full-array; ok because even after years
// of daily 50-card reviews this stays well under 1 MB (~70 bytes per entry).
export function readReviewLog(): ReviewLogEntry[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? (JSON.parse(raw) as ReviewLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendReview(entry: ReviewLogEntry): void {
  const log = readReviewLog();
  log.push(entry);
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(log));
  notifyChange(REVIEWS_KEY);
}

// Replace the whole log — used by the sync layer after merging remote rows.
export function writeReviewLog(entries: ReviewLogEntry[]): void {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(entries));
  notifyChange(REVIEWS_KEY);
}
