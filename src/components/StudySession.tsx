import { useState } from "react";
import { ArrowLeft, BookOpen, Minus, Plus, RefreshCw, Volume2 } from "lucide-react";
import type { GrammarItem, SentencePair } from "../data/grammarData";
import { speakJapanese } from "../lib/tts";
import { useSrs } from "../srs/useSrs";

interface Props {
  chapter: number;
  items: GrammarItem[];
  onExit: () => void;
}

export function StudySession({ chapter, items, onExit }: Props) {
  const { isChapterActive, toggleChapterActive } = useSrs();
  const active = isChapterActive(chapter);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-2xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      <div className="max-w-2xl w-full mx-auto px-6 py-8">
        <div className="flex items-center gap-2 text-neutral-400 text-sm mb-2">
          <BookOpen size={14} />
          <span>Minna no Nihongo · Book 2</span>
        </div>
        <h1 className="text-3xl font-semibold text-neutral-900 mb-1">
          Chapter {chapter}
        </h1>
        <p className="text-sm text-neutral-500">
          {items.length} grammar point{items.length === 1 ? "" : "s"}
        </p>

        <div
          className={`mt-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            active
              ? "bg-white border-neutral-200"
              : "bg-neutral-50 border-neutral-200"
          }`}
        >
          <div className="text-sm">
            <div
              className={active ? "text-neutral-900" : "text-neutral-700 font-medium"}
            >
              {active ? "In review rotation" : "Not in review rotation"}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {active
                ? "Items from this chapter appear in your due queue."
                : "Reading here won't add items to your reviews."}
            </div>
          </div>
          <button
            onClick={() => toggleChapterActive(chapter)}
            className={`shrink-0 flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
              active
                ? "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:text-neutral-900"
                : "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800"
            }`}
          >
            {active ? <Minus size={14} /> : <Plus size={14} />}
            {active ? "Remove" : "Add to reviews"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl w-full mx-auto px-6 pb-16 space-y-8">
        {items.map((item, idx) => (
          <GrammarPointCard key={item.id} item={item} number={idx + 1} />
        ))}
      </div>
    </div>
  );
}

interface GrammarPointCardProps {
  item: GrammarItem;
  number: number;
}

function GrammarPointCard({ item, number }: GrammarPointCardProps) {
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const sentence: SentencePair = item.sentences[sentenceIdx];
  const hasMultiple = item.sentences.length > 1;

  const nextSentence = () => {
    setSentenceIdx((i) => (i + 1) % item.sentences.length);
    setRevealed(false);
  };

  return (
    <section className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">
            Grammar Point
          </div>
          <h2 className="font-jp text-xl text-neutral-900 leading-snug">
            {item.grammarPoint}
          </h2>
        </div>
      </div>

      <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1.5">
        Note
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed mb-6">
        {item.note}
      </p>

      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-neutral-400">
          Example
          {hasMultiple && (
            <span className="ml-2 text-neutral-300 normal-case">
              {sentenceIdx + 1} / {item.sentences.length}
            </span>
          )}
        </div>
        {hasMultiple && (
          <button
            onClick={nextSentence}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <RefreshCw size={12} />
            Next example
          </button>
        )}
      </div>

      <div className="border-l-2 border-neutral-100 pl-4 py-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-jp text-lg sm:text-xl text-neutral-900 leading-relaxed flex-1">
            {sentence.jp}
          </p>
          <button
            onClick={() => speakJapanese(sentence.jp)}
            className="text-neutral-300 hover:text-neutral-700 transition-colors shrink-0 mt-1"
            aria-label="Play audio"
          >
            <Volume2 size={18} />
          </button>
        </div>
        {revealed ? (
          <p className="text-sm text-neutral-500 leading-relaxed mt-2">
            {sentence.en}
          </p>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors mt-2 underline-offset-4 hover:underline"
          >
            Tap to reveal translation
          </button>
        )}
      </div>
    </section>
  );
}
