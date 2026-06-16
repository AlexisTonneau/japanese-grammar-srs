import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Check,
  Lock,
  Pencil,
  Sparkles,
} from "lucide-react";
import { grammarData } from "../data/grammarData";
import { useSrs } from "../srs/useSrs";
import { SyncStatus } from "./SyncStatus";

interface Props {
  onStartReview: () => void;
  onOpenChapter: (chapter: number) => void;
  onOpenStats: () => void;
}

const ALL_CHAPTERS = Array.from({ length: 25 }, (_, i) => 26 + i);

export function Dashboard({ onStartReview, onOpenChapter, onOpenStats }: Props) {
  const {
    dueItems,
    chapterStats,
    activeChapters,
    isChapterActive,
    toggleChapterActive,
    setAllChaptersActive,
  } = useSrs();
  const [editing, setEditing] = useState(activeChapters.size === 0);
  const due = dueItems().length;
  const activeCount = activeChapters.size;

  const handleCardClick = (ch: number, empty: boolean) => {
    if (empty) return;
    if (editing) toggleChapterActive(ch);
    else if (isChapterActive(ch)) onOpenChapter(ch);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 text-neutral-400 text-sm mb-2">
              <BookOpen size={14} />
              <span>Minna no Nihongo · Book 2</span>
            </div>
            <h1 className="text-3xl font-semibold text-neutral-900">Grammar Review</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenStats}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 transition-colors"
              title="Stats"
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={() => setEditing((v) => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
                editing
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {editing ? <Check size={16} /> : <Pencil size={16} />}
              {editing ? "Done" : "Edit"}
            </button>
          </div>
        </div>
        <SyncStatus />
      </header>

      {editing ? (
        <div className="mb-12 p-5 rounded-2xl border border-neutral-200 bg-white">
          <div className="text-sm text-neutral-700 mb-3">
            Tap chapters you've already studied. Only active chapters count toward
            reviews.
          </div>
          <div className="flex gap-3 text-sm">
            <button
              onClick={() => setAllChaptersActive(ALL_CHAPTERS)}
              className="text-neutral-700 underline-offset-4 hover:underline"
            >
              Select all
            </button>
            <span className="text-neutral-300">·</span>
            <button
              onClick={() => setAllChaptersActive([])}
              className="text-neutral-700 underline-offset-4 hover:underline"
            >
              Clear
            </button>
            <span className="ml-auto text-neutral-400">
              {activeCount} of {ALL_CHAPTERS.length} active
            </span>
          </div>
        </div>
      ) : activeCount === 0 ? (
        <button
          onClick={() => setEditing(true)}
          className="w-full mb-12 py-6 rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-600 hover:border-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Select chapters you've studied to start reviewing
        </button>
      ) : (
        <button
          onClick={onStartReview}
          disabled={due === 0}
          className="w-full mb-12 py-6 rounded-2xl bg-neutral-900 text-white text-lg font-medium hover:bg-neutral-800 transition-colors disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <Sparkles size={20} />
          {due > 0
            ? `Review ${due} item${due > 1 ? "s" : ""} due`
            : "Nothing due — come back later"}
        </button>
      )}

      <div className="mb-4 text-xs uppercase tracking-wider text-neutral-400">
        Chapters
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {ALL_CHAPTERS.map((ch) => {
          const stats = chapterStats(ch);
          const empty = stats.total === 0;
          const active = isChapterActive(ch);
          const showAsLocked = !editing && !active;

          return (
            <button
              key={ch}
              onClick={() => handleCardClick(ch, empty)}
              disabled={empty || (!editing && !active)}
              className={`relative text-left p-4 rounded-xl border transition-colors ${
                empty
                  ? "bg-white border-neutral-200 opacity-40 cursor-not-allowed"
                  : editing
                  ? active
                    ? "bg-neutral-900 border-neutral-900 text-white"
                    : "bg-white border-neutral-200 hover:border-neutral-400"
                  : showAsLocked
                  ? "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed"
                  : "bg-white border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {editing && !empty && (
                <div
                  className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                    active ? "bg-white border-white" : "border-neutral-300"
                  }`}
                >
                  {active && <Check size={12} className="text-neutral-900" />}
                </div>
              )}
              {showAsLocked && !empty && (
                <Lock
                  size={14}
                  className="absolute top-3 right-3 text-neutral-300"
                />
              )}
              <div
                className={`text-sm ${
                  editing && active ? "text-neutral-300" : "text-neutral-400"
                }`}
              >
                Chapter
              </div>
              <div
                className={`text-2xl font-semibold mb-2 ${
                  editing && active ? "text-white" : ""
                }`}
              >
                {ch}
              </div>
              {empty ? (
                <div className="text-xs text-neutral-400">No items yet</div>
              ) : (
                <>
                  <div
                    className={`text-xs ${
                      editing && active ? "text-neutral-300" : "text-neutral-500"
                    }`}
                  >
                    {stats.mastered}/{stats.total} mastered
                  </div>
                  {!editing && active && stats.due > 0 && (
                    <div className="text-xs text-rose-600 mt-1">{stats.due} due</div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10 text-xs text-neutral-400">
        {grammarData.length} item{grammarData.length > 1 ? "s" : ""} loaded ·{" "}
        {activeCount}/{ALL_CHAPTERS.length} chapters active · progress saved locally
      </div>
    </div>
  );
}
