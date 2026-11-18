import { useState, useEffect, useCallback } from "react";
import type { StudioState, TabId } from "../types/studio";
import {
  ALL_TABS,
  buildLast7DaysMetrics,
  createEmptyStudioState,
  formatDateKey,
} from "../data/initialState";

const STORAGE_KEY = "studio_os_creator_state_v1";

function normalizeRoles(rawRoles: unknown, rawFocus: unknown): string[] {
  if (Array.isArray(rawRoles)) {
    const cleaned = rawRoles
      .map((r) => (typeof r === "string" ? r.trim() : ""))
      .filter(Boolean);
    if (cleaned.length > 0) return Array.from(new Set(cleaned));
  }
  if (typeof rawFocus === "string" && rawFocus.trim()) {
    const legacyMap: Record<string, string[]> = {
      Creator: ["Content Creator"],
      "9-to-5 / Freelancer": ["9-to-5 Worker", "Freelancer / Side-Hustler"],
      "Founder / Business": ["Founder / Business Owner"],
    };
    const trimmed = rawFocus.trim();
    if (legacyMap[trimmed]) return legacyMap[trimmed];
    return Array.from(
      new Set(
        trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

function sanitizeStateForPersistence(state: StudioState): StudioState {
  return {
    ...state,
    bestie: {
      ...state.bestie,
      scannedEmails: [],
      calendarEvents: [],
      lastInboxSummary: undefined,
      lastScannedAt: undefined,
    },
  };
}

function hydrateState(raw: unknown): StudioState {
  const empty = createEmptyStudioState();
  if (!raw || typeof raw !== "object") {
    return empty;
  }

  const obj = raw as Partial<StudioState>;

  // If legacy pre-onboarding state has no userProfile yet, start cleanly on welcome quiz
  if (!obj.userProfile || typeof obj.userProfile !== "object") {
    return empty;
  }

  const rawProfile = obj.userProfile;
  const visibleTabsRaw = Array.isArray(rawProfile.visibleTabs)
    ? rawProfile.visibleTabs.filter((t): t is TabId => ALL_TABS.includes(t))
    : ALL_TABS;
  const visibleTabs: TabId[] = visibleTabsRaw.length > 0 ? visibleTabsRaw : ["bestie", "life"];
  const activeTabCandidate: TabId =
    obj.activeTab && ALL_TABS.includes(obj.activeTab) ? obj.activeTab : visibleTabs[0];
  const activeTab: TabId = visibleTabs.includes(activeTabCandidate)
    ? activeTabCandidate
    : visibleTabs[0];

  const life = obj.life ?? empty.life;
  const habits = Array.isArray(life.habits) ? life.habits : [];

  const todayKey = formatDateKey(new Date());
  const existingMetrics = Array.isArray(life.weeklyMetrics) ? life.weeklyMetrics : [];
  const hasToday = existingMetrics.some((m) => m.dateKey === todayKey);

  const todayMap = Object.fromEntries(habits.map((h) => [h.id, Boolean(h.completed)]));
  const weeklyMetrics = hasToday
    ? existingMetrics
    : buildLast7DaysMetrics(
        habits.map((h) => h.id),
        todayMap,
        typeof life.postsToday === "number" ? life.postsToday : 0
      );

  const rawInterview = obj.dailyInterview;
  const stepNum = rawInterview?.step;
  const validStep: 1 | 2 | 3 | 4 | 5 =
    stepNum === 1 || stepNum === 2 || stepNum === 3 || stepNum === 4 || stepNum === 5
      ? stepNum
      : 1;

  return {
    version: 4,
    theme: obj.theme === "dark" ? "dark" : "light",
    activeTab,
    sidebarCollapsed: Boolean(obj.sidebarCollapsed),
    googleClientIdOverride:
      typeof obj.googleClientIdOverride === "string" ? obj.googleClientIdOverride : "",
    userProfile: (() => {
      const roles = normalizeRoles(
        (rawProfile as { roles?: unknown }).roles,
        rawProfile.focus
      );
      return {
        name: typeof rawProfile.name === "string" ? rawProfile.name : "",
        roles,
        focus: roles.join(", "),
        visibleTabs,
        onboardingCompleted: Boolean(rawProfile.onboardingCompleted),
      };
    })(),
    dailyInterview: {
      dateKey: typeof rawInterview?.dateKey === "string" ? rawInterview.dateKey : "",
      step: validStep,
      started: Boolean(rawInterview?.started),
      completed: Boolean(rawInterview?.completed),
    },
    bestie: {
      personality: obj.bestie?.personality === "va" ? "va" : "bestie",
      memories: Array.isArray(obj.bestie?.memories) ? obj.bestie.memories : [],
      messages: Array.isArray(obj.bestie?.messages) ? obj.bestie.messages : [],
      lastInboxSummary: undefined,
      scannedEmails: [],
      calendarEvents: [],
      lastScannedAt: undefined,
    },
    life: {
      creatorName:
        typeof life.creatorName === "string"
          ? life.creatorName
          : typeof rawProfile.name === "string"
          ? rawProfile.name
          : "",
      habits,
      waterGlasses: typeof life.waterGlasses === "number" ? life.waterGlasses : 0,
      waterTarget: typeof life.waterTarget === "number" ? life.waterTarget : 8,
      sleepHours: typeof life.sleepHours === "number" ? life.sleepHours : 0,
      sleepTarget: typeof life.sleepTarget === "number" ? life.sleepTarget : 8,
      postsToday: typeof life.postsToday === "number" ? life.postsToday : 0,
      postsTarget: typeof life.postsTarget === "number" ? life.postsTarget : 1,
      deliverables: Array.isArray(life.deliverables) ? life.deliverables : [],
      moneyEntries: Array.isArray(life.moneyEntries) ? life.moneyEntries : [],
      monthlyGoalUSD: typeof life.monthlyGoalUSD === "number" ? life.monthlyGoalUSD : 1000,
      ngnPerUsd: typeof life.ngnPerUsd === "number" ? life.ngnPerUsd : 1600,
      weeklyMetrics,
    },
    brain: {
      notes: Array.isArray(obj.brain?.notes) ? obj.brain.notes : [],
      tasks: Array.isArray(obj.brain?.tasks) ? obj.brain.tasks : [],
      chatHistory: Array.isArray(obj.brain?.chatHistory) ? obj.brain.chatHistory : [],
    },
    editDesk: {
      cards: Array.isArray(obj.editDesk?.cards) ? obj.editDesk.cards : [],
    },
    academy: {
      xp: typeof obj.academy?.xp === "number" ? obj.academy.xp : 0,
      selectedLanguage: obj.academy?.selectedLanguage || "Spanish",
      lessons: Array.isArray(obj.academy?.lessons) ? obj.academy.lessons : [],
      flashcards: Array.isArray(obj.academy?.flashcards) ? obj.academy.flashcards : [],
      roleplayMessages: Array.isArray(obj.academy?.roleplayMessages)
        ? obj.academy.roleplayMessages
        : [],
      languageProgress: {
        hearts:
          typeof obj.academy?.languageProgress?.hearts === "number"
            ? Math.max(0, Math.min(5, obj.academy.languageProgress.hearts))
            : 5,
        maxHearts: 5,
        streakDays:
          typeof obj.academy?.languageProgress?.streakDays === "number"
            ? obj.academy.languageProgress.streakDays
            : 0,
        lastPracticeDate:
          typeof obj.academy?.languageProgress?.lastPracticeDate === "string"
            ? obj.academy.languageProgress.lastPracticeDate
            : "",
        completedLessonKeys: Array.isArray(obj.academy?.languageProgress?.completedLessonKeys)
          ? obj.academy.languageProgress.completedLessonKeys.filter(
              (k): k is string => typeof k === "string"
            )
          : [],
        cachedLessons:
          obj.academy?.languageProgress?.cachedLessons &&
          typeof obj.academy.languageProgress.cachedLessons === "object"
            ? obj.academy.languageProgress.cachedLessons
            : {},
      },
    },
    media: {
      scriptText: typeof obj.media?.scriptText === "string" ? obj.media.scriptText : "",
      aspectRatio: obj.media?.aspectRatio === "16:9" ? "16:9" : "9:16",
      themeId: obj.media?.themeId || "magenta",
      scenes: Array.isArray(obj.media?.scenes) ? obj.media.scenes : [],
      thumbnail: obj.media?.thumbnail
        ? { ...empty.media.thumbnail, ...obj.media.thumbnail }
        : empty.media.thumbnail,
    },
    gameRoom: {
      wordle: obj.gameRoom?.wordle
        ? { ...empty.gameRoom.wordle, ...obj.gameRoom.wordle }
        : empty.gameRoom.wordle,
      quiz: obj.gameRoom?.quiz
        ? {
            ...empty.gameRoom.quiz,
            ...obj.gameRoom.quiz,
            cachedQuizzes: Array.isArray(obj.gameRoom.quiz.cachedQuizzes)
              ? obj.gameRoom.quiz.cachedQuizzes
              : [],
          }
        : empty.gameRoom.quiz,
      tileMatch: obj.gameRoom?.tileMatch
        ? { ...empty.gameRoom.tileMatch, ...obj.gameRoom.tileMatch }
        : empty.gameRoom.tileMatch,
    },
    offlineQueue: Array.isArray(obj.offlineQueue) ? obj.offlineQueue : [],
    notifications: Array.isArray(obj.notifications) ? obj.notifications : [],
  };
}

export function useStudioStorage() {
  const [state, setState] = useState<StudioState>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return hydrateState(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not read StudioOS state from localStorage:", e);
    }
    return createEmptyStudioState();
  });

  useEffect(() => {
    try {
      const safeState = sanitizeStateForPersistence(state);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
    } catch (e) {
      console.warn("Could not persist StudioOS state:", e);
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [state.theme]);

  const exportJson = useCallback(() => {
    const safeState = sanitizeStateForPersistence(state);
    const payload = JSON.stringify(safeState, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studio-os-backup-${formatDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  const importJson = useCallback((jsonText: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object" || !parsed.life || !parsed.brain || !parsed.editDesk) {
        return { ok: false, error: "Invalid StudioOS backup file structure." };
      }
      const next = hydrateState({
        ...parsed,
        userProfile: parsed.userProfile ?? {
          name: parsed.life?.creatorName || "Friend",
          roles: ["Content Creator"],
          focus: "Content Creator",
          visibleTabs: ALL_TABS,
          onboardingCompleted: true,
        },
      });
      setState(next);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not parse JSON backup file." };
    }
  }, []);

  const resetAllData = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setState(createEmptyStudioState());
  }, []);

  return { state, setState, exportJson, importJson, resetAllData };
}
