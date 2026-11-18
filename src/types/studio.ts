export type TabId =
  | "bestie"
  | "life"
  | "academy"
  | "brain"
  | "editdesk"
  | "media"
  | "gameroom";

export type ThemeMode = "light" | "dark";

export type BuiltInFocusRole =
  | "Student"
  | "Content Creator"
  | "Influencer / Personal Brand"
  | "Founder / Business Owner"
  | "Job Seeker / Career Builder"
  | "9-to-5 Worker"
  | "Freelancer / Side-Hustler"
  | "Tech / Skill Learner"
  | "Everyday Life & Self-Care";

export type UserFocusRole = BuiltInFocusRole | (string & {});

export interface UserProfile {
  name: string;
  roles: string[];
  focus: string;
  visibleTabs: TabId[];
  onboardingCompleted: boolean;
}

export interface DailyInterviewState {
  dateKey: string;
  step: 1 | 2 | 3 | 4 | 5;
  started: boolean;
  completed: boolean;
}

export type DeliverableStatus = "In progress" | "This week" | "Ready";

export type BrainWorkspaceTag =
  | "Everything"
  | "Personal"
  | "My content"
  | "Client work"
  | "Ideas"
  | "Learning";

export type SpecificBrainTag = Exclude<BrainWorkspaceTag, "Everything">;

export type SocialPlatform = "TikTok" | "YouTube" | "Instagram" | "LinkedIn";

export type KanbanStage = "Brief" | "Editing" | "Review" | "Delivered";

export type BestiePersonality = "bestie" | "va";

export type MemoryCategory = "Personal" | "Goals" | "Projects" | "Skills";

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: string;
}

export type AppControlActionType =
  | "LOG_MONEY"
  | "ADD_TASK"
  | "LOG_WATER"
  | "LOG_SLEEP"
  | "LOG_POST"
  | "TOGGLE_HABIT"
  | "ADD_HABIT"
  | "SAVE_NOTE"
  | "SAVE_MEMORY";

export interface AppControlAction {
  type: AppControlActionType;
  label: string;
  amount?: number;
  currency?: "NGN" | "USD";
  moneyType?: "income" | "expense";
  title?: string;
  tag?: SpecificBrainTag;
  delta?: number;
  habitQuery?: string;
  noteContent?: string;
  memoryCategory?: MemoryCategory;
}

export interface EmailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "pending" | "drafted" | "sent" | "discarded";
  replyToMessageId?: string;
}

export interface BestieMessage {
  id: string;
  role: "user" | "assistant";
  personality: BestiePersonality;
  text: string;
  executedActions?: Array<{
    type: AppControlActionType;
    badgeText: string;
  }>;
  emailDraft?: EmailDraft;
  quickReplies?: string[];
  interviewStep?: number;
  modelUsed?: string;
  timestamp: string;
}

export interface ScannedEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  priority: "High" | "Normal" | "Low";
  summary: string;
  suggestedTask?: string;
  taskAdded?: boolean;
  suggestedReplySubject: string;
  suggestedReplyBody: string;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
}

export interface BestieState {
  personality: BestiePersonality;
  memories: MemoryItem[];
  messages: BestieMessage[];
  lastInboxSummary?: string;
  scannedEmails: ScannedEmail[];
  calendarEvents: CalendarEventItem[];
  lastScannedAt?: string;
}

export interface HabitPill {
  id: string;
  label: string;
  completed: boolean;
  isCustom?: boolean;
}

export interface Deliverable {
  id: string;
  title: string;
  clientOrProject: string;
  dueLabel: string;
  status: DeliverableStatus;
}

export interface MoneyEntry {
  id: string;
  title: string;
  currency: "NGN" | "USD";
  amount: number;
  type: "income" | "expense";
  date: string;
}

export interface DailyMetricPoint {
  dayLabel: string;
  dateKey: string;
  posts: number;
  audienceGrowth: number;
  habitRate: number;
  habitMap: Record<string, boolean>;
}

export interface BrainNote {
  id: string;
  title: string;
  rawContent: string;
  summary: string;
  tag: SpecificBrainTag;
  suggestedPlatform: SocialPlatform;
  createdAt: string;
  promotedToCardId?: string;
  pendingAiEnrich?: boolean;
}

export interface BrainTask {
  id: string;
  title: string;
  tag: SpecificBrainTag;
  completed: boolean;
  sourceNoteId?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citedNoteIds?: string[];
  modelUsed?: string;
  timestamp: string;
}

export interface CutSheetRow {
  id: string;
  timestamp: string;
  bRoll: string;
  onScreenText: string;
  audioNotes: string;
}

export interface EditCard {
  id: string;
  title: string;
  platform: SocialPlatform;
  stage: KanbanStage;
  hook: string;
  concept: string;
  cutSheet: CutSheetRow[];
  captions: {
    primary: string;
    shortAlt: string;
    hashtags: string[];
  };
  sourceNoteId?: string;
  syncedPost?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudioNotification {
  id: string;
  triggerKey: string;
  title: string;
  message: string;
  accentColor: string;
  tab: TabId;
  severity: "success" | "info" | "warning";
  createdAt: string;
  read: boolean;
}

export interface LifeDashboardState {
  creatorName: string;
  habits: HabitPill[];
  waterGlasses: number;
  waterTarget: number;
  sleepHours: number;
  sleepTarget: number;
  postsToday: number;
  postsTarget: number;
  deliverables: Deliverable[];
  moneyEntries: MoneyEntry[];
  monthlyGoalUSD: number;
  ngnPerUsd: number;
  weeklyMetrics: DailyMetricPoint[];
}

// Tab 3: Academy & Language Lab
export type AcademyTrack =
  | "Micro-Lesson"
  | "Startup Scenario"
  | "Tech & Coding Drill";

export interface AcademyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AcademyLesson {
  id: string;
  title: string;
  track: AcademyTrack;
  estimatedMinutes: number;
  tailoredReason: string;
  sections: Array<{ heading: string; body: string }>;
  quiz: AcademyQuizQuestion[];
  xpReward: number;
  bestScore?: number;
  completedAt?: string;
  createdAt: string;
}

export type TargetLanguage =
  | "Spanish"
  | "French"
  | "Yoruba"
  | "Japanese"
  | "Portuguese"
  | "German";

export interface LanguageFlashcard {
  id: string;
  language: TargetLanguage;
  front: string;
  back: string;
  phonetic: string;
  example: string;
  mastered: boolean;
}

export interface RoleplayMessage {
  id: string;
  role: "user" | "assistant";
  language: TargetLanguage;
  text: string;
  translation?: string;
  grammarTip?: string;
  vocabulary?: Array<{ phrase: string; meaning: string; phonetic: string }>;
  timestamp: string;
}

export type LanguageStepType =
  | "intro"
  | "multiple-choice"
  | "tile-builder"
  | "match-pairs";

export interface LanguageIntroStep {
  id: string;
  type: "intro";
  phrase: string;
  phonetic: string;
  meaning: string;
  culturalTip: string;
  exampleSentence?: string;
  exampleTranslation?: string;
}

export interface LanguageMultipleChoiceStep {
  id: string;
  type: "multiple-choice";
  mode: "translate" | "listening";
  prompt: string;
  targetPhrase: string;
  phonetic?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LanguageTileBuilderStep {
  id: string;
  type: "tile-builder";
  prompt: string;
  englishMeaning: string;
  targetPhrase: string;
  correctTokens: string[];
  distractorTokens: string[];
  explanation: string;
}

export interface LanguageMatchPairsStep {
  id: string;
  type: "match-pairs";
  prompt: string;
  pairs: Array<{
    id: string;
    target: string;
    english: string;
    phonetic?: string;
  }>;
  explanation: string;
}

export type LanguageLessonStep =
  | LanguageIntroStep
  | LanguageMultipleChoiceStep
  | LanguageTileBuilderStep
  | LanguageMatchPairsStep;

export interface GuidedLanguageLesson {
  id: string;
  language: TargetLanguage;
  unitId: string;
  unitTitle: string;
  lessonTitle: string;
  levelLabel: string;
  steps: LanguageLessonStep[];
  xpBonus: number;
  source: "gemini" | "offline-starter";
  createdAt: string;
}

export interface LanguageProgressState {
  hearts: number;
  maxHearts: number;
  streakDays: number;
  lastPracticeDate: string;
  completedLessonKeys: string[];
  cachedLessons: Record<string, GuidedLanguageLesson>;
}

export interface AcademyState {
  xp: number;
  lessons: AcademyLesson[];
  selectedLanguage: TargetLanguage;
  flashcards: LanguageFlashcard[];
  roleplayMessages: RoleplayMessage[];
  languageProgress?: LanguageProgressState;
}

// Tab 6: Free Media Studio
export interface KineticScene {
  id: string;
  text: string;
  emphasisWord: string;
  durationSec: number;
  bRollCue: string;
  veoPrompt?: string;
  clipAudioMuted?: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  mediaLabel?: string;
  svgFallbackSeed?: number;
}

export type ReelVoiceId = "Kore" | "Puck" | "Zephyr" | "Charon";

export interface MediaStudioState {
  scriptText: string;
  aspectRatio: "9:16" | "16:9";
  themeId: "magenta" | "cream" | "midnight" | "emerald";
  voiceoverEnabled?: boolean;
  voiceId?: ReelVoiceId;
  scenes: KineticScene[];
  thumbnail: {
    ratio: "16:9" | "4:5" | "1:1";
    templateId: "bold-split" | "editorial-card" | "studio-gradient";
    kicker: string;
    headline: string;
    subheadline: string;
    accentHex: string;
  };
}

// Tab 7: Cozy Game Room
export interface CachedQuiz {
  id: string;
  title: string;
  sourceLabel: string;
  questions: AcademyQuizQuestion[];
  createdAt: string;
}

export interface GameRoomState {
  wordle: {
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    bestStreak: number;
    targetWord: string;
    guesses: string[];
    status: "playing" | "won" | "lost";
  };
  quiz: {
    highScore: number;
    totalAnswered: number;
    totalCorrect: number;
    cachedQuizzes: CachedQuiz[];
  };
  tileMatch: {
    bestMoves: number | null;
    gamesWon: number;
  };
}

// Offline Sync Queue
export type OfflineQueueKind =
  | "AI_ENRICH_NOTE"
  | "SEND_EMAIL"
  | "CREATE_DRAFT";

export interface OfflineQueueItem {
  id: string;
  kind: OfflineQueueKind;
  label: string;
  payload: Record<string, string>;
  createdAt: string;
  lastError?: string;
}

export interface StudioState {
  version: number;
  theme: ThemeMode;
  activeTab: TabId;
  sidebarCollapsed: boolean;
  googleClientIdOverride: string;
  userProfile: UserProfile;
  dailyInterview: DailyInterviewState;
  bestie: BestieState;
  life: LifeDashboardState;
  brain: {
    notes: BrainNote[];
    tasks: BrainTask[];
    chatHistory: ChatMessage[];
  };
  editDesk: {
    cards: EditCard[];
  };
  academy: AcademyState;
  media: MediaStudioState;
  gameRoom: GameRoomState;
  offlineQueue: OfflineQueueItem[];
  notifications: StudioNotification[];
}
