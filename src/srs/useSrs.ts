import { useCallback, useEffect, useState } from "react";
import { grammarData } from "../data/grammarData";
import type { GrammarItem } from "../data/grammarData";
import { gradeProgress, initialProgress, isDue, isMastered } from "./algorithm";
import {
  localProgressStore,
  onLocalChange,
  readActiveChapters,
  writeActiveChapters,
} from "./storage";
import type { Grade, Progress } from "./types";

export interface ItemWithProgress {
  item: GrammarItem;
  progress: Progress;
}

export function useSrs() {
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>(() =>
    localProgressStore.all()
  );
  const [activeChapters, setActiveChapters] = useState<Set<number>>(
    () => new Set(readActiveChapters())
  );

  useEffect(() => {
    const refresh = (key: string) => {
      if (key.startsWith("minna-srs:progress")) {
        setProgressMap(localProgressStore.all());
      }
      if (key.startsWith("minna-srs:active-chapters")) {
        setActiveChapters(new Set(readActiveChapters()));
      }
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key) refresh(e.key);
    };
    window.addEventListener("storage", storageHandler);
    const offLocal = onLocalChange(refresh);
    return () => {
      window.removeEventListener("storage", storageHandler);
      offLocal();
    };
  }, []);

  const getProgress = useCallback(
    (itemId: string): Progress | null => {
      return progressMap[itemId] ?? null;
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
      .filter((item) => activeChapters.has(item.chapter))
      .map((item) => ({
        item,
        progress: progressMap[item.id] ?? initialProgress(item.id, now),
      }))
      .filter(({ progress }) => isDue(progress, now));
  }, [progressMap, activeChapters]);

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

  const isChapterActive = useCallback(
    (chapter: number) => activeChapters.has(chapter),
    [activeChapters]
  );

  const toggleChapterActive = useCallback((chapter: number) => {
    setActiveChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      writeActiveChapters([...next]);
      return next;
    });
  }, []);

  const setAllChaptersActive = useCallback((chapters: number[]) => {
    const next = new Set(chapters);
    writeActiveChapters([...next]);
    setActiveChapters(next);
  }, []);

  return {
    progressMap,
    getProgress,
    grade,
    dueItems,
    chapterStats,
    activeChapters,
    isChapterActive,
    toggleChapterActive,
    setAllChaptersActive,
  };
}
