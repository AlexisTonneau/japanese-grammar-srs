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
