import React, { useState } from "react";
import { GraduationCap, Languages, Award } from "lucide-react";
import { StartupMentorPanel } from "./StartupMentorPanel";
import { LanguageStudioPanel } from "./LanguageStudioPanel";
import { formatDateKey } from "../../data/initialState";
import type {
  AcademyLesson,
  AcademyState,
  GuidedLanguageLesson,
  LanguageFlashcard,
  LanguageProgressState,
  MemoryItem,
  TargetLanguage,
} from "../../types/studio";

interface AcademyWorkspaceProps {
  academy: AcademyState;
  memories: MemoryItem[];
  userRoles?: string[];
  isOnline: boolean;
  onUpdateAcademy: (updater: (prev: AcademyState) => AcademyState) => void;
}

const DEFAULT_LANGUAGE_PROGRESS: LanguageProgressState = {
  hearts: 5,
  maxHearts: 5,
  streakDays: 0,
  lastPracticeDate: "",
  completedLessonKeys: [],
  cachedLessons: {},
};

export const AcademyWorkspace: React.FC<AcademyWorkspaceProps> = ({
  academy,
  memories,
  userRoles = [],
  isOnline,
  onUpdateAcademy,
}) => {
  const [subTab, setSubTab] = useState<"mentor" | "language">("mentor");

  const level = Math.floor(academy.xp / 150) + 1;
  const completedCount = academy.lessons.filter((l) => Boolean(l.completedAt)).length;
  const masteredCards = academy.flashcards.filter((c) => c.mastered).length;
  const languageProgress = academy.languageProgress ?? DEFAULT_LANGUAGE_PROGRESS;

  const handleAddLesson = (lesson: AcademyLesson) => {
    onUpdateAcademy((prev) => ({
      ...prev,
      lessons: [lesson, ...prev.lessons],
    }));
  };

  const handleCompleteLessonQuiz = (
    lessonId: string,
    score: number,
    xpEarned: number
  ) => {
    const nowIso = new Date().toISOString();
    onUpdateAcademy((prev) => ({
      ...prev,
      xp: prev.xp + xpEarned,
      lessons: prev.lessons.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              bestScore:
                typeof l.bestScore === "number" ? Math.max(l.bestScore, score) : score,
              completedAt: l.completedAt || nowIso,
            }
          : l
      ),
    }));
  };

  const handleDeleteLesson = (lessonId: string) => {
    onUpdateAcademy((prev) => ({
      ...prev,
      lessons: prev.lessons.filter((l) => l.id !== lessonId),
    }));
  };

  const handleChangeLanguage = (lang: TargetLanguage) => {
    onUpdateAcademy((prev) => ({ ...prev, selectedLanguage: lang }));
  };

  const handleAddFlashcard = (card: LanguageFlashcard) => {
    onUpdateAcademy((prev) => ({
      ...prev,
      flashcards: [card, ...prev.flashcards],
    }));
  };

  const handleToggleMastered = (id: string, xpGain: number) => {
    onUpdateAcademy((prev) => ({
      ...prev,
      xp: prev.xp + xpGain,
      flashcards: prev.flashcards.map((c) =>
        c.id === id ? { ...c, mastered: !c.mastered } : c
      ),
    }));
  };

  const handleLoseHeart = () => {
    onUpdateAcademy((prev) => {
      const lp = prev.languageProgress ?? DEFAULT_LANGUAGE_PROGRESS;
      return {
        ...prev,
        languageProgress: {
          ...lp,
          hearts: Math.max(0, lp.hearts - 1),
        },
      };
    });
  };

  const handleRefillHearts = () => {
    onUpdateAcademy((prev) => {
      const lp = prev.languageProgress ?? DEFAULT_LANGUAGE_PROGRESS;
      return {
        ...prev,
        languageProgress: {
          ...lp,
          hearts: lp.maxHearts,
        },
      };
    });
  };

  const handleCacheGuidedLesson = (lessonKey: string, lesson: GuidedLanguageLesson) => {
    onUpdateAcademy((prev) => {
      const lp = prev.languageProgress ?? DEFAULT_LANGUAGE_PROGRESS;
      return {
        ...prev,
        languageProgress: {
          ...lp,
          cachedLessons: {
            ...lp.cachedLessons,
            [lessonKey]: lesson,
          },
        },
      };
    });
  };

  const handleRecordLessonComplete = (lessonKey: string, totalXpEarned: number) => {
    const now = new Date();
    const todayKey = formatDateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterday);

    onUpdateAcademy((prev) => {
      const lp = prev.languageProgress ?? DEFAULT_LANGUAGE_PROGRESS;
      const alreadyToday = lp.lastPracticeDate === todayKey;
      const continuedStreak = lp.lastPracticeDate === yesterdayKey;
      const nextStreak = alreadyToday
        ? Math.max(1, lp.streakDays)
        : continuedStreak
        ? lp.streakDays + 1
        : 1;

      const nextCompleted = lp.completedLessonKeys.includes(lessonKey)
        ? lp.completedLessonKeys
        : [...lp.completedLessonKeys, lessonKey];

      return {
        ...prev,
        xp: prev.xp + totalXpEarned,
        languageProgress: {
          ...lp,
          streakDays: nextStreak,
          lastPracticeDate: todayKey,
          completedLessonKeys: nextCompleted,
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Royal Indigo Header Card */}
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#6366F1] text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Academy &amp; Language Lab
              </h2>
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#6366F1]/12 px-2.5 py-0.5 text-xs font-bold text-[#6366F1] tabular-nums">
                <Award className="h-3.5 w-3.5" />
                Level {level} · {academy.xp} XP
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96]">
              {completedCount}/{academy.lessons.length} mentor lessons ·{" "}
              {languageProgress.completedLessonKeys.length} guided language steps · {masteredCards}/
              {academy.flashcards.length} flashcards mastered
            </p>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-[#FAF7F2] dark:bg-[#161513] p-1 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setSubTab("mentor")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === "mentor"
                ? "bg-[#6366F1] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Startup &amp; Tech Mentor
          </button>
          <button
            type="button"
            onClick={() => setSubTab("language")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === "language"
                ? "bg-[#6366F1] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            Language Studio
          </button>
        </div>
      </div>

      {subTab === "mentor" ? (
        <StartupMentorPanel
          lessons={academy.lessons}
          memories={memories}
          userRoles={userRoles}
          isOnline={isOnline}
          onAddLesson={handleAddLesson}
          onCompleteLessonQuiz={handleCompleteLessonQuiz}
          onDeleteLesson={handleDeleteLesson}
        />
      ) : (
        <LanguageStudioPanel
          xp={academy.xp}
          selectedLanguage={academy.selectedLanguage}
          flashcards={academy.flashcards}
          languageProgress={languageProgress}
          userRoles={userRoles}
          isOnline={isOnline}
          onChangeLanguage={handleChangeLanguage}
          onAddFlashcard={handleAddFlashcard}
          onToggleMastered={handleToggleMastered}
          onLoseHeart={handleLoseHeart}
          onRefillHearts={handleRefillHearts}
          onCacheGuidedLesson={handleCacheGuidedLesson}
          onRecordLessonComplete={handleRecordLessonComplete}
        />
      )}
    </div>
  );
};
