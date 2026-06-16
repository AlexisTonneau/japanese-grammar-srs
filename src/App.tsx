import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { ReviewSession } from "./components/ReviewSession";
import { StudySession } from "./components/StudySession";
import { StatsView } from "./components/StatsView";
import { grammarData } from "./data/grammarData";
import type { GrammarItem } from "./data/grammarData";
import { useSrs } from "./srs/useSrs";

type View =
  | { kind: "dashboard" }
  | { kind: "review"; queue: GrammarItem[] }
  | { kind: "study"; chapter: number; items: GrammarItem[] }
  | { kind: "stats" };

// Fisher-Yates shuffle. Returns a new array; doesn't mutate the input.
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function App() {
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const { dueItems } = useSrs();

  const startDueReview = () => {
    const queue = shuffle(dueItems().map(({ item }) => item));
    if (queue.length === 0) return;
    setView({ kind: "review", queue });
  };

  const openChapterStudy = (chapter: number) => {
    const items = grammarData.filter((i) => i.chapter === chapter);
    if (items.length === 0) return;
    setView({ kind: "study", chapter, items });
  };

  const exit = () => setView({ kind: "dashboard" });
  const openStats = () => setView({ kind: "stats" });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {view.kind === "dashboard" && (
        <Dashboard
          onStartReview={startDueReview}
          onOpenChapter={openChapterStudy}
          onOpenStats={openStats}
        />
      )}
      {view.kind === "review" && (
        <ReviewSession queue={view.queue} onExit={exit} />
      )}
      {view.kind === "study" && (
        <StudySession chapter={view.chapter} items={view.items} onExit={exit} />
      )}
      {view.kind === "stats" && <StatsView onExit={exit} />}
    </div>
  );
}
