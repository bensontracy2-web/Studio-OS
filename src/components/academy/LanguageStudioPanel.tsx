import React, { useState } from "react";
import {
  Volume2,
  Square,
  RotateCw,
  CheckCircle2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  WifiOff,
  Heart,
  Flame,
  Zap,
  Play,
  RefreshCw,
  Sparkles,
  Check,
} from "lucide-react";
import { speakBestieReply, stopActiveVoice } from "../../lib/voiceReply";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import {
  LANGUAGE_UNITS,
  buildOfflineStarterLesson,
  getLessonMeta,
} from "../../data/languageCurriculum";
import { GuidedLessonPlayer } from "./GuidedLessonPlayer";
import type {
  GuidedLanguageLesson,
  LanguageFlashcard,
  LanguageProgressState,
  TargetLanguage,
} from "../../types/studio";

interface LanguageStudioPanelProps {
  xp: number;
  selectedLanguage: TargetLanguage;
  flashcards: LanguageFlashcard[];
  languageProgress: LanguageProgressState;
  userRoles?: string[];
  isOnline: boolean;
  onChangeLanguage: (lang: TargetLanguage) => void;
  onAddFlashcard: (card: LanguageFlashcard) => void;
  onToggleMastered: (id: string, xpGain: number) => void;
  onLoseHeart: () => void;
  onRefillHearts: () => void;
  onCacheGuidedLesson: (lessonKey: string, lesson: GuidedLanguageLesson) => void;
  onRecordLessonComplete: (lessonKey: string, totalXpEarned: number) => void;
}

const LANGUAGES: TargetLanguage[] = [
  "Spanish",
  "French",
  "Yoruba",
  "Japanese",
  "Portuguese",
  "German",
];

export const LanguageStudioPanel: React.FC<LanguageStudioPanelProps> = ({
  xp,
  selectedLanguage,
  flashcards,
  languageProgress,
  userRoles = [],
  isOnline,
  onChangeLanguage,
  onAddFlashcard,
  onToggleMastered,
  onLoseHeart,
  onRefillHearts,
  onCacheGuidedLesson,
  onRecordLessonComplete,
}) => {
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("all");
  const [activeLessonSession, setActiveLessonSession] = useState<{
    lessonKey: string;
    lesson: GuidedLanguageLesson;
  } | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Flashcard deck state
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newPhonetic, setNewPhonetic] = useState("");

  const langCards = flashcards.filter((f) => f.language === selectedLanguage);
  const visibleCards = langCards.length > 0 ? langCards : flashcards;
  const activeCard = visibleCards[cardIndex % Math.max(1, visibleCards.length)];

  const totalLessonsCount = LANGUAGE_UNITS.reduce(
    (acc, unit) => acc + unit.lessons.length,
    0
  );
  const completedForLanguage = LANGUAGE_UNITS.flatMap((u) => u.lessons).filter((node) =>
    languageProgress.completedLessonKeys.includes(`${selectedLanguage}::${node.id}`)
  ).length;
  const pathProgressPct = Math.round(
    (completedForLanguage / Math.max(1, totalLessonsCount)) * 100
  );

  // Identify the next uncompleted lesson in the path
  const nextUpLessonId =
    LANGUAGE_UNITS.flatMap((u) => u.lessons).find(
      (node) =>
        !languageProgress.completedLessonKeys.includes(`${selectedLanguage}::${node.id}`)
    )?.id ?? LANGUAGE_UNITS[0].lessons[0].id;

  const visibleUnits =
    selectedUnitFilter === "all"
      ? LANGUAGE_UNITS
      : LANGUAGE_UNITS.filter((u) => u.id === selectedUnitFilter);

  const handleSpeak = async (id: string, text: string) => {
    if (speakingId === id) {
      stopActiveVoice();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    await speakBestieReply(
      text,
      "bestie",
      () => setSpeakingId(null),
      selectedLanguage
    );
  };

  const handleLaunchLesson = async (
    unitId: string,
    lessonId: string,
    forceFreshAi = false
  ) => {
    const lessonKey = `${selectedLanguage}::${lessonId}`;
    setNotice(null);

    if (languageProgress.hearts === 0) {
      onRefillHearts();
    }

    const cached = languageProgress.cachedLessons[lessonKey];
    if (cached && !forceFreshAi) {
      setActiveLessonSession({ lessonKey, lesson: cached });
      return;
    }

    if (!isOnline) {
      const starter = buildOfflineStarterLesson(selectedLanguage, unitId, lessonId);
      setActiveLessonSession({ lessonKey, lesson: starter });
      setNotice(
        "Loaded offline starter lesson — all audio, quizzes, and word tiles work offline."
      );
      return;
    }

    const { unit, node } = getLessonMeta(unitId, lessonId);
    setGeneratingKey(lessonKey);

    try {
      const resp = await fetch("/api/academy/language-lesson", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({
          language: selectedLanguage,
          unitId: unit.id,
          unitTitle: unit.title,
          lessonTitle: node.title,
          levelLabel: unit.levelLabel,
          userRoles,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.lesson) {
        throw new Error(data.error || "AI lesson generator unavailable");
      }

      const aiLesson = data.lesson as GuidedLanguageLesson;
      onCacheGuidedLesson(lessonKey, aiLesson);
      setActiveLessonSession({ lessonKey, lesson: aiLesson });
    } catch {
      const starter = buildOfflineStarterLesson(selectedLanguage, unitId, lessonId);
      onCacheGuidedLesson(lessonKey, starter);
      setActiveLessonSession({ lessonKey, lesson: starter });
      setNotice(
        "Started with built-in starter lesson (connect or add your Gemini key in Security Settings for fresh AI variations)."
      );
    } finally {
      setGeneratingKey(null);
    }
  };

  const handleSaveVocabToDeck = (v: {
    phrase: string;
    meaning: string;
    phonetic: string;
  }) => {
    const exists = flashcards.some(
      (c) =>
        c.language === selectedLanguage &&
        c.front.toLowerCase() === v.phrase.toLowerCase()
    );
    if (exists) return;
    onAddFlashcard({
      id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      language: selectedLanguage,
      front: v.phrase,
      back: v.meaning,
      phonetic: v.phonetic,
      example: v.phrase,
      mastered: false,
    });
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    onAddFlashcard({
      id: `fc-${Date.now()}`,
      language: selectedLanguage,
      front: newFront.trim(),
      back: newBack.trim(),
      phonetic: newPhonetic.trim() || newFront.trim(),
      example: newFront.trim(),
      mastered: false,
    });
    setNewFront("");
    setNewBack("");
    setNewPhonetic("");
    setShowAddCard(false);
    setCardIndex(0);
    setFlipped(false);
  };

  return (
    <div className="space-y-5">
      {/* Language Selector & Duolingo-Style HUD */}
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  onChangeLanguage(lang);
                  setActiveLessonSession(null);
                  setCardIndex(0);
                  setFlipped(false);
                  setNotice(null);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedLanguage === lang
                    ? "bg-[#6366F1] text-white"
                    : "bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#6E685F] dark:text-[#9A9389]">
            <span>Unit Path:</span>
            <select
              value={selectedUnitFilter}
              onChange={(e) => setSelectedUnitFilter(e.target.value)}
              className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#6366F1] focus:outline-none"
            >
              <option value="all">All Units (1–3)</option>
              {LANGUAGE_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.number}: {u.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Top Progress, 5 Hearts, Streak & XP Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E2D8] dark:border-[#322E29] pt-3">
          <div className="flex flex-1 min-w-[200px] items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29]">
              <div
                className="h-full rounded-full bg-[#10B981] transition-all duration-300"
                style={{ width: `${Math.max(4, pathProgressPct)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] tabular-nums whitespace-nowrap">
              {completedForLanguage} / {totalLessonsCount} lessons
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold tabular-nums">
            <div className="flex items-center gap-1.5" title="Hearts remaining">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: languageProgress.maxHearts }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={`h-4 w-4 ${
                      idx < languageProgress.hearts
                        ? "text-[#DC2626] fill-current"
                        : "text-[#E8E2D8] dark:text-[#322E29]"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[#DC2626]">
                {languageProgress.hearts}/{languageProgress.maxHearts}
              </span>
              {languageProgress.hearts < languageProgress.maxHearts && (
                <button
                  type="button"
                  onClick={onRefillHearts}
                  className="ml-1 rounded-md border border-[#E8E2D8] dark:border-[#322E29] px-1.5 py-0.5 text-[11px] font-semibold text-[#5C5750] dark:text-[#A69F96] hover:border-[#6366F1]"
                >
                  Refill
                </button>
              )}
            </div>

            <span className="inline-flex items-center gap-1 text-[#D97706]">
              <Flame className="h-4 w-4 fill-current" />
              {languageProgress.streakDays}d Streak
            </span>

            <span className="inline-flex items-center gap-1 text-[#6366F1]">
              <Zap className="h-4 w-4 fill-current" />
              {xp} XP
            </span>
          </div>
        </div>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3.5 py-2.5 text-xs text-[#92400E] dark:text-[#FCD34D]">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Offline mode active: Every unit starter lesson, cached AI lesson, audio pronunciation, and your Flashcard Deck work 100% offline.
          </span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-[#6366F1]/35 bg-[#6366F1]/10 px-3.5 py-2.5 text-xs text-[#3730A3] dark:text-[#C7D2FE]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Guided Lesson Path OR Active Interactive Lesson Player */}
        <div className="lg:col-span-7">
          {activeLessonSession ? (
            <GuidedLessonPlayer
              lessonKey={activeLessonSession.lessonKey}
              lesson={activeLessonSession.lesson}
              hearts={languageProgress.hearts}
              maxHearts={languageProgress.maxHearts}
              streakDays={languageProgress.streakDays}
              savedFlashcards={flashcards}
              onLoseHeart={onLoseHeart}
              onRefillHearts={onRefillHearts}
              onSaveFlashcard={handleSaveVocabToDeck}
              onCompleteLesson={(summary) =>
                onRecordLessonComplete(summary.lessonKey, summary.totalXpEarned)
              }
              onExit={() => setActiveLessonSession(null)}
            />
          ) : (
            <div className="space-y-5">
              {visibleUnits.map((unit) => {
                const unitDoneCount = unit.lessons.filter((l) =>
                  languageProgress.completedLessonKeys.includes(`${selectedLanguage}::${l.id}`)
                ).length;

                return (
                  <div
                    key={unit.id}
                    className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E2D8] dark:border-[#322E29] pb-3.5">
                      <div>
                        <p className="text-xs font-semibold text-[#6366F1]">
                          Unit {unit.number} · {unit.levelLabel}
                        </p>
                        <h3 className="mt-0.5 font-display text-lg font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                          {unit.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#5C5750] dark:text-[#A69F96]">
                          {unit.description}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#10B981] tabular-nums whitespace-nowrap">
                        {unitDoneCount} / {unit.lessons.length} complete
                      </span>
                    </div>

                    {/* Bite-Sized Guided Lesson Nodes */}
                    <div className="space-y-3">
                      {unit.lessons.map((node, nodeIdx) => {
                        const lessonKey = `${selectedLanguage}::${node.id}`;
                        const isDone = languageProgress.completedLessonKeys.includes(lessonKey);
                        const isNextUp = node.id === nextUpLessonId;
                        const isGenerating = generatingKey === lessonKey;
                        const hasCachedAi =
                          languageProgress.cachedLessons[lessonKey]?.source === "gemini";

                        return (
                          <div
                            key={node.id}
                            className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isNextUp
                                ? "border-[#6366F1] bg-[#6366F1]/6"
                                : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513]"
                            }`}
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold tabular-nums ${
                                  isDone
                                    ? "bg-[#10B981] text-white"
                                    : isNextUp
                                    ? "bg-[#6366F1] text-white"
                                    : "border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#5C5750] dark:text-[#A69F96]"
                                }`}
                              >
                                {isDone ? <Check className="h-4 w-4" /> : nodeIdx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-display text-sm sm:text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                                    {node.title}
                                  </h4>
                                  {hasCachedAi && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6366F1]">
                                      <Sparkles className="h-3 w-3" />
                                      AI Ready
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#5C5750] dark:text-[#A69F96]">
                                  {node.subtitle}
                                </p>
                                <p className="mt-1 text-[11px] text-[#6E685F] dark:text-[#9A9389] tabular-nums">
                                  {node.estimatedMinutes} min · 7 interactive steps · +{node.xpBonus} XP bonus
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {isOnline && (isDone || hasCachedAi) && (
                                <button
                                  type="button"
                                  disabled={Boolean(generatingKey)}
                                  onClick={() =>
                                    void handleLaunchLesson(unit.id, node.id, true)
                                  }
                                  title="Generate a fresh AI lesson variation"
                                  aria-label={`Generate fresh AI variation for ${node.title}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#5C5750] dark:text-[#A69F96] hover:border-[#6366F1] hover:text-[#6366F1] disabled:opacity-50"
                                >
                                  <RefreshCw
                                    className={`h-3.5 w-3.5 ${
                                      isGenerating ? "animate-spin" : ""
                                    }`}
                                  />
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={Boolean(generatingKey)}
                                onClick={() =>
                                  void handleLaunchLesson(unit.id, node.id, false)
                                }
                                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-60 ${
                                  isDone
                                    ? "border border-[#10B981]/50 bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0] hover:bg-[#10B981]/20"
                                    : "bg-[#6366F1] text-white hover:bg-[#4F46E5]"
                                }`}
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Building Lesson...
                                  </>
                                ) : isDone ? (
                                  <>
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                    Practice Again
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                    Start Lesson
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Offline-Ready Daily Flashcard Deck */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Daily Flashcard Deck
              </h3>
              <p className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
                {langCards.length > 0
                  ? `${langCards.length} ${selectedLanguage} cards · 100% Offline Ready`
                  : `Showing all ${visibleCards.length} cached cards`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCard((v) => !v)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold text-[#6366F1] hover:bg-[#6366F1]/10 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Card
            </button>
          </div>

          {showAddCard && (
            <form
              onSubmit={handleCreateCard}
              className="rounded-xl border border-[#6366F1]/40 bg-[#FAF7F2] dark:bg-[#161513] p-3.5 space-y-2.5"
            >
              <input
                type="text"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder={`${selectedLanguage} phrase`}
                className="h-9 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs focus:border-[#6366F1] focus:outline-none"
              />
              <input
                type="text"
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="English translation"
                className="h-9 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs focus:border-[#6366F1] focus:outline-none"
              />
              <input
                type="text"
                value={newPhonetic}
                onChange={(e) => setNewPhonetic(e.target.value)}
                placeholder="Phonetic pronunciation (optional)"
                className="h-9 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs focus:border-[#6366F1] focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCard(false)}
                  className="h-8 rounded-lg px-3 text-xs text-[#6E685F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 rounded-lg bg-[#6366F1] px-3.5 text-xs font-semibold text-white"
                >
                  Save Card
                </button>
              </div>
            </form>
          )}

          {activeCard ? (
            <>
              <div
                onClick={() => setFlipped((f) => !f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFlipped((f) => !f);
                  }
                }}
                className="min-h-[220px] rounded-2xl border-2 border-[#6366F1]/30 bg-[#FAF7F2] dark:bg-[#161513] p-6 flex flex-col justify-between cursor-pointer select-none hover:border-[#6366F1]/60 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#6366F1]">
                  <span>
                    {activeCard.language} · {flipped ? "Meaning" : "Tap to reveal"}
                  </span>
                  <span className="tabular-nums">
                    {(cardIndex % visibleCards.length) + 1} / {visibleCards.length}
                  </span>
                </div>

                <div className="my-4 text-center space-y-2">
                  {!flipped ? (
                    <>
                      <p className="font-display text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                        {activeCard.front}
                      </p>
                      <p className="text-xs font-mono text-[#6E685F] dark:text-[#9A9389]">
                        /{activeCard.phonetic}/
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-lg font-bold text-[#6366F1]">
                        {activeCard.back}
                      </p>
                      <p className="text-xs text-[#5C5750] dark:text-[#A69F96]">
                        Example: &ldquo;{activeCard.example}&rdquo;
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#6E685F] dark:text-[#9A9389]">
                  <span className="inline-flex items-center gap-1">
                    <RotateCw className="h-3 w-3" />
                    Click card to flip
                  </span>
                  {activeCard.mastered && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#10B981]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mastered
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCardIndex(
                        (i) => (i - 1 + visibleCards.length) % visibleCards.length
                      );
                      setFlipped(false);
                    }}
                    aria-label="Previous flashcard"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E2D8] dark:border-[#322E29] hover:border-[#6366F1]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSpeak(`fc-${activeCard.id}`, activeCard.front)
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-semibold hover:border-[#6366F1] whitespace-nowrap"
                  >
                    {speakingId === `fc-${activeCard.id}` ? (
                      <>
                        <Square className="h-3.5 w-3.5 fill-current text-[#6366F1]" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-[#6366F1]" />
                        Listen
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCardIndex((i) => (i + 1) % visibleCards.length);
                      setFlipped(false);
                    }}
                    aria-label="Next flashcard"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E2D8] dark:border-[#322E29] hover:border-[#6366F1]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onToggleMastered(activeCard.id, activeCard.mastered ? 0 : 10)
                  }
                  className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    activeCard.mastered
                      ? "border border-[#10B981]/50 bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0]"
                      : "bg-[#6366F1] text-white hover:bg-[#4F46E5]"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {activeCard.mastered ? "Mastered" : "Got It (+10 XP)"}
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-8 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
              No flashcards saved yet. Complete a guided lesson or tap <strong>+ Add Card</strong> above to save phrases for offline review!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
