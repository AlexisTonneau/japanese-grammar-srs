export type Grade = "forgot" | "understood" | "easy";

export interface Progress {
  itemId: string;
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
  lastReviewedAt: string | null;
  reviewCount: number;
}

export interface ProgressStore {
  get(itemId: string): Progress | null;
  set(progress: Progress): void;
  all(): Record<string, Progress>;
}

// Append-only entry written every time the user grades a card. Powers the
// stats dashboard (heatmap, streaks, grade distribution). The composite
// (itemId, reviewedAt) is treated as the dedup key — millisecond precision
// makes collisions effectively impossible for one human's review activity.
export interface ReviewLogEntry {
  itemId: string;
  grade: Grade;
  reviewedAt: string; // ISO 8601
}
