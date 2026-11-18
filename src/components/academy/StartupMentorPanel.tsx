import React, { useEffect, useState } from "react";
import {
  Sparkles,
  BookOpen,
  Code2,
  Compass,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  WifiOff,
  Award,
} from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import type {
  AcademyLesson,
  AcademyTrack,
  MemoryItem,
} from "../../types/studio";

interface StartupMentorPanelProps {
  lessons: AcademyLesson[];
  memories: MemoryItem[];
  userRoles?: string[];
  isOnline: boolean;
  onAddLesson: (lesson: AcademyLesson) => void;
  onCompleteLessonQuiz: (lessonId: string, score: number, xpEarned: number) => void;
  onDeleteLesson: (lessonId: string) => void;
}

const LESSON_PROGRESS_STEPS = [
  "Reading Memory Vault...",
  "Tailoring to your active roles...",
  "Drafting lesson sections...",
  "Crafting interactive quiz...",
];

const TRACKS: Array<{
  id: AcademyTrack;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "Micro-Lesson",
    label: "Micro-Lesson",
    desc: "5-min creator & growth framework",
    icon: BookOpen,
  },
  {
    id: "Startup Scenario",
    label: "Startup Scenario",
    desc: "Pricing, pitching & founder tradeoffs",
    icon: Compass,
  },
  {
    id: "Tech & Coding Drill",
    label: "Tech & Coding Drill",
    desc: "Architecture, APIs & TypeScript patterns",
    icon: Code2,
  },
];

export const StartupMentorPanel: React.FC<StartupMentorPanelProps> = ({
  lessons,
  memories,
  userRoles = [],
  isOnline,
  onAddLesson,
  onCompleteLessonQuiz,
  onDeleteLesson,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<AcademyTrack>("Micro-Lesson");
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string>(lessons[0]?.id ?? "");

  // Interactive quiz state for the active lesson
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);
  const [lastEarnedNotice, setLastEarnedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setProgressStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setProgressStep((prev) =>
        prev < LESSON_PROGRESS_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 1250);
    return () => window.clearInterval(timer);
  }, [loading]);

  const activeLesson =
    lessons.find((l) => l.id === activeLessonId) ?? lessons[0] ?? null;

  const handleSelectLesson = (id: string) => {
    setActiveLessonId(id);
    setSelectedAnswers({});
    setSubmittedQuiz(false);
    setLastEarnedNotice(null);
  };

  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline || loading) return;

    setLoading(true);
    setError(null);
    setLastEarnedNotice(null);

    try {
      const resp = await fetch("/api/academy/generate-lesson", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({
          track: selectedTrack,
          customTopic: customTopic.trim(),
          memories,
          userRoles,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not generate lesson.");
      }

      const newLesson: AcademyLesson = {
        id: `acad-${Date.now()}`,
        title: String(data.title || "Tailored 5-Minute Lesson"),
        track: selectedTrack,
        estimatedMinutes: Number(data.estimatedMinutes || 5),
        tailoredReason: String(
          data.tailoredReason || "Tailored to your Companion Memory Vault."
        ),
        sections: Array.isArray(data.sections) ? data.sections : [],
        quiz: Array.isArray(data.quiz) ? data.quiz : [],
        xpReward: Number(data.xpReward || 60),
        createdAt: new Date().toISOString(),
      };

      onAddLesson(newLesson);
      setActiveLessonId(newLesson.id);
      setSelectedAnswers({});
      setSubmittedQuiz(false);
      setCustomTopic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate lesson.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuiz = () => {
    if (!activeLesson || activeLesson.quiz.length === 0) return;
    const total = activeLesson.quiz.length;
    const correctCount = activeLesson.quiz.reduce(
      (acc, q) => acc + (selectedAnswers[q.id] === q.correctIndex ? 1 : 0),
      0
    );
    const scorePct = Math.round((correctCount / total) * 100);
    const alreadyCompleted = Boolean(activeLesson.completedAt);
    const xpEarned = alreadyCompleted
      ? Math.max(10, Math.round(activeLesson.xpReward * 0.25))
      : Math.max(15, Math.round((scorePct / 100) * activeLesson.xpReward));

    setSubmittedQuiz(true);
    onCompleteLessonQuiz(activeLesson.id, scorePct, xpEarned);
    setLastEarnedNotice(
      `Scored ${correctCount}/${total} (${scorePct}%) · +${xpEarned} XP added!`
    );
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setSubmittedQuiz(false);
    setLastEarnedNotice(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Generator + Cached Offline Library */}
      <div className="lg:col-span-5 space-y-5">
        <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Context-Aware Lesson Generator
              </h3>
              <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                Reads your {memories.length} Memory Vault facts to personalize drills
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#6366F1] font-semibold">
              gemini-3.8-flash
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
            {TRACKS.map((track) => {
              const Icon = track.icon;
              const active = selectedTrack === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setSelectedTrack(track.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-[#6366F1] bg-[#6366F1]/10"
                      : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] hover:border-[#6366F1]/50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? "bg-[#6366F1] text-white"
                        : "bg-[#FFFFFF] dark:bg-[#22201D] text-[#6366F1]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                      {track.label}
                    </p>
                    <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] truncate">
                      {track.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleGenerateLesson} className="space-y-3">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Optional topic (e.g. 'Sponsor pricing tiers' or 'Service Worker caching')"
              className="h-10 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#6366F1] focus:outline-none"
            />

            {!isOnline && (
              <div className="flex items-center gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#92400E] dark:text-[#FCD34D]">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Offline mode: Generating new AI lessons requires internet. Cached lessons below work 100% offline.
                </span>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F87171]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!isOnline || loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-4 text-xs sm:text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {LESSON_PROGRESS_STEPS[progressStep]}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Tailored {selectedTrack}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Cached Lessons Library (100% Offline Review & Retake) */}
        <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Cached Offline Lessons ({lessons.length})
            </h3>
            <span className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
              Saved locally
            </span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {lessons.map((lesson) => {
              const isSelected = activeLesson?.id === lesson.id;
              return (
                <div
                  key={lesson.id}
                  className={`group flex items-start justify-between gap-2 rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? "border-[#6366F1] bg-[#6366F1]/8"
                      : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] hover:border-[#6366F1]/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectLesson(lesson.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-[#6366F1] font-semibold">
                      <span>{lesson.track}</span>
                      <span>·</span>
                      <span className="tabular-nums">{lesson.estimatedMinutes} min</span>
                      {typeof lesson.bestScore === "number" && (
                        <>
                          <span>·</span>
                          <span className="text-[#10B981] tabular-nums">
                            Best {lesson.bestScore}%
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#1E1E1E] dark:text-[#F5F2EC] line-clamp-2">
                      {lesson.title}
                    </p>
                  </button>

                  {lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteLesson(lesson.id)}
                      aria-label={`Delete lesson ${lesson.title}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626] opacity-70 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Active Lesson Reader + Interactive Quiz */}
      <div className="lg:col-span-7">
        {activeLesson ? (
          <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 space-y-6">
            <div className="border-b border-[#E8E2D8] dark:border-[#322E29] pb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#6366F1]/12 px-2.5 py-1 text-xs font-semibold text-[#6366F1]">
                  {activeLesson.track} · {activeLesson.estimatedMinutes} min
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6366F1] tabular-nums">
                  <Award className="h-3.5 w-3.5" />+{activeLesson.xpReward} XP
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                {activeLesson.title}
              </h3>

              <p className="text-xs text-[#5C5750] dark:text-[#A69F96]">
                {activeLesson.tailoredReason}
              </p>
            </div>

            {/* Lesson Sections */}
            <div className="space-y-4">
              {activeLesson.sections.map((sec, idx) => (
                <div
                  key={`${activeLesson.id}-sec-${idx}`}
                  className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-4 space-y-1.5"
                >
                  <h4 className="text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    {sec.heading}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#4A453E] dark:text-[#C5BEB3] leading-relaxed">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Interactive Quiz */}
            {activeLesson.quiz.length > 0 && (
              <div className="border-t border-[#E8E2D8] dark:border-[#322E29] pt-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    Knowledge Check ({activeLesson.quiz.length} Questions)
                  </h4>
                  {submittedQuiz && (
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 py-1.5 text-xs font-semibold text-[#6366F1] hover:bg-[#6366F1]/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retake Quiz
                    </button>
                  )}
                </div>

                {lastEarnedNotice && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#10B981]/40 bg-[#10B981]/12 px-3.5 py-2.5 text-xs font-semibold text-[#065F46] dark:text-[#A7F3D0]">
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                    {lastEarnedNotice}
                  </div>
                )}

                <div className="space-y-4">
                  {activeLesson.quiz.map((q, qIdx) => {
                    const chosen = selectedAnswers[q.id];
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] p-4 space-y-2.5"
                      >
                        <p className="text-xs sm:text-sm font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                          {qIdx + 1}. {q.question}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oIdx) => {
                            const isPicked = chosen === oIdx;
                            const isCorrect = oIdx === q.correctIndex;

                            let optionStyle =
                              "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]";
                            if (submittedQuiz) {
                              if (isCorrect) {
                                optionStyle =
                                  "border-[#10B981] bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0]";
                              } else if (isPicked) {
                                optionStyle =
                                  "border-[#DC2626] bg-[#DC2626]/10 text-[#991B1B] dark:text-[#FCA5A5]";
                              }
                            } else if (isPicked) {
                              optionStyle =
                                "border-[#6366F1] bg-[#6366F1]/12 text-[#3730A3] dark:text-[#C7D2FE]";
                            }

                            return (
                              <button
                                key={`${q.id}-opt-${oIdx}`}
                                type="button"
                                disabled={submittedQuiz}
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: oIdx,
                                  }))
                                }
                                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${optionStyle}`}
                              >
                                <span>{opt}</span>
                                {submittedQuiz && isCorrect && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                                )}
                                {submittedQuiz && !isCorrect && isPicked && (
                                  <XCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {submittedQuiz && q.explanation && (
                          <p className="pt-1 text-xs text-[#5C5750] dark:text-[#A69F96]">
                            <strong className="text-[#1E1E1E] dark:text-[#F5F2EC]">
                              Why:
                            </strong>{" "}
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!submittedQuiz && (
                  <button
                    type="button"
                    disabled={
                      Object.keys(selectedAnswers).length < activeLesson.quiz.length
                    }
                    onClick={handleSubmitQuiz}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#6366F1] px-5 text-xs sm:text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-50 transition-colors"
                  >
                    Submit Quiz &amp; Claim XP
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-10 text-center text-sm text-[#6E685F]">
            Generate your first tailored lesson to start earning XP.
          </div>
        )}
      </div>
    </div>
  );
};
