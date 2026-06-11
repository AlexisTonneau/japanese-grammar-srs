import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { ReviewSession } from "./components/ReviewSession";
import { grammarData } from "./data/grammarData";
import type { GrammarItem } from "./data/grammarData";
import { useSrs } from "./srs/useSrs";

type View =
  | { kind: "dashboard" }
  | { kind: "review"; queue: GrammarItem[] };

export default function App() {
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const { dueItems } = useSrs();

  const startDueReview = () => {
    const queue = dueItems().map(({ item }) => item);
    if (queue.length === 0) return;
    setView({ kind: "review", queue });
  };

  const startChapterReview = (chapter: number) => {
    const queue = grammarData.filter((i) => i.chapter === chapter);
    if (queue.length === 0) return;
    setView({ kind: "review", queue });
  };

  const exit = () => setView({ kind: "dashboard" });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {view.kind === "dashboard" && (
        <Dashboard onStartReview={startDueReview} onOpenChapter={startChapterReview} />
      )}
      {view.kind === "review" && (
        <ReviewSession queue={view.queue} onExit={exit} />
      )}
    </div>
  );
}
