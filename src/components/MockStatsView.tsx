import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Target, RotateCcw } from "lucide-react";
import { getAllMockQuestions, officialSamples } from "../data/mockExamData";
import {
  aggregate,
  weakest,
  type GrammarPointBucket,
} from "../mockStats/aggregate";
import {
  clearMockAttempts,
  onMockChange,
  readMockAttempts,
} from "../mockStats/storage";

interface Props {
  onExit: () => void;
  onOpenChapter: (chapter: number) => void;
}

export function MockStatsView({ onExit, onOpenChapter }: Props) {
  const [attempts, setAttempts] = useState(() => readMockAttempts());
  useEffect(() => onMockChange(() => setAttempts(readMockAttempts())), []);

  const questions = useMemo(() => getAllMockQuestions(), []);
  const stats = useMemo(() => aggregate(attempts, questions), [attempts, questions]);
  const weakGrammar = useMemo(
    () => weakest(stats, { minAttempts: 2, limit: 8 }),
    [stats],
  );

  const confirmReset = () => {
    if (confirm("Clear all mock exam attempt history?")) clearMockAttempts();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-8 flex items-center gap-3">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="text-2xl font-semibold text-neutral-900 ml-auto">
          Mock Exam Analytics
        </h1>
      </header>

      {attempts.length === 0 ? (
        <div className="text-center text-neutral-500 py-16 border border-dashed border-neutral-300 rounded-2xl">
          Take a few mock questions to start seeing where your weak points are.
        </div>
      ) : (
        <div className="space-y-10">
          <KpiStrip
            total={stats.totalAttempts}
            correct={stats.totalCorrect}
            accuracy={stats.overallAccuracy}
            distinct={stats.distinctQuestions}
          />
          <WeakPoints weak={weakGrammar} onOpenChapter={onOpenChapter} />
          <ChapterHeatmap stats={stats} onOpenChapter={onOpenChapter} />
          <AllGrammarTable buckets={stats.byGrammarPoint} />
          <ReferenceMaterials />
          <div className="pt-4">
            <button
              onClick={confirmReset}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-rose-600 transition-colors"
            >
              <RotateCcw size={12} />
              Reset attempt history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceMaterials() {
  return (
    <section>
      <SectionHeader
        title="Official reference materials"
        subtitle="Authentic JLPT N4 samples"
      />
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
          The real JLPT publishes a limited set of sample questions — worth
          working through alongside the drills here.
        </p>
        <ul className="space-y-2">
          {officialSamples.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-700 hover:text-neutral-900 underline-offset-4 hover:underline"
              >
                {s.label}
                <ExternalLink size={13} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface KpiProps {
  total: number;
  correct: number;
  accuracy: number;
  distinct: number;
}

function KpiStrip({ total, correct, accuracy, distinct }: KpiProps) {
  const pct = Math.round(accuracy * 100);
  const cards = [
    { label: "Attempts", value: total },
    { label: "Correct", value: correct },
    { label: "Accuracy", value: `${pct}%` },
    { label: "Questions seen", value: distinct },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="p-4 rounded-xl border border-neutral-200 bg-white"
        >
          <div className="text-xs text-neutral-400 mb-2">{c.label}</div>
          <div className="text-3xl font-semibold text-neutral-900 tabular-nums">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

interface WeakProps {
  weak: GrammarPointBucket[];
  onOpenChapter: (chapter: number) => void;
}

function WeakPoints({ weak, onOpenChapter }: WeakProps) {
  return (
    <section>
      <SectionHeader
        title="Weakest grammar points"
        subtitle="Lowest accuracy with at least 2 attempts"
      />
      {weak.length === 0 ? (
        <div className="p-5 rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-400">
          Not enough data yet — keep answering questions.
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {weak.map((w) => {
            const pct = Math.round(w.accuracy * 100);
            const tone =
              w.accuracy < 0.4
                ? "bg-rose-500"
                : w.accuracy < 0.7
                  ? "bg-amber-500"
                  : "bg-emerald-500";
            return (
              <div key={w.key} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="font-jp text-base text-neutral-900 truncate">
                    {w.label}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {w.chapter !== null && (
                      <span>Chapter {w.chapter} · </span>
                    )}
                    {w.correct}/{w.total} correct
                  </div>
                </div>
                <div className="w-20 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-10 text-right text-sm tabular-nums text-neutral-700">
                  {pct}%
                </div>
                {w.chapter !== null && (
                  <button
                    onClick={() => onOpenChapter(w.chapter!)}
                    className="shrink-0 flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 underline-offset-4 hover:underline"
                  >
                    <Target size={12} />
                    Study
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ChapterHeatmapProps {
  stats: ReturnType<typeof aggregate>;
  onOpenChapter: (chapter: number) => void;
}

const ALL_CHAPTERS = Array.from({ length: 25 }, (_, i) => 26 + i);

function ChapterHeatmap({ stats, onOpenChapter }: ChapterHeatmapProps) {
  const map = new Map(stats.byChapter.map((c) => [c.chapter, c]));
  return (
    <section>
      <SectionHeader title="Chapter accuracy" subtitle="Click a cell to study" />
      <div className="p-5 rounded-2xl border border-neutral-200 bg-white">
        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
          {ALL_CHAPTERS.map((ch) => {
            const bucket = map.get(ch);
            const empty = !bucket || bucket.total === 0;
            const pct = bucket ? Math.round(bucket.accuracy * 100) : 0;
            const bg = empty
              ? "bg-neutral-100 text-neutral-400"
              : bucket!.accuracy < 0.4
                ? "bg-rose-100 text-rose-900 hover:bg-rose-200"
                : bucket!.accuracy < 0.7
                  ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                  : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200";
            return (
              <button
                key={ch}
                onClick={() => !empty && onOpenChapter(ch)}
                disabled={empty}
                className={`relative rounded-lg px-2 py-3 text-center transition-colors ${bg} ${
                  empty ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                title={
                  empty
                    ? `Chapter ${ch} — no attempts`
                    : `Chapter ${ch} — ${bucket!.correct}/${bucket!.total} = ${pct}%`
                }
              >
                <div className="text-[10px] uppercase tracking-wider opacity-70">
                  ch{ch}
                </div>
                <div className="text-sm font-semibold tabular-nums mt-0.5">
                  {empty ? "—" : `${pct}%`}
                </div>
                {!empty && (
                  <div className="text-[10px] opacity-60 mt-0.5">
                    {bucket!.total}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-4 text-[10px] text-neutral-400">
          <span>Lower</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-100" />
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-100" />
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100" />
          <span>Higher</span>
          <span className="ml-auto">Only questions mapped to a chapter count here.</span>
        </div>
      </div>
    </section>
  );
}

function AllGrammarTable({ buckets }: { buckets: GrammarPointBucket[] }) {
  const [sort, setSort] = useState<"accuracy" | "attempts">("accuracy");
  const sorted = useMemo(() => {
    const copy = [...buckets];
    if (sort === "accuracy") copy.sort((a, b) => a.accuracy - b.accuracy);
    else copy.sort((a, b) => b.total - a.total);
    return copy;
  }, [buckets, sort]);

  if (buckets.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-xs uppercase tracking-wider text-neutral-400">
          All grammar points
        </h2>
        <div className="ml-auto flex gap-1 text-xs">
          <button
            onClick={() => setSort("accuracy")}
            className={`px-2 py-0.5 rounded ${
              sort === "accuracy"
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            By accuracy
          </button>
          <button
            onClick={() => setSort("attempts")}
            className={`px-2 py-0.5 rounded ${
              sort === "attempts"
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            By attempts
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {sorted.map((b) => {
          const pct = Math.round(b.accuracy * 100);
          const dot =
            b.accuracy < 0.4
              ? "bg-rose-400"
              : b.accuracy < 0.7
                ? "bg-amber-400"
                : "bg-emerald-500";
          return (
            <div
              key={b.key}
              className="flex items-center gap-3 px-5 py-3 text-sm"
            >
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="font-jp text-neutral-900 truncate flex-1">
                {b.label}
              </span>
              {b.chapter !== null && (
                <span className="text-xs text-neutral-400 shrink-0">
                  ch{b.chapter}
                </span>
              )}
              <span className="text-xs text-neutral-500 tabular-nums w-12 text-right">
                {b.correct}/{b.total}
              </span>
              <span className="text-sm text-neutral-700 tabular-nums w-10 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-xs uppercase tracking-wider text-neutral-400">
        {title}
      </h2>
      {subtitle && <span className="text-xs text-neutral-300">{subtitle}</span>}
    </div>
  );
}
