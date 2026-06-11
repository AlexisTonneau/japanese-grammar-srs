import { useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import type { GrammarItem } from "../data/grammarData";
import type { Grade } from "../srs/types";
import { speakJapanese } from "../lib/tts";

interface Props {
  item: GrammarItem;
  onGrade: (grade: Grade) => void;
}

export function ReviewCard({ item, onGrade }: Props) {
  const [revealed, setRevealed] = useState(false);

  const sentence = useMemo(() => {
    const list = item.sentences.length ? item.sentences : [{ jp: "", en: "" }];
    return list[Math.floor(Math.random() * list.length)];
  }, [item.id]);

  const handleGrade = (g: Grade) => {
    setRevealed(false);
    onGrade(g);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 p-10 sm:p-14 min-h-[24rem] flex flex-col justify-center">
        <button
          onClick={() => speakJapanese(sentence.jp)}
          className="self-end text-neutral-400 hover:text-neutral-700 transition-colors"
          aria-label="Play audio"
        >
          <Volume2 size={22} />
        </button>

        <p className="font-jp text-3xl sm:text-4xl text-neutral-900 text-center leading-relaxed mt-2">
          {sentence.jp}
        </p>

        {revealed && (
          <div className="mt-10 pt-8 border-t border-neutral-100 space-y-4">
            <div className="text-xs uppercase tracking-wider text-neutral-400">
              Grammar Point
            </div>
            <div className="font-jp text-xl text-neutral-800">{item.grammarPoint}</div>

            <div className="text-xs uppercase tracking-wider text-neutral-400 pt-2">
              Translation
            </div>
            <p className="text-lg text-neutral-700 leading-relaxed">
              {sentence.en}
            </p>

            <div className="text-xs uppercase tracking-wider text-neutral-400 pt-2">
              Note
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">{item.note}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full py-4 rounded-xl bg-neutral-900 text-white text-base font-medium hover:bg-neutral-800 transition-colors"
          >
            Show Answer
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <GradeButton
              label="Forgot"
              hint="Reset"
              onClick={() => handleGrade("forgot")}
              tone="rose"
            />
            <GradeButton
              label="Understood"
              hint="Got the nuance"
              onClick={() => handleGrade("understood")}
              tone="emerald"
            />
            <GradeButton
              label="Easy"
              hint="Push it out"
              onClick={() => handleGrade("easy")}
              tone="sky"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface GradeButtonProps {
  label: string;
  hint: string;
  onClick: () => void;
  tone: "rose" | "emerald" | "sky";
}

const TONE_CLASSES: Record<GradeButtonProps["tone"], string> = {
  rose: "border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-rose-700",
  emerald:
    "border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700",
  sky: "border-sky-200 hover:bg-sky-50 hover:border-sky-300 text-sky-700",
};

function GradeButton({ label, hint, onClick, tone }: GradeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`py-4 rounded-xl border-2 bg-white transition-colors ${TONE_CLASSES[tone]}`}
    >
      <div className="text-base font-semibold">{label}</div>
      <div className="text-xs opacity-70 mt-0.5">{hint}</div>
    </button>
  );
}
