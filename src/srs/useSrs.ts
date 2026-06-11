import { useCallback, useEffect, useState } from "react";
import { grammarData } from "../data/grammarData";
import type { GrammarItem } from "../data/grammarData";
import { gradeProgress, initialProgress, isDue, isMastered } from "./algorithm";
import { localProgressStore } from "./storage";
import type { Grade, Progress } from "./types";

export interface ItemWithProgress {
  item: GrammarItem;
  progress: Progress;
}

export function useSrs() {
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>(() =>
    localProgressStore.all()
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("minna-srs:")) {
        setProgressMap(localProgressStore.all());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const getProgress = useCallback(
    (itemId: string): Progress => {
      return progressMap[itemId] ?? initialProgress(itemId, new Date());
    },
    [progressMap]
  );

  const grade = useCallback(
    (itemId: string, g: Grade) => {
      const now = new Date();
      const prev = progressMap[itemId] ?? initialProgress(itemId, now);
      const next = gradeProgress(prev, g, now);
      localProgressStore.set(next);
      setProgressMap((m) => ({ ...m, [itemId]: next }));
    },
    [progressMap]
  );

  const dueItems = useCallback((): ItemWithProgress[] => {
    const now = new Date();
    return grammarData
      .map((item) => ({ item, progress: getProgress(item.id) }))
      .filter(({ progress }) => isDue(progress, now));
  }, [getProgress]);

  const chapterStats = useCallback(
    (chapter: number) => {
      const items = grammarData.filter((i) => i.chapter === chapter);
      const mastered = items.filter((i) => isMastered(progressMap[i.id] ?? null)).length;
      const due = items.filter((i) =>
        isDue(progressMap[i.id] ?? null, new Date())
      ).length;
      return { total: items.length, mastered, due };
    },
    [progressMap]
  );

  return { progressMap, getProgress, grade, dueItems, chapterStats };
}
