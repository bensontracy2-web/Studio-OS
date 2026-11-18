import React, { useState } from "react";
import {
  Sparkles,
  Brain,
  GraduationCap,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Trophy,
} from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import type {
  AcademyLesson,
  BrainNote,
  CachedQuiz,
  GameRoomState,
} from "../../types/studio";

interface AiQuizArenaGameProps {
  quizState: GameRoomState["quiz"];
  notes: BrainNote[];
  lessons: AcademyLesson[];
  isOnline: boolean;
  onUpdateQuizState: (next: GameRoomState["quiz"]) => void;
}

export const AiQuizArenaGame: React.FC<AiQuizArenaGameProps> = ({
  quizState,
  notes,
  lessons,
  isOnline,
  onUpdateQuizState,
}) => {
  const [sourceType, setSourceType] = useState<"brain" | "academy">("brain");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string>(
    quizState.cachedQuizzes[0]?.id ?? ""
  );

  // Active gameplay state
  const [qIdx, setQIdx] = useState(0);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [runScore, setRunScore] = useState(0);
  const [finishedRun, setFinishedRun] = useState(false);

  const activeQuiz: CachedQuiz | undefined =
    quizState.cachedQuizzes.find((q) => q.id === activeQuizId) ??
    quizState.cachedQuizzes[0];

  const resetRun = (quizId: string) => {
    setActiveQuizId(quizId);
    setQIdx(0);
    setPickedIdx(null);
    setRunScore(0);
    setFinishedRun(false);
  };

  const handleGenerateLocalOfflineQuiz = () => {
    const academyQuestions = lessons.flatMap((l) => l.quiz);
    const noteQuestions = notes.slice(0, 3).map((n, i) => ({
      id: `gq-loc-${Date.now()}-${i}`,
      question: `Which workspace category & insight fits your note "${n.title}"?`,
      options: [
        `${n.tag} — ${n.summary.slice(0, 85)}`,
        "Unrelated personal grocery checklist",
        "Archived calendar event from 2019",
      ],
      correctIndex: 0,
      explanation: `Captured under ${n.tag} for ${n.suggestedPlatform}.`,
    }));

    const pool =
      sourceType === "academy" && academyQuestions.length > 0
        ? academyQuestions.slice(0, 5)
        : noteQuestions.length > 0
        ? noteQuestions
        : academyQuestions.slice(0, 5);

    if (pool.length === 0) return;

    const newQuiz: CachedQuiz = {
      id: `quiz-loc-${Date.now()}`,
      title:
        sourceType === "academy"
          ? "Offline Academy Drill Mix"
          : "Offline Second Brain Recall",
      sourceLabel: "Built Locally Offline",
      questions: pool,
      createdAt: new Date().toISOString(),
    };

    onUpdateQuizState({
      ...quizState,
      cachedQuizzes: [newQuiz, ...quizState.cachedQuizzes].slice(0, 10),
    });
    resetRun(newQuiz.id);
  };

  const handleGenerateAiQuiz = async () => {
    if (!isOnline) {
      handleGenerateLocalOfflineQuiz();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/gameroom/generate-quiz", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({
          sourceType,
          notes,
          lessons,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not generate quiz.");
      }

      const newQuiz: CachedQuiz = {
        id: `quiz-ai-${Date.now()}`,
        title: String(data.title || "AI Knowledge Arena"),
        sourceLabel:
          sourceType === "brain"
            ? "Generated from Second Brain"
            : "Generated from Academy",
        questions: Array.isArray(data.questions) ? data.questions : [],
        createdAt: new Date().toISOString(),
      };

      if (newQuiz.questions.length === 0) {
        throw new Error("Quiz returned no questions.");
      }

      onUpdateQuizState({
        ...quizState,
        cachedQuizzes: [newQuiz, ...quizState.cachedQuizzes].slice(0, 10),
      });
      resetRun(newQuiz.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build AI quiz.");
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = activeQuiz?.questions[qIdx];

  const handlePickOption = (idx: number) => {
    if (pickedIdx !== null || !currentQuestion) return;
    setPickedIdx(idx);
    const isCorrect = idx === currentQuestion.correctIndex;
    const nextScore = isCorrect ? runScore + 25 : runScore;
    if (isCorrect) setRunScore(nextScore);

    onUpdateQuizState({
      ...quizState,
      totalAnswered: quizState.totalAnswered + 1,
      totalCorrect: quizState.totalCorrect + (isCorrect ? 1 : 0),
      highScore: Math.max(quizState.highScore, nextScore),
    });
  };

  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    if (qIdx + 1 >= activeQuiz.questions.length) {
      setFinishedRun(true);
    } else {
      setQIdx((i) => i + 1);
      setPickedIdx(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Generator & Cached Offline Decks */}
      <div className="lg:col-span-5 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              AI Quiz Arena
            </h3>
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
              Cached locally so every deck plays 100% offline
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#A855F7] tabular-nums">
            <Trophy className="h-3.5 w-3.5" />
            Best {quizState.highScore}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSourceType("brain")}
            className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold ${
              sourceType === "brain"
                ? "border-[#22C55E] bg-[#22C55E]/12 text-[#15803D] dark:text-[#86EFAC]"
                : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513]"
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            Second Brain
          </button>
          <button
            type="button"
            onClick={() => setSourceType("academy")}
            className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold ${
              sourceType === "academy"
                ? "border-[#A855F7] bg-[#A855F7]/12 text-[#7E22CE] dark:text-[#D8B4FE]"
                : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513]"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Academy Lessons
          </button>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void handleGenerateAiQuiz()}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#A855F7] px-4 text-xs sm:text-sm font-semibold text-white hover:bg-[#9333EA] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isOnline ? "Generate Fresh AI Quiz" : "Build Offline Recall Quiz"}
        </button>

        {error && (
          <p className="rounded-lg bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626]">
            {error}
          </p>
        )}

        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-[#6E685F] dark:text-[#9A9389]">
            Cached Quiz Decks ({quizState.cachedQuizzes.length})
          </p>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {quizState.cachedQuizzes.map((qz) => (
              <button
                key={qz.id}
                type="button"
                onClick={() => resetRun(qz.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  activeQuiz?.id === qz.id
                    ? "border-[#22C55E] bg-[#22C55E]/10"
                    : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] hover:border-[#A855F7]/50"
                }`}
              >
                <p className="text-xs font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  {qz.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6E685F] dark:text-[#9A9389]">
                  {qz.sourceLabel} · {qz.questions.length} questions
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Interactive Quiz Arena */}
      <div className="lg:col-span-7 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6">
        {!activeQuiz ? (
          <p className="text-sm text-[#6E685F]">Generate a quiz deck to start playing.</p>
        ) : finishedRun ? (
          <div className="py-8 text-center space-y-4">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#22C55E]/15 text-[#22C55E]">
              <Trophy className="h-7 w-7" />
            </span>
            <div>
              <h4 className="font-display text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Round Complete!
              </h4>
              <p className="mt-1 text-sm text-[#5C5750] dark:text-[#A69F96] tabular-nums">
                Score: <strong className="text-[#22C55E]">{runScore} pts</strong> · All-Time High:{" "}
                <strong className="text-[#A855F7]">{quizState.highScore} pts</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => resetRun(activeQuiz.id)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#22C55E] px-5 text-xs font-semibold text-white hover:bg-[#16A34A]"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2D8] dark:border-[#322E29] pb-3">
              <div>
                <p className="text-xs font-semibold text-[#A855F7]">
                  {activeQuiz.title}
                </p>
                <p className="text-[11px] text-[#6E685F] tabular-nums">
                  Question {qIdx + 1} of {activeQuiz.questions.length}
                </p>
              </div>
              <span className="rounded-lg bg-[#22C55E]/12 px-2.5 py-1 text-xs font-bold text-[#15803D] dark:text-[#86EFAC] tabular-nums">
                Score: {runScore}
              </span>
            </div>

            <h4 className="font-display text-base sm:text-lg font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              {currentQuestion.question}
            </h4>

            <div className="space-y-2">
              {currentQuestion.options.map((opt, idx) => {
                const answered = pickedIdx !== null;
                const isCorrect = idx === currentQuestion.correctIndex;
                const isPicked = pickedIdx === idx;

                let cls =
                  "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] hover:border-[#A855F7]";
                if (answered) {
                  if (isCorrect) {
                    cls =
                      "border-[#22C55E] bg-[#22C55E]/15 text-[#15803D] dark:text-[#86EFAC]";
                  } else if (isPicked) {
                    cls =
                      "border-[#DC2626] bg-[#DC2626]/12 text-[#991B1B] dark:text-[#FCA5A5]";
                  }
                }

                return (
                  <button
                    key={`${currentQuestion.id}-${idx}`}
                    type="button"
                    disabled={answered}
                    onClick={() => handlePickOption(idx)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-xs sm:text-sm font-medium transition-colors ${cls}`}
                  >
                    <span>{opt}</span>
                    {answered && isCorrect && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" />
                    )}
                    {answered && !isCorrect && isPicked && (
                      <XCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                    )}
                  </button>
                );
              })}
            </div>

            {pickedIdx !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAF7F2] dark:bg-[#161513] p-3.5">
                <p className="text-xs text-[#5C5750] dark:text-[#A69F96] flex-1">
                  {currentQuestion.explanation}
                </p>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="h-9 rounded-xl bg-[#22C55E] px-4 text-xs font-semibold text-white hover:bg-[#16A34A] shrink-0"
                >
                  {qIdx + 1 >= activeQuiz.questions.length ? "Finish Round" : "Next Question"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
