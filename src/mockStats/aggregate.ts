import type { MockQuestion } from "../data/mockExamData";
import type { MockAttempt } from "./storage";

export interface GrammarPointBucket {
  key: string;
  label: string;
  chapter: number | null;
  total: number;
  correct: number;
  accuracy: number;
  questionIds: string[];
}

export interface ChapterBucket {
  chapter: number;
  total: number;
  correct: number;
  accuracy: number;
}

export interface AggregatedStats {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  distinctQuestions: number;
  byGrammarPoint: GrammarPointBucket[];
  byChapter: ChapterBucket[];
}

export function normalizeGrammarKey(gp: string): string {
  return gp
    .replace(/^[～〜]+/, "")
    .replace(/[(（][^)）]*[)）]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function aggregate(
  attempts: MockAttempt[],
  questions: MockQuestion[],
): AggregatedStats {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const groupKey = (q: MockQuestion): string | null => {
    if (!q.grammarPoint) return null;
    const k = normalizeGrammarKey(q.grammarPoint);
    return k.length > 0 ? k : null;
  };

  const grammarMap = new Map<
    string,
    {
      key: string;
      labelCounts: Map<string, number>;
      chapters: Map<number, number>;
      total: number;
      correct: number;
      questionIds: Set<string>;
    }
  >();
  const chapterMap = new Map<number, { total: number; correct: number }>();

  let totalAttempts = 0;
  let totalCorrect = 0;
  const seenQuestions = new Set<string>();

  for (const a of attempts) {
    const q = questionById.get(a.questionId);
    if (!q) continue;
    totalAttempts++;
    if (a.correct) totalCorrect++;
    seenQuestions.add(q.id);

    const key = groupKey(q);
    if (key) {
      let bucket = grammarMap.get(key);
      if (!bucket) {
        bucket = {
          key,
          labelCounts: new Map(),
          chapters: new Map(),
          total: 0,
          correct: 0,
          questionIds: new Set(),
        };
        grammarMap.set(key, bucket);
      }
      bucket.total++;
      if (a.correct) bucket.correct++;
      bucket.questionIds.add(q.id);
      if (q.grammarPoint) {
        bucket.labelCounts.set(
          q.grammarPoint,
          (bucket.labelCounts.get(q.grammarPoint) ?? 0) + 1,
        );
      }
      if (q.chapter !== undefined) {
        bucket.chapters.set(q.chapter, (bucket.chapters.get(q.chapter) ?? 0) + 1);
      }
    }

    if (q.chapter !== undefined) {
      let c = chapterMap.get(q.chapter);
      if (!c) {
        c = { total: 0, correct: 0 };
        chapterMap.set(q.chapter, c);
      }
      c.total++;
      if (a.correct) c.correct++;
    }
  }

  const byGrammarPoint: GrammarPointBucket[] = [...grammarMap.values()].map(
    (b) => {
      const label = mostCommon(b.labelCounts) ?? b.key;
      const dominantChapter = mostCommon(b.chapters) ?? null;
      return {
        key: b.key,
        label,
        chapter: dominantChapter,
        total: b.total,
        correct: b.correct,
        accuracy: b.total === 0 ? 0 : b.correct / b.total,
        questionIds: [...b.questionIds],
      };
    },
  );

  const byChapter: ChapterBucket[] = [...chapterMap.entries()]
    .map(([chapter, v]) => ({
      chapter,
      total: v.total,
      correct: v.correct,
      accuracy: v.total === 0 ? 0 : v.correct / v.total,
    }))
    .sort((a, b) => a.chapter - b.chapter);

  return {
    totalAttempts,
    totalCorrect,
    overallAccuracy: totalAttempts === 0 ? 0 : totalCorrect / totalAttempts,
    distinctQuestions: seenQuestions.size,
    byGrammarPoint,
    byChapter,
  };
}

function mostCommon<K>(counts: Map<K, number>): K | null {
  let best: K | null = null;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function weakest(
  stats: AggregatedStats,
  { minAttempts = 2, limit = 5 }: { minAttempts?: number; limit?: number } = {},
): GrammarPointBucket[] {
  return stats.byGrammarPoint
    .filter((b) => b.total >= minAttempts)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.total - a.total;
    })
    .slice(0, limit);
}
