import React, { useState, useMemo, useEffect } from "react";
import {
  Volume2,
  Square,
  CheckCircle2,
  AlertCircle,
  Heart,
  Flame,
  Zap,
  ArrowRight,
  RotateCcw,
  BookmarkPlus,
  Check,
  X,
  Trophy,
  Sparkles,
} from "lucide-react";
import { speakBestieReply, stopActiveVoice } from "../../lib/voiceReply";
import type {
  GuidedLanguageLesson,
  LanguageFlashcard,
  LanguageIntroStep,
} from "../../types/studio";

interface GuidedLessonPlayerProps {
  lessonKey: string;
  lesson: GuidedLanguageLesson;
  hearts: number;
  maxHearts: number;
  streakDays: number;
  savedFlashcards: LanguageFlashcard[];
  onLoseHeart: () => void;
  onRefillHearts: () => void;
  onSaveFlashcard: (card: { phrase: string; meaning: string; phonetic: string }) => void;
  onCompleteLesson: (summary: {
    lessonKey: string;
    totalXpEarned: number;
    accuracyPct: number;
  }) => void;
  onExit: () => void;
}

interface TileChip {
  chipId: string;
  text: string;
}

function deterministicShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export const GuidedLessonPlayer: React.FC<GuidedLessonPlayerProps> = ({
  lessonKey,
  lesson,
  hearts,
  maxHearts,
  streakDays,
  savedFlashcards,
  onLoseHeart,
  onRefillHearts,
  onSaveFlashcard,
  onCompleteLesson,
  onExit,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [correctChecks, setCorrectChecks] = useState(0);
  const [totalChecks, setTotalChecks] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Audio playback tracking
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Step Type B: Multiple Choice
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Step Type C: Tile Builder
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);

  // Step Type D: Match Pairs
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{
    kind: "correct" | "wrong";
    title: string;
    detail: string;
  } | null>(null);
  const [savedAllDone, setSavedAllDone] = useState(false);

  const steps = lesson.steps;
  const activeStep = steps[stepIndex];
  const progressPct = completed
    ? 100
    : Math.round(((stepIndex + (feedback?.kind === "correct" ? 1 : 0)) / Math.max(1, steps.length)) * 100);

  // Reset per-step interaction state cleanly when advancing
  useEffect(() => {
    setSelectedOption(null);
    setSelectedChipIds([]);
    setSelectedLeftId(null);
    setSelectedRightId(null);
    setMatchedPairIds([]);
    setFeedback(null);
    return () => {
      stopActiveVoice();
    };
  }, [stepIndex, lesson.id]);

  // Build deterministic chip pool for active tile-builder step
  const tilePool: TileChip[] = useMemo(() => {
    if (!activeStep || activeStep.type !== "tile-builder") return [];
    const combined = [...activeStep.correctTokens, ...activeStep.distractorTokens].map(
      (text, idx) => ({
        chipId: `${activeStep.id}-chip-${idx}`,
        text,
      })
    );
    return deterministicShuffle(combined, activeStep.id + activeStep.targetPhrase);
  }, [activeStep]);

  // Build deterministic left/right columns for active match-pairs step
  const matchColumns = useMemo(() => {
    if (!activeStep || activeStep.type !== "match-pairs") {
      return { left: [], right: [] };
    }
    const left = activeStep.pairs.map((p) => ({
      id: p.id,
      text: p.target,
      phonetic: p.phonetic,
    }));
    const right = deterministicShuffle(
      activeStep.pairs.map((p) => ({
        id: p.id,
        text: p.english,
      })),
      activeStep.id + "-right"
    );
    return { left, right };
  }, [activeStep]);

  // Collect taught phrases for Celebration Summary
  const taughtIntros = useMemo(
    () => steps.filter((s): s is LanguageIntroStep => s.type === "intro"),
    [steps]
  );

  const handleSpeak = async (id: string, text: string) => {
    if (!text.trim()) return;
    if (speakingId === id) {
      stopActiveVoice();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    await speakBestieReply(text, "bestie", () => setSpeakingId(null), lesson.language);
  };

  const advanceToNextStep = (extraXp = 0) => {
    stopActiveVoice();
    setSpeakingId(null);

    if (stepIndex + 1 >= steps.length) {
      const totalEarned = sessionXp + extraXp + lesson.xpBonus;
      const accuracyPct =
        totalChecks > 0 ? Math.round((correctChecks / totalChecks) * 100) : 100;
      setSessionXp(totalEarned);
      setCompleted(true);
      onCompleteLesson({
        lessonKey,
        totalXpEarned: totalEarned,
        accuracyPct,
      });
    } else {
      setStepIndex((idx) => idx + 1);
    }
  };

  const isPhraseSaved = (phrase: string) =>
    savedFlashcards.some(
      (c) =>
        c.language === lesson.language &&
        c.front.toLowerCase() === phrase.toLowerCase()
    );

  // Check Step Type B (Multiple Choice)
  const handleCheckMultipleChoice = () => {
    if (!activeStep || activeStep.type !== "multiple-choice" || selectedOption === null) return;
    setTotalChecks((c) => c + 1);
    if (selectedOption === activeStep.correctIndex) {
      setCorrectChecks((c) => c + 1);
      setSessionXp((xp) => xp + 15);
      setFeedback({
        kind: "correct",
        title: "Correct! +15 XP",
        detail: activeStep.explanation,
      });
    } else {
      onLoseHeart();
      setFeedback({
        kind: "wrong",
        title: "Try Again",
        detail: activeStep.explanation,
      });
    }
  };

  // Check Step Type C (Tap-the-Word-Tiles)
  const handleCheckTileBuilder = () => {
    if (!activeStep || activeStep.type !== "tile-builder" || selectedChipIds.length === 0) return;
    const builtTokens = selectedChipIds
      .map((cid) => tilePool.find((c) => c.chipId === cid)?.text ?? "")
      .filter(Boolean);

    const normalize = (list: string[]) =>
      list.map((t) => t.trim().toLowerCase()).join(" ");

    setTotalChecks((c) => c + 1);
    if (normalize(builtTokens) === normalize(activeStep.correctTokens)) {
      setCorrectChecks((c) => c + 1);
      setSessionXp((xp) => xp + 15);
      setFeedback({
        kind: "correct",
        title: "Correct! +15 XP",
        detail: activeStep.explanation,
      });
    } else {
      onLoseHeart();
      setFeedback({
        kind: "wrong",
        title: "Try Again",
        detail: activeStep.explanation,
      });
    }
  };

  // Handle Step Type D (Match Pairs) selection
  const handleSelectPairSide = (side: "left" | "right", id: string) => {
    if (!activeStep || activeStep.type !== "match-pairs") return;
    if (matchedPairIds.includes(id)) return;
    if (feedback?.kind === "correct") return;

    const nextLeft = side === "left" ? id : selectedLeftId;
    const nextRight = side === "right" ? id : selectedRightId;

    if (side === "left") {
      setSelectedLeftId(id === selectedLeftId ? null : id);
      const pairObj = activeStep.pairs.find((p) => p.id === id);
      if (pairObj) {
        void handleSpeak(`pair-${id}`, pairObj.target);
      }
    } else {
      setSelectedRightId(id === selectedRightId ? null : id);
    }

    if (nextLeft && nextRight) {
      setTotalChecks((c) => c + 1);
      if (nextLeft === nextRight) {
        const nextMatched = [...matchedPairIds, nextLeft];
        setMatchedPairIds(nextMatched);
        setSelectedLeftId(null);
        setSelectedRightId(null);
        setCorrectChecks((c) => c + 1);

        if (nextMatched.length >= activeStep.pairs.length) {
          setSessionXp((xp) => xp + 15);
          setFeedback({
            kind: "correct",
            title: "Correct! +15 XP",
            detail: activeStep.explanation,
          });
        } else {
          setFeedback(null);
        }
      } else {
        const wrongTarget = activeStep.pairs.find((p) => p.id === nextLeft);
        onLoseHeart();
        setSelectedLeftId(null);
        setSelectedRightId(null);
        setFeedback({
          kind: "wrong",
          title: "Try Again",
          detail: wrongTarget
            ? `"${wrongTarget.target}" means "${wrongTarget.english}". Tap the matching pair to lock it in!`
            : "Not quite a match — give another pair a tap!",
        });
      }
    }
  };

  const handleRetryCurrentStep = () => {
    setFeedback(null);
    if (activeStep?.type === "multiple-choice") {
      setSelectedOption(null);
    } else if (activeStep?.type === "tile-builder") {
      setSelectedChipIds([]);
    }
  };

  if (completed) {
    const accuracyPct =
      totalChecks > 0 ? Math.round((correctChecks / totalChecks) * 100) : 100;

    return (
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981]">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#10B981]">
              {lesson.language} · {lesson.unitTitle}
            </p>
            <h3 className="mt-1 font-display text-2xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Lesson Complete!
            </h3>
            <p className="mt-1 text-sm text-[#5C5750] dark:text-[#A69F96]">
              You completed <strong>{lesson.lessonTitle}</strong> (+{lesson.xpBonus} XP completion bonus).
            </p>
          </div>
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 text-center">
            <p className="text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
              XP Earned
            </p>
            <p className="mt-1 font-display text-xl font-bold text-[#6366F1] tabular-nums">
              +{sessionXp} XP
            </p>
          </div>
          <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 text-center">
            <p className="text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
              Accuracy
            </p>
            <p className="mt-1 font-display text-xl font-bold text-[#10B981] tabular-nums">
              {accuracyPct}%
            </p>
          </div>
          <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 text-center">
            <p className="text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
              Hearts Left
            </p>
            <p className="mt-1 font-display text-xl font-bold text-[#DC2626] tabular-nums">
              {hearts} / {maxHearts} ❤️
            </p>
          </div>
          <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 text-center">
            <p className="text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
              Daily Streak
            </p>
            <p className="mt-1 font-display text-xl font-bold text-[#D97706] tabular-nums">
              {Math.max(1, streakDays)} {Math.max(1, streakDays) === 1 ? "day" : "days"}
            </p>
          </div>
        </div>

        {/* Phrases Learned Recap */}
        {taughtIntros.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-[#5C5750] dark:text-[#A69F96]">
                Phrases Practiced in This Lesson
              </h4>
              <button
                type="button"
                disabled={savedAllDone}
                onClick={() => {
                  taughtIntros.forEach((intro) =>
                    onSaveFlashcard({
                      phrase: intro.phrase,
                      meaning: intro.meaning,
                      phonetic: intro.phonetic,
                    })
                  );
                  setSavedAllDone(true);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-semibold text-[#6366F1] hover:border-[#6366F1] disabled:opacity-60 whitespace-nowrap"
              >
                {savedAllDone ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#10B981]" />
                    Saved to Deck
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save All to Flashcard Deck
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {taughtIntros.map((intro) => (
                <div
                  key={intro.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                      {intro.phrase}
                    </p>
                    <p className="text-xs text-[#6E685F] dark:text-[#9A9389] truncate">
                      {intro.meaning} · /{intro.phonetic}/
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSpeak(`sum-${intro.id}`, intro.phrase)}
                    aria-label={`Listen to ${intro.phrase}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366F1]/12 text-[#6366F1] hover:bg-[#6366F1]/20"
                  >
                    {speakingId === `sum-${intro.id}` ? (
                      <Square className="h-3 w-3 fill-current" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6366F1] px-6 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-colors whitespace-nowrap"
          >
            Continue to Lesson Path
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] overflow-hidden flex flex-col">
      {/* Duolingo-Style Top Progress & HUD Bar */}
      <div className="border-b border-[#E8E2D8] dark:border-[#322E29] px-4 sm:px-6 py-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                stopActiveVoice();
                onExit();
              }}
              aria-label="Exit guided lesson"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E8E2D8] dark:border-[#322E29] text-[#5C5750] dark:text-[#A69F96] hover:border-[#6366F1] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#6366F1] truncate">
                {lesson.language} · {lesson.unitTitle}
              </p>
              <h3 className="font-display text-sm sm:text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                {lesson.lessonTitle}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs font-bold tabular-nums">
            <span className="inline-flex items-center gap-1 text-[#DC2626]" title="Hearts remaining">
              <Heart className="h-4 w-4 fill-current" />
              {hearts}
            </span>
            <span className="inline-flex items-center gap-1 text-[#D97706]" title="Daily streak">
              <Flame className="h-4 w-4 fill-current" />
              {Math.max(1, streakDays)}
            </span>
            <span className="inline-flex items-center gap-1 text-[#6366F1]" title="Lesson XP">
              <Zap className="h-4 w-4 fill-current" />
              +{sessionXp} XP
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29]">
            <div
              className="h-full rounded-full bg-[#10B981] transition-all duration-300"
              style={{ width: `${Math.max(8, progressPct)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[#6E685F] dark:text-[#9A9389] tabular-nums whitespace-nowrap">
            Step {stepIndex + 1} / {steps.length}
          </span>
        </div>
      </div>

      {/* Interactive Teaching / Exercise Body */}
      <div className="p-5 sm:p-7 flex-1 space-y-6">
        {/* Step Type A: New Word / Phrase Intro Card */}
        {activeStep?.type === "intro" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#6366F1]">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                New Phrase · Listen &amp; Learn
              </span>
              <button
                type="button"
                disabled={isPhraseSaved(activeStep.phrase)}
                onClick={() =>
                  onSaveFlashcard({
                    phrase: activeStep.phrase,
                    meaning: activeStep.meaning,
                    phonetic: activeStep.phonetic,
                  })
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] hover:border-[#6366F1] hover:text-[#6366F1] disabled:opacity-60 whitespace-nowrap"
              >
                {isPhraseSaved(activeStep.phrase) ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#10B981]" />
                    Saved to Deck
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save Flashcard
                  </>
                )}
              </button>
            </div>

            <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-6 text-center space-y-4">
              <div className="space-y-1.5">
                <p className="font-display text-2xl sm:text-3xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] text-balance">
                  {activeStep.phrase}
                </p>
                <p className="font-mono text-sm text-[#6E685F] dark:text-[#9A9389]">
                  /{activeStep.phonetic}/
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleSpeak(`intro-${activeStep.id}`, activeStep.phrase)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6366F1] px-5 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-colors whitespace-nowrap"
                >
                  {speakingId === `intro-${activeStep.id}` ? (
                    <>
                      <Square className="h-4 w-4 fill-current" />
                      Stop Audio
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      🔊 Listen
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-[#E8E2D8] dark:border-[#322E29] pt-4">
                <p className="text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
                  English Meaning
                </p>
                <p className="mt-0.5 font-display text-lg font-bold text-[#6366F1]">
                  {activeStep.meaning}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-4 space-y-2 text-xs sm:text-sm">
              <p className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Cultural &amp; Grammar Tip
              </p>
              <p className="text-[#5C5750] dark:text-[#A69F96] leading-relaxed">
                {activeStep.culturalTip}
              </p>
              {activeStep.exampleSentence && (
                <p className="pt-1 text-xs text-[#6E685F] dark:text-[#9A9389]">
                  Example: <strong className="text-[#1E1E1E] dark:text-[#F5F2EC]">{activeStep.exampleSentence}</strong>
                  {activeStep.exampleTranslation ? ` — "${activeStep.exampleTranslation}"` : ""}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSessionXp((xp) => xp + 5);
                  advanceToNextStep(5);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#10B981] px-6 text-sm font-semibold text-white hover:bg-[#059669] transition-colors whitespace-nowrap"
              >
                Got It · Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step Type B: Multiple-Choice Translation & Listening Quiz */}
        {activeStep?.type === "multiple-choice" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#6366F1]">
                {activeStep.mode === "listening"
                  ? "Listening Quiz · Tap to Hear"
                  : "Translation Check · Choose the Meaning"}
              </p>
              <h4 className="font-display text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] text-balance">
                {activeStep.prompt}
              </h4>
            </div>

            {activeStep.mode === "listening" ? (
              <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    Listen to the {lesson.language} phrase
                  </p>
                  <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                    {feedback ? `${activeStep.targetPhrase}${activeStep.phonetic ? ` (/${activeStep.phonetic}/)` : ""}` : "Tap Listen as many times as you want."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleSpeak(`mc-${activeStep.id}`, activeStep.targetPhrase)
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6366F1] px-5 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-colors whitespace-nowrap"
                >
                  {speakingId === `mc-${activeStep.id}` ? (
                    <>
                      <Square className="h-4 w-4 fill-current" />
                      Stop Audio
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      🔊 Listen
                    </>
                  )}
                </button>
              </div>
            ) : (
              activeStep.targetPhrase && (
                <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                      {activeStep.targetPhrase}
                    </p>
                    {activeStep.phonetic && (
                      <p className="font-mono text-xs text-[#6E685F] dark:text-[#9A9389]">
                        /{activeStep.phonetic}/
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSpeak(`mc-${activeStep.id}`, activeStep.targetPhrase)
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs font-semibold text-[#6366F1] hover:border-[#6366F1] whitespace-nowrap"
                  >
                    {speakingId === `mc-${activeStep.id}` ? (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        Listen
                      </>
                    )}
                  </button>
                </div>
              )
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeStep.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrectHighlight =
                  feedback?.kind === "correct" && idx === activeStep.correctIndex;
                const isWrongHighlight =
                  feedback?.kind === "wrong" && isSelected && idx !== activeStep.correctIndex;

                return (
                  <button
                    key={`${activeStep.id}-opt-${idx}`}
                    type="button"
                    disabled={feedback?.kind === "correct"}
                    onClick={() => {
                      if (feedback?.kind === "wrong") setFeedback(null);
                      setSelectedOption(idx);
                    }}
                    className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                      isCorrectHighlight
                        ? "border-[#10B981] bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0]"
                        : isWrongHighlight
                        ? "border-[#DC2626] bg-[#DC2626]/10 text-[#991B1B] dark:text-[#FECACA]"
                        : isSelected
                        ? "border-[#6366F1] bg-[#6366F1]/10 text-[#1E1E1E] dark:text-[#F5F2EC]"
                        : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#6366F1]/60"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                        isCorrectHighlight
                          ? "bg-[#10B981] text-white"
                          : isWrongHighlight
                          ? "bg-[#DC2626] text-white"
                          : isSelected
                          ? "bg-[#6366F1] text-white"
                          : "bg-[#FFFFFF] dark:bg-[#22201D] border border-[#E8E2D8] dark:border-[#322E29] text-[#5C5750] dark:text-[#A69F96]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold leading-snug">{opt}</span>
                  </button>
                );
              })}
            </div>

            {feedback?.kind !== "correct" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={selectedOption === null || hearts === 0}
                  onClick={handleCheckMultipleChoice}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6366F1] px-6 text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-40 whitespace-nowrap"
                >
                  Check Answer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step Type C: Tap-the-Word-Tiles Sentence Builder */}
        {activeStep?.type === "tile-builder" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#6366F1]">
                  Sentence Builder · Tap Word Tiles (No Typing)
                </p>
                <h4 className="font-display text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] text-balance">
                  {activeStep.prompt}
                </h4>
              </div>
              <button
                type="button"
                onClick={() =>
                  void handleSpeak(`tb-${activeStep.id}`, activeStep.targetPhrase)
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-semibold text-[#6366F1] hover:border-[#6366F1] whitespace-nowrap"
              >
                {speakingId === `tb-${activeStep.id}` ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    🔊 Hear Target
                  </>
                )}
              </button>
            </div>

            {/* Answer Construction Tray */}
            <div className="rounded-2xl border-2 border-dashed border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-4 min-h-[82px] flex flex-wrap items-center gap-2">
              {selectedChipIds.length === 0 ? (
                <span className="text-xs sm:text-sm text-[#6E685F] dark:text-[#9A9389]">
                  Tap the word tiles below to assemble your {lesson.language} sentence here...
                </span>
              ) : (
                selectedChipIds.map((chipId) => {
                  const chip = tilePool.find((c) => c.chipId === chipId);
                  if (!chip) return null;
                  return (
                    <button
                      key={`placed-${chip.chipId}`}
                      type="button"
                      disabled={feedback?.kind === "correct"}
                      onClick={() => {
                        if (feedback?.kind === "wrong") setFeedback(null);
                        setSelectedChipIds((prev) =>
                          prev.filter((id) => id !== chip.chipId)
                        );
                      }}
                      className="min-h-[42px] rounded-xl border-2 border-[#6366F1] bg-[#FFFFFF] dark:bg-[#22201D] px-3.5 py-1.5 text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#DC2626] transition-colors"
                    >
                      {chip.text}
                    </button>
                  );
                })
              )}
            </div>

            {/* Scrambled Word Tile Bank */}
            <div className="flex flex-wrap items-center gap-2.5">
              {tilePool.map((chip) => {
                const isPlaced = selectedChipIds.includes(chip.chipId);
                return (
                  <button
                    key={chip.chipId}
                    type="button"
                    disabled={isPlaced || feedback?.kind === "correct"}
                    onClick={() => {
                      if (feedback?.kind === "wrong") setFeedback(null);
                      setSelectedChipIds((prev) => [...prev, chip.chipId]);
                    }}
                    className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      isPlaced
                        ? "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-transparent select-none opacity-40"
                        : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#6366F1] hover:bg-[#6366F1]/8"
                    }`}
                  >
                    {chip.text}
                  </button>
                );
              })}
            </div>

            {feedback?.kind !== "correct" && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={selectedChipIds.length === 0}
                  onClick={() => {
                    setSelectedChipIds([]);
                    setFeedback(null);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] px-3.5 text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] hover:border-[#6366F1] disabled:opacity-40 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear Tiles
                </button>
                <button
                  type="button"
                  disabled={selectedChipIds.length === 0 || hearts === 0}
                  onClick={handleCheckTileBuilder}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6366F1] px-6 text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-40 whitespace-nowrap"
                >
                  Check Answer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step Type D: Match-the-Pairs Mini-Game */}
        {activeStep?.type === "match-pairs" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#6366F1]">
                  Match-the-Pairs Mini-Game · {matchedPairIds.length} / {activeStep.pairs.length} Matched
                </p>
                <h4 className="font-display text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  {activeStep.prompt}
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Left Column: Target Language */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#6E685F] dark:text-[#9A9389]">
                  {lesson.language}
                </p>
                {matchColumns.left.map((item) => {
                  const isMatched = matchedPairIds.includes(item.id);
                  const isSelected = selectedLeftId === item.id;
                  return (
                    <button
                      key={`ml-${item.id}`}
                      type="button"
                      disabled={isMatched || hearts === 0}
                      onClick={() => handleSelectPairSide("left", item.id)}
                      className={`w-full min-h-[56px] rounded-2xl border-2 px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                        isMatched
                          ? "border-[#10B981]/50 bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0]"
                          : isSelected
                          ? "border-[#6366F1] bg-[#6366F1]/12 text-[#1E1E1E] dark:text-[#F5F2EC]"
                          : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#6366F1]/60"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-snug">{item.text}</p>
                        {item.phonetic && (
                          <p className="font-mono text-[11px] text-[#6E685F] dark:text-[#9A9389] truncate">
                            /{item.phonetic}/
                          </p>
                        )}
                      </div>
                      {isMatched ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#6366F1]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Column: English Meanings */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#6E685F] dark:text-[#9A9389]">
                  English Meaning
                </p>
                {matchColumns.right.map((item) => {
                  const isMatched = matchedPairIds.includes(item.id);
                  const isSelected = selectedRightId === item.id;
                  return (
                    <button
                      key={`mr-${item.id}`}
                      type="button"
                      disabled={isMatched || hearts === 0}
                      onClick={() => handleSelectPairSide("right", item.id)}
                      className={`w-full min-h-[56px] rounded-2xl border-2 px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                        isMatched
                          ? "border-[#10B981]/50 bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0]"
                          : isSelected
                          ? "border-[#6366F1] bg-[#6366F1]/12 text-[#1E1E1E] dark:text-[#F5F2EC]"
                          : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#6366F1]/60"
                      }`}
                    >
                      <span className="text-sm font-semibold leading-snug">{item.text}</span>
                      {isMatched && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Immediate Feedback Banner */}
      {(feedback || hearts === 0) && (
        <div
          className={`border-t px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            feedback?.kind === "correct"
              ? "border-[#10B981]/40 bg-[#10B981]/12"
              : "border-[#DC2626]/40 bg-[#DC2626]/10"
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback?.kind === "correct" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#10B981] mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-[#DC2626] mt-0.5" />
            )}
            <div>
              <p
                className={`font-display text-sm font-bold ${
                  feedback?.kind === "correct"
                    ? "text-[#065F46] dark:text-[#A7F3D0]"
                    : "text-[#991B1B] dark:text-[#FECACA]"
                }`}
              >
                {hearts === 0 && feedback?.kind !== "correct"
                  ? "Out of Hearts — Refill Free to Keep Practicing"
                  : feedback?.title}
              </p>
              <p className="mt-0.5 text-xs text-[#5C5750] dark:text-[#A69F96]">
                {feedback?.detail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {hearts === 0 && feedback?.kind !== "correct" ? (
              <button
                type="button"
                onClick={() => {
                  onRefillHearts();
                  handleRetryCurrentStep();
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 text-xs font-semibold text-white hover:bg-[#B91C1C] whitespace-nowrap"
              >
                <Heart className="h-3.5 w-3.5 fill-current" />
                Refill 5 Hearts
              </button>
            ) : feedback?.kind === "correct" ? (
              <button
                type="button"
                onClick={() => advanceToNextStep(0)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#10B981] px-5 text-xs font-semibold text-white hover:bg-[#059669] whitespace-nowrap"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                {activeStep?.type !== "match-pairs" && (
                  <button
                    type="button"
                    onClick={handleRetryCurrentStep}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 text-xs font-semibold text-white hover:bg-[#B91C1C] whitespace-nowrap"
                  >
                    Try Again
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => advanceToNextStep(0)}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3.5 text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] hover:border-[#6366F1] whitespace-nowrap"
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
