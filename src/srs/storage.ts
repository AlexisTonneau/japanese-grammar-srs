import type { Progress, ProgressStore } from "./types";

const STORAGE_KEY = "minna-srs:progress:v1";

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
