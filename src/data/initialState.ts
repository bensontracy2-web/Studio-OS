import type {
  AcademyState,
  BuiltInFocusRole,
  DailyMetricPoint,
  GameRoomState,
  MediaStudioState,
  StudioState,
  TabId,
} from "../types/studio";

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const ALL_TABS: TabId[] = [
  "bestie",
  "life",
  "academy",
  "brain",
  "editdesk",
  "media",
  "gameroom",
];

export const FOCUS_ROLES: Array<{
  role: BuiltInFocusRole;
  tagline: string;
}> = [
  { role: "Student", tagline: "Classes, study drills, focus habits & notes" },
  { role: "Content Creator", tagline: "Hooks, video briefs, editing pipeline & media" },
  { role: "Influencer / Personal Brand", tagline: "Brand deals, daily posts, thumbnails & growth" },
  { role: "Founder / Business Owner", tagline: "Execution sprints, revenue & strategic notes" },
  { role: "Job Seeker / Career Builder", tagline: "Applications, portfolio prep, skill drills & inbox" },
  { role: "9-to-5 Worker", tagline: "Work tasks, meeting prep, inbox & daily balance" },
  { role: "Freelancer / Side-Hustler", tagline: "Client deliverables, invoicing & multi-income" },
  { role: "Tech / Skill Learner", tagline: "Coding drills, micro-lessons, flashcards & notes" },
  { role: "Everyday Life & Self-Care", tagline: "Hydration, sleep, calm routines & reflection" },
];

export const ROLE_DEFAULT_TABS: Record<BuiltInFocusRole, TabId[]> = {
  Student: ["bestie", "life", "academy", "brain", "gameroom"],
  "Content Creator": ["bestie", "life", "academy", "brain", "editdesk", "media", "gameroom"],
  "Influencer / Personal Brand": ["bestie", "life", "brain", "editdesk", "media", "gameroom"],
  "Founder / Business Owner": ["bestie", "life", "brain", "academy", "editdesk", "gameroom"],
  "Job Seeker / Career Builder": ["bestie", "life", "academy", "brain", "gameroom"],
  "9-to-5 Worker": ["bestie", "life", "brain", "gameroom"],
  "Freelancer / Side-Hustler": ["bestie", "life", "brain", "academy", "editdesk", "gameroom"],
  "Tech / Skill Learner": ["bestie", "life", "academy", "brain", "gameroom"],
  "Everyday Life & Self-Care": ["bestie", "life", "brain", "gameroom"],
};

export function getCombinedTabsForRoles(roles: string[]): TabId[] {
  if (!Array.isArray(roles) || roles.length === 0) {
    return ["bestie", "life", "brain", "gameroom"];
  }
  const tabSet = new Set<TabId>(["bestie", "life"]);
  for (const rawRole of roles) {
    const role = rawRole.trim();
    if (!role) continue;
    if (role in ROLE_DEFAULT_TABS) {
      ROLE_DEFAULT_TABS[role as BuiltInFocusRole].forEach((t) => tabSet.add(t));
      continue;
    }
    // Custom role smart inference
    const lower = role.toLowerCase();
    tabSet.add("brain");
    tabSet.add("gameroom");
    if (
      lower.includes("creat") ||
      lower.includes("video") ||
      lower.includes("filmmak") ||
      lower.includes("podcast") ||
      lower.includes("influenc") ||
      lower.includes("social") ||
      lower.includes("market") ||
      lower.includes("media") ||
      lower.includes("design")
    ) {
      tabSet.add("editdesk");
      tabSet.add("media");
    }
    if (
      lower.includes("learn") ||
      lower.includes("stud") ||
      lower.includes("code") ||
      lower.includes("dev") ||
      lower.includes("tech") ||
      lower.includes("lang") ||
      lower.includes("coach") ||
      lower.includes("teach") ||
      lower.includes("research")
    ) {
      tabSet.add("academy");
    }
  }
  return ALL_TABS.filter((id) => tabSet.has(id));
}

export function buildLast7DaysMetrics(
  habitIds: string[],
  todayCompletedMap: Record<string, boolean>,
  todayPosts: number
): DailyMetricPoint[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const points: DailyMetricPoint[] = [];
  const now = new Date();

  for (let offset = 6; offset >= 0; offset--) {
    const dt = new Date(now);
    dt.setDate(now.getDate() - offset);
    const dateKey = formatDateKey(dt);
    const dayLabel = offset === 0 ? "Today" : days[dt.getDay()];

    if (offset === 0) {
      const doneCount = habitIds.filter((id) => todayCompletedMap[id]).length;
      const habitRate =
        habitIds.length > 0 ? Math.round((doneCount / habitIds.length) * 100) : 0;
      points.push({
        dayLabel,
        dateKey,
        posts: todayPosts,
        audienceGrowth: todayPosts > 0 || doneCount > 0 ? todayPosts * 100 + doneCount * 15 : 0,
        habitRate,
        habitMap: { ...todayCompletedMap },
      });
    } else {
      points.push({
        dayLabel,
        dateKey,
        posts: 0,
        audienceGrowth: 0,
        habitRate: 0,
        habitMap: {},
      });
    }
  }

  return points;
}

export function createEmptyAcademyState(): AcademyState {
  return {
    xp: 0,
    selectedLanguage: "Spanish",
    lessons: [],
    flashcards: [],
    roleplayMessages: [],
    languageProgress: {
      hearts: 5,
      maxHearts: 5,
      streakDays: 0,
      lastPracticeDate: "",
      completedLessonKeys: [],
      cachedLessons: {},
    },
  };
}

export function createEmptyMediaState(): MediaStudioState {
  return {
    scriptText: "",
    aspectRatio: "9:16",
    themeId: "magenta",
    voiceoverEnabled: false,
    voiceId: "Kore",
    scenes: [],
    thumbnail: {
      ratio: "16:9",
      templateId: "bold-split",
      kicker: "",
      headline: "",
      subheadline: "",
      accentHex: "#EC4899",
    },
  };
}

export function createEmptyGameRoomState(): GameRoomState {
  return {
    wordle: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      bestStreak: 0,
      targetWord: "PITCH",
      guesses: [],
      status: "playing",
    },
    quiz: {
      highScore: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      cachedQuizzes: [],
    },
    tileMatch: {
      bestMoves: null,
      gamesWon: 0,
    },
  };
}

export function createEmptyStudioState(): StudioState {
  return {
    version: 4,
    theme: "light",
    activeTab: "bestie",
    sidebarCollapsed: false,
    googleClientIdOverride: "",
    userProfile: {
      name: "",
      roles: [],
      focus: "",
      visibleTabs: [...ALL_TABS],
      onboardingCompleted: false,
    },
    dailyInterview: {
      dateKey: "",
      step: 1,
      started: false,
      completed: false,
    },
    bestie: {
      personality: "bestie",
      memories: [],
      messages: [],
      scannedEmails: [],
      calendarEvents: [],
    },
    life: {
      creatorName: "",
      habits: [],
      waterGlasses: 0,
      waterTarget: 8,
      sleepHours: 0,
      sleepTarget: 8,
      postsToday: 0,
      postsTarget: 1,
      deliverables: [],
      moneyEntries: [],
      monthlyGoalUSD: 1000,
      ngnPerUsd: 1600,
      weeklyMetrics: buildLast7DaysMetrics([], {}, 0),
    },
    brain: {
      notes: [],
      tasks: [],
      chatHistory: [],
    },
    editDesk: {
      cards: [],
    },
    academy: createEmptyAcademyState(),
    media: createEmptyMediaState(),
    gameRoom: createEmptyGameRoomState(),
    offlineQueue: [],
    notifications: [],
  };
}

export const INITIAL_STUDIO_STATE: StudioState = createEmptyStudioState();
