import { useState } from "react";
import { ArrowLeft, BarChart3, Check, RotateCcw, X } from "lucide-react";
import {
  getAllMockQuestions,
  type MockQuestion,
} from "../data/mockExamData";
import { appendMockAttempt } from "../mockStats/storage";
import { pushMockAttempt } from "../srs/sync";
import {
  aggregate,
  weakest,
  type GrammarPointBucket,
} from "../mockStats/aggregate";

interface Props {
  onExit: () => void;
  onViewStats: () => void;
}

interface SessionAttempt {
  question: MockQuestion;
  correct: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type View = {
  kind: "quiz";
  queue: MockQuestion[];
  index: number;
  correct: number;
  picked: number | null;
  session: SessionAttempt[];
};

function freshQuiz(): View {
  return {
    kind: "quiz",
    queue: shuffle(getAllMockQuestions()),
    index: 0,
    correct: 0,
    picked: null,
    session: [],
  };
}

export function MockExamSession({ onExit, onViewStats }: Props) {
  const [view, setView] = useState<View>(() => freshQuiz());

  const start = () => setView(freshQuiz());

  const q = view.queue[view.index];
  const total = view.queue.length;
  const isLast = view.index === total - 1;
  const answered = view.picked !== null;

  const pick = (choice: number) => {
    if (answered) return;
    const correct = choice === q.answer;
    const entry = {
      questionId: q.id,
      correct,
      at: new Date().toISOString(),
    };
    appendMockAttempt(entry);
    void pushMockAttempt(entry);
    setView({
      ...view,
      picked: choice,
      correct: view.correct + (correct ? 1 : 0),
      session: [...view.session, { question: q, correct }],
    });
  };

  const next = () => {
    if (isLast) {
      setView({ ...view, index: total });
      return;
    }
    setView({ ...view, index: view.index + 1, picked: null });
  };

  if (view.index >= total) {
    return (
      <ResultScreen
        total={total}
        correct={view.correct}
        session={view.session}
        onRestart={start}
        onExit={onExit}
        onViewStats={onViewStats}
      />
    );
  }

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
          {view.index + 1} / {total}
        </div>
      </div>

      <div className="flex-1 flex items-center px-6 py-12">
        <QuestionCard
          question={q}
          picked={view.picked}
          onPick={pick}
          onNext={next}
          isLast={isLast}
        />
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: MockQuestion;
  picked: number | null;
  onPick: (i: number) => void;
  onNext: () => void;
  isLast: boolean;
}

function QuestionCard({ question, picked, onPick, onNext, isLast }: QuestionCardProps) {
  const answered = picked !== null;
  const isCorrect = picked === question.answer;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 sm:p-10">
        {(question.chapter !== undefined || question.grammarPoint) && (
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-4">
            {question.chapter !== undefined && `Chapter ${question.chapter}`}
            {question.chapter !== undefined && question.grammarPoint && " · "}
            {question.grammarPoint}
          </div>
        )}
        {question.chapter === undefined && question.sourceSlug && (
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-4">
            minnanihongo.com · exercise {question.sourceSlug}
          </div>
        )}

        <p className="font-jp text-2xl sm:text-3xl text-neutral-900 leading-relaxed mb-8">
          {question.question}
        </p>

        <div className="space-y-2">
          {question.choices.map((choice, i) => {
            const isPicked = picked === i;
            const isAnswer = i === question.answer;
            let tone =
              "border-neutral-200 hover:border-neutral-400 bg-white text-neutral-900";
            if (answered) {
              if (isAnswer) {
                tone = "border-emerald-300 bg-emerald-50 text-emerald-900";
              } else if (isPicked) {
                tone = "border-rose-300 bg-rose-50 text-rose-900";
              } else {
                tone = "border-neutral-200 bg-white text-neutral-400";
              }
            }
            return (
              <button
                key={i}
                onClick={() => onPick(i)}
                disabled={answered}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors flex items-center gap-3 ${tone} ${
                  !answered ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span className="font-jp text-lg flex-1">{choice}</span>
                {answered && isAnswer && (
                  <Check size={18} className="text-emerald-600 shrink-0" />
                )}
                {answered && isPicked && !isAnswer && (
                  <X size={18} className="text-rose-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 pt-6 border-t border-neutral-100">
            <div
              className={`text-sm font-semibold mb-2 ${
                isCorrect ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {isCorrect ? "Correct" : "Not quite"}
            </div>
            {question.explanation ? (
              <p className="text-sm text-neutral-600 leading-relaxed">
                {question.explanation}
              </p>
            ) : (
              <p className="text-sm text-neutral-500 leading-relaxed">
                Correct answer:{" "}
                <span className="font-jp text-neutral-800">
                  {question.choices[question.answer]}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {answered && (
        <button
          onClick={onNext}
          className="w-full mt-6 py-4 rounded-xl bg-neutral-900 text-white text-base font-medium hover:bg-neutral-800 transition-colors"
        >
          {isLast ? "See results" : "Next question"}
        </button>
      )}
    </div>
  );
}

interface ResultProps {
  total: number;
  correct: number;
  session: SessionAttempt[];
  onRestart: () => void;
  onExit: () => void;
  onViewStats: () => void;
}

function ResultScreen({
  total,
  correct,
  session,
  onRestart,
  onExit,
  onViewStats,
}: ResultProps) {
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= 60;

  const sessionWeak = computeSessionWeak(session);

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider text-neutral-400 mb-3">
          Results
        </div>
        <div className="text-6xl font-semibold text-neutral-900 mb-2">
          {correct}
          <span className="text-neutral-300">/{total}</span>
        </div>
        <div
          className={`text-lg mb-6 ${
            passed ? "text-emerald-700" : "text-neutral-500"
          }`}
        >
          {pct}% · {passed ? "Above JLPT pass line" : "Keep practicing"}
        </div>
        <p className="text-sm text-neutral-500 mb-10 leading-relaxed">
          JLPT N4 passing is 90/180 overall. Grammar sits inside the
          language-knowledge section, so treat this as a rough indicator rather
          than a true pass/fail.
        </p>
      </div>

      {sessionWeak.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 mb-10">
          <div className="text-xs uppercase tracking-wider text-neutral-400 mb-3">
            Weakest in this session
          </div>
          <ul className="space-y-2">
            {sessionWeak.map((w) => {
              const wpct = Math.round(w.accuracy * 100);
              return (
                <li
                  key={w.key}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="font-jp text-neutral-900 flex-1 truncate">
                    {w.label}
                  </span>
                  {w.chapter !== null && (
                    <span className="text-xs text-neutral-400">
                      ch{w.chapter}
                    </span>
                  )}
                  <span className="text-xs text-neutral-500 tabular-nums w-10 text-right">
                    {w.correct}/{w.total}
                  </span>
                  <span className="text-sm text-rose-600 tabular-nums w-10 text-right">
                    {wpct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 transition-colors"
        >
          <RotateCcw size={16} />
          Try again
        </button>
        <button
          onClick={onViewStats}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 transition-colors"
        >
          <BarChart3 size={16} />
          View all-time analytics
        </button>
        <button
          onClick={onExit}
          className="px-5 py-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function computeSessionWeak(session: SessionAttempt[]): GrammarPointBucket[] {
  if (session.length === 0) return [];
  const attempts = session.map((s, i) => ({
    questionId: s.question.id,
    correct: s.correct,
    at: `${i}`,
  }));
  const questions = session.map((s) => s.question);
  return weakest(aggregate(attempts, questions), {
    minAttempts: 1,
    limit: 5,
  }).filter((w) => w.accuracy < 1);
}
