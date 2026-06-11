import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ReviewCard } from "./ReviewCard";
import { useSrs } from "../srs/useSrs";
import type { GrammarItem } from "../data/grammarData";
import type { Grade } from "../srs/types";

interface Props {
  queue: GrammarItem[];
  onExit: () => void;
}

export function ReviewSession({ queue, onExit }: Props) {
  const { grade } = useSrs();
  const initialIds = useMemo(() => queue.map((q) => q.id), [queue]);
  const [remaining, setRemaining] = useState<GrammarItem[]>(queue);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    setRemaining(queue);
    setCompleted(0);
  }, [queue]);

  if (remaining.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-semibold text-neutral-900 mb-2">All done</h2>
        <p className="text-neutral-500 mb-8">
          You reviewed {completed} item{completed === 1 ? "" : "s"}.
        </p>
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const current = remaining[0];
  const total = initialIds.length;
  const progress = completed;

  const handleGrade = (g: Grade) => {
    grade(current.id, g);
    setRemaining((r) => r.slice(1));
    setCompleted((c) => c + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-2xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Exit
        </button>
        <div className="text-sm text-neutral-400">
          {progress + 1} / {total}
        </div>
      </div>

      <div className="flex-1 flex items-center px-6 py-12">
        <ReviewCard item={current} onGrade={handleGrade} />
      </div>
    </div>
  );
}
