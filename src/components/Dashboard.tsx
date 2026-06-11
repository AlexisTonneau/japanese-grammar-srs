import { BookOpen, Sparkles } from "lucide-react";
import { grammarData } from "../data/grammarData";
import { useSrs } from "../srs/useSrs";

interface Props {
  onStartReview: () => void;
  onOpenChapter: (chapter: number) => void;
}

const ALL_CHAPTERS = Array.from({ length: 25 }, (_, i) => 26 + i);

export function Dashboard({ onStartReview, onOpenChapter }: Props) {
  const { dueItems, chapterStats } = useSrs();
  const due = dueItems().length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-2 text-neutral-400 text-sm mb-2">
          <BookOpen size={14} />
          <span>Minna no Nihongo · Book 2</span>
        </div>
        <h1 className="text-3xl font-semibold text-neutral-900">Grammar Review</h1>
      </header>

      <button
        onClick={onStartReview}
        disabled={due === 0}
        className="w-full mb-12 py-6 rounded-2xl bg-neutral-900 text-white text-lg font-medium hover:bg-neutral-800 transition-colors disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        <Sparkles size={20} />
        {due > 0 ? `Review ${due} item${due > 1 ? "s" : ""} due` : "Nothing due — come back later"}
      </button>

      <div className="mb-4 text-xs uppercase tracking-wider text-neutral-400">
        Chapters
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {ALL_CHAPTERS.map((ch) => {
          const stats = chapterStats(ch);
          const empty = stats.total === 0;
          return (
            <button
              key={ch}
              onClick={() => !empty && onOpenChapter(ch)}
              disabled={empty}
              className="text-left p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 transition-colors disabled:opacity-40 disabled:hover:border-neutral-200 disabled:cursor-not-allowed"
            >
              <div className="text-sm text-neutral-400">Chapter</div>
              <div className="text-2xl font-semibold text-neutral-900 mb-2">{ch}</div>
              {empty ? (
                <div className="text-xs text-neutral-400">No items yet</div>
              ) : (
                <>
                  <div className="text-xs text-neutral-500">
                    {stats.mastered}/{stats.total} mastered
                  </div>
                  {stats.due > 0 && (
                    <div className="text-xs text-rose-600 mt-1">{stats.due} due</div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10 text-xs text-neutral-400">
        {grammarData.length} sample item{grammarData.length > 1 ? "s" : ""} loaded · progress
        saved locally
      </div>
    </div>
  );
}
