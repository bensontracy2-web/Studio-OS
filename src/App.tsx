import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStudioStorage } from "./hooks/useLocalStorageState";
import { useAutomatedAlerts } from "./hooks/useAutomatedAlerts";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { ALL_TABS, formatDateKey } from "./data/initialState";
import {
  buildMissingKeyGreetingMessage,
  buildOfflineMorningGreetingMessage,
} from "./lib/proactiveBestie";
import { consumeSsePost } from "./lib/sseStream";
import {
  subscribeGoogleAuth,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  getInMemoryAccessToken,
  clearInMemoryAccessToken,
} from "./lib/googleAuth";
import {
  getAiRequestHeaders,
  hasUserGeminiKey,
  subscribeUserGeminiKey,
} from "./lib/securityPrefs";
import type { GoogleSessionUser } from "./lib/googleAuth";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { GoogleSettingsModal } from "./components/layout/GoogleSettingsModal";
import { SecurityPrivacyModal } from "./components/layout/SecurityPrivacyModal";
import { CustomizeTabsModal } from "./components/layout/CustomizeTabsModal";
import { NotificationToast } from "./components/layout/NotificationToast";
import { WelcomeOnboardingCard } from "./components/onboarding/WelcomeOnboardingCard";
import { BestieWorkspace } from "./components/bestie/BestieWorkspace";
import { FloatingBestieDrawer } from "./components/bestie/FloatingBestieDrawer";
import { LifeDashboard } from "./components/dashboard/LifeDashboard";
import { SecondBrain } from "./components/brain/SecondBrain";
import { EditDesk } from "./components/editdesk/EditDesk";
import { AcademyWorkspace } from "./components/academy/AcademyWorkspace";
import { MediaStudioWorkspace } from "./components/media/MediaStudioWorkspace";
import { GameRoomWorkspace } from "./components/gameroom/GameRoomWorkspace";
import type {
  AppControlAction,
  BestieMessage,
  BestiePersonality,
  BrainNote,
  BrainTask,
  CalendarEventItem,
  EditCard,
  EmailDraft,
  MemoryCategory,
  OfflineQueueItem,
  ScannedEmail,
  SpecificBrainTag,
  TabId,
} from "./types/studio";

export default function App() {
  const { state, setState, exportJson, importJson, resetAllData } = useStudioStorage();
  const { activeToasts, pushNotification, dismissToast } = useAutomatedAlerts(
    state,
    setState
  );
  const isOnline = useOnlineStatus();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [customizeTabsOpen, setCustomizeTabsOpen] = useState(false);
  const [bestieDrawerOpen, setBestieDrawerOpen] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const syncingRef = useRef(false);
  const proactiveInFlightRef = useRef<string>("");

  // Google Workspace OAuth state (access token stays strictly in React memory via useRef)
  const googleAccessTokenRef = useRef<string | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleSessionUser | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [hasPersonalGeminiKey, setHasPersonalGeminiKey] = useState(() =>
    hasUserGeminiKey()
  );

  useEffect(() => {
    return subscribeUserGeminiKey((active) => setHasPersonalGeminiKey(active));
  }, []);

  useEffect(() => {
    const unsub = subscribeGoogleAuth((user, hasToken) => {
      if (!hasToken) {
        googleAccessTokenRef.current = null;
      } else {
        googleAccessTokenRef.current = getInMemoryAccessToken();
      }
      setGoogleUser(user);
      setHasGoogleToken(hasToken);
    });
    return () => unsub();
  }, []);

  const handleQueueOfflineNoteEnrich = useCallback(
    (noteId: string, rawContent: string, title: string) => {
      const item: OfflineQueueItem = {
        id: `oq-note-${Date.now()}`,
        kind: "AI_ENRICH_NOTE",
        label: `AI-tag note: ${title.slice(0, 36)}`,
        payload: { noteId, rawContent },
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        offlineQueue: [...prev.offlineQueue, item],
      }));
    },
    [setState]
  );

  const handleQueueOfflineEmail = useCallback(
    (kind: "SEND_EMAIL" | "CREATE_DRAFT", draft: EmailDraft) => {
      const item: OfflineQueueItem = {
        id: `oq-mail-${Date.now()}`,
        kind,
        label: `${kind === "SEND_EMAIL" ? "Send" : "Draft"} email: ${draft.to}`,
        payload: {
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          threadId: draft.replyToMessageId || "",
        },
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        offlineQueue: [...prev.offlineQueue, item],
      }));
      pushNotification({
        triggerKey: `oq-added-${item.id}`,
        title: "Queued for Offline Sync",
        message: `"${draft.subject}" will sync automatically once online.`,
        accentColor: "#F59E0B",
        tab: state.activeTab,
        severity: "info",
        dedupe: false,
      });
    },
    [setState, pushNotification, state.activeTab]
  );

  const syncOfflineQueue = useCallback(async () => {
    if (!isOnline || syncingRef.current || state.offlineQueue.length === 0) {
      return;
    }
    syncingRef.current = true;
    setSyncingQueue(true);

    const snapshot = [...state.offlineQueue];
    let syncedCount = 0;

    for (const item of snapshot) {
      try {
        if (item.kind === "AI_ENRICH_NOTE") {
          const resp = await fetch("/api/brain/capture", {
            method: "POST",
            headers: getAiRequestHeaders(),
            body: JSON.stringify({ content: item.payload.rawContent }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Sync failed");

          const extractedTasks: BrainTask[] = Array.isArray(data.tasks)
            ? data.tasks.map((t: string, idx: number) => ({
                id: `task-sync-${Date.now()}-${idx}`,
                title: t,
                tag: data.tag || "Ideas",
                completed: false,
                sourceNoteId: item.payload.noteId,
                createdAt: new Date().toISOString(),
              }))
            : [];

          setState((prev) => ({
            ...prev,
            brain: {
              ...prev.brain,
              notes: prev.brain.notes.map((n) =>
                n.id === item.payload.noteId
                  ? {
                      ...n,
                      title: data.title || n.title,
                      tag: data.tag || n.tag,
                      summary: data.summary || n.summary,
                      suggestedPlatform: data.suggestedPlatform || n.suggestedPlatform,
                      pendingAiEnrich: false,
                    }
                  : n
              ),
              tasks: [...extractedTasks, ...prev.brain.tasks],
            },
            offlineQueue: prev.offlineQueue.filter((q) => q.id !== item.id),
          }));
          syncedCount += 1;
        } else if (item.kind === "SEND_EMAIL" || item.kind === "CREATE_DRAFT") {
          const token = googleAccessTokenRef.current || getInMemoryAccessToken();
          if (!token) {
            setState((prev) => ({
              ...prev,
              offlineQueue: prev.offlineQueue.map((q) =>
                q.id === item.id
                  ? { ...q, lastError: "Connect Google Account to sync queued email." }
                  : q
              ),
            }));
            continue;
          }

          const endpoint =
            item.kind === "SEND_EMAIL"
              ? "/api/google/send-email"
              : "/api/google/create-draft";
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              to: item.payload.to,
              subject: item.payload.subject,
              body: item.payload.body,
              threadId: item.payload.threadId || undefined,
            }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Gmail sync failed");

          setState((prev) => ({
            ...prev,
            offlineQueue: prev.offlineQueue.filter((q) => q.id !== item.id),
          }));
          syncedCount += 1;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Sync failed";
        setState((prev) => ({
          ...prev,
          offlineQueue: prev.offlineQueue.map((q) =>
            q.id === item.id ? { ...q, lastError: errMsg } : q
          ),
        }));
      }
    }

    if (syncedCount > 0) {
      pushNotification({
        triggerKey: `sync-done-${Date.now()}`,
        title: "Offline Queue Synced",
        message: `Synced ${syncedCount} offline item${syncedCount === 1 ? "" : "s"} after reconnecting.`,
        accentColor: "#10B981",
        tab: state.activeTab,
        severity: "success",
        dedupe: false,
      });
    }

    syncingRef.current = false;
    setSyncingQueue(false);
  }, [isOnline, state.offlineQueue, state.activeTab, setState, pushNotification]);

  useEffect(() => {
    if (isOnline && state.offlineQueue.length > 0) {
      void syncOfflineQueue();
    }
  }, [isOnline, state.offlineQueue.length, syncOfflineQueue]);

  const handleConnectGoogle = useCallback(async (): Promise<boolean> => {
    setConnectingGoogle(true);
    setGoogleAuthError(null);
    try {
      const { user, accessToken } = await signInWithGoogleWorkspace(state.googleClientIdOverride);
      googleAccessTokenRef.current = accessToken;
      setGoogleUser(user);
      setHasGoogleToken(true);
      pushNotification({
        triggerKey: `google-connected-${Date.now()}`,
        title: "Google Account Connected",
        message: `Connected ${user.email} for Gmail & Calendar.`,
        accentColor: "#F26B5B",
        tab: state.activeTab,
        severity: "success",
        dedupe: false,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not connect Google Account.";
      setGoogleAuthError(msg);
      setGoogleModalOpen(true);
      return false;
    } finally {
      setConnectingGoogle(false);
    }
  }, [state.googleClientIdOverride, state.activeTab, pushNotification]);

  const handleDisconnectGoogle = useCallback(async () => {
    googleAccessTokenRef.current = null;
    clearInMemoryAccessToken();
    await signOutGoogleWorkspace();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setGoogleAuthError(null);
  }, []);

  const handleDisconnectGoogleAndWipeEmails = useCallback(async () => {
    googleAccessTokenRef.current = null;
    clearInMemoryAccessToken();
    await signOutGoogleWorkspace();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setGoogleAuthError(null);

    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        scannedEmails: [],
        calendarEvents: [],
        lastInboxSummary: undefined,
        lastScannedAt: undefined,
        messages: prev.bestie.messages.map((m) =>
          m.emailDraft ? { ...m, emailDraft: undefined } : m
        ),
      },
      offlineQueue: prev.offlineQueue.filter(
        (q) => q.kind !== "SEND_EMAIL" && q.kind !== "CREATE_DRAFT"
      ),
    }));

    pushNotification({
      triggerKey: `google-wiped-${Date.now()}`,
      title: "Google Disconnected & Emails Wiped",
      message: "OAuth token cleared from memory and all cached Gmail/Calendar items wiped.",
      accentColor: "#10B981",
      tab: state.activeTab,
      severity: "success",
      dedupe: false,
    });
  }, [setState, pushNotification, state.activeTab]);

  // Trigger Conversational AI Morning Greeting (scans connected Gmail/Calendar + Memory Vault and greets naturally via Gemini)
  const triggerMorningBestieGreeting = useCallback(
    async (options?: { forceRestart?: boolean; openDrawerIfNotOnTab?: boolean }) => {
      const todayKey = formatDateKey(new Date());
      if (!options?.forceRestart && proactiveInFlightRef.current === todayKey) {
        return;
      }
      proactiveInFlightRef.current = todayKey;

      let scannedEmails = state.bestie.scannedEmails;
      let calendarEvents = state.bestie.calendarEvents;
      let lastInboxSummary = state.bestie.lastInboxSummary;
      let lastScannedAt = state.bestie.lastScannedAt;

      const token = googleAccessTokenRef.current || getInMemoryAccessToken();
      const browserOnline =
        isOnline && (typeof navigator === "undefined" || navigator.onLine);

      if (token && browserOnline) {
        try {
          const resp = await fetch("/api/google/inbox-brief", {
            method: "POST",
            headers: getAiRequestHeaders({
              Authorization: `Bearer ${token}`,
            }),
            body: JSON.stringify({ memories: state.bestie.memories }),
          });
          if (resp.ok) {
            const data = await resp.json();
            scannedEmails = Array.isArray(data.emails) ? data.emails : [];
            calendarEvents = Array.isArray(data.calendarEvents) ? data.calendarEvents : [];
            lastInboxSummary =
              typeof data.executiveSummary === "string"
                ? data.executiveSummary
                : lastInboxSummary;
            lastScannedAt = new Date().toISOString();
          }
        } catch {
          // Proceed smoothly with local memories if inbox scan fails
        }
      }

      const activeName = state.userProfile.name || state.life.creatorName;
      const personality = state.bestie.personality;
      let greetingMsg: BestieMessage;

      if (!browserOnline) {
        greetingMsg = buildOfflineMorningGreetingMessage({
          userName: activeName,
          personality,
          memories: state.bestie.memories,
          scannedEmails,
          calendarEvents,
        });
      } else {
        try {
          const completedHabits = state.life.habits.filter((h) => h.completed).length;
          const openTasks = state.brain.tasks.filter((t) => !t.completed).slice(0, 6);
          const streamData = await consumeSsePost<{
            reply?: string;
            modelUsed?: string;
          }>(
            "/api/bestie/chat/stream",
            getAiRequestHeaders(),
            {
              isMorningGreeting: true,
              message: "__MORNING_GREETING__",
              personality,
              memories: state.bestie.memories,
              scannedEmails,
              calendarEvents,
              studioContext: {
                userName: activeName,
                userRoles: state.userProfile.roles,
                userFocus: state.userProfile.focus,
                habitsCompleted: `${completedHabits}/${state.life.habits.length}`,
                openTasks: openTasks.map((t) => t.title),
                deliverablesCount: state.life.deliverables.length,
              },
            },
            {
              onChunk: () => {},
              onDone: () => {},
            }
          );

          greetingMsg = {
            id: `bmsg-greeting-${Date.now()}`,
            role: "assistant",
            personality,
            text:
              String(streamData.reply || "").trim() ||
              `Hey ${activeName || "friend"}! How's your day starting?`,
            modelUsed: streamData.modelUsed,
            timestamp: new Date().toISOString(),
          };
        } catch (err) {
          const errObj = err as Error & { code?: string };
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            greetingMsg = buildOfflineMorningGreetingMessage({
              userName: activeName,
              personality,
              memories: state.bestie.memories,
              scannedEmails,
              calendarEvents,
            });
          } else if (
            errObj?.code === "MISSING_API_KEY" ||
            errObj?.code === "INVALID_API_KEY" ||
            /api key|security & privacy/i.test(errObj?.message || "")
          ) {
            greetingMsg = buildMissingKeyGreetingMessage({
              userName: activeName,
              personality,
            });
          } else {
            greetingMsg = {
              id: `bmsg-greeting-ready-${Date.now()}`,
              role: "assistant",
              personality,
              text:
                personality === "bestie"
                  ? `Hey ${activeName || "friend"}! Ready whenever you want to chat—tell me what you're working on today or ask me anything.`
                  : `Good day${activeName ? `, ${activeName}` : ""}. Ready for your priorities, inbox questions, or quick workspace updates whenever you are.`,
              modelUsed: "ready-greeting",
              timestamp: new Date().toISOString(),
            };
          }
        }
      }

      setState((prev) => {
        if (!options?.forceRestart && prev.dailyInterview.dateKey === todayKey && prev.dailyInterview.started) {
          return prev;
        }
        return {
          ...prev,
          dailyInterview: {
            dateKey: todayKey,
            step: 5,
            started: true,
            completed: true,
          },
          bestie: {
            ...prev.bestie,
            scannedEmails,
            calendarEvents,
            lastInboxSummary,
            lastScannedAt,
            messages: [...prev.bestie.messages, greetingMsg],
          },
        };
      });

      if (options?.openDrawerIfNotOnTab !== false && state.activeTab !== "bestie") {
        setBestieDrawerOpen(true);
      }
    },
    [
      state.bestie.scannedEmails,
      state.bestie.calendarEvents,
      state.bestie.lastInboxSummary,
      state.bestie.lastScannedAt,
      state.bestie.memories,
      state.bestie.personality,
      state.userProfile.name,
      state.userProfile.roles,
      state.userProfile.focus,
      state.life.creatorName,
      state.life.habits,
      state.life.deliverables.length,
      state.brain.tasks,
      state.activeTab,
      isOnline,
      setState,
    ]
  );

  // Automatically trigger Bestie's conversational greeting on the first launch of each day after onboarding
  useEffect(() => {
    if (!state.userProfile.onboardingCompleted) return;
    const todayKey = formatDateKey(new Date());
    if (state.dailyInterview.dateKey !== todayKey || !state.dailyInterview.started) {
      void triggerMorningBestieGreeting({ openDrawerIfNotOnTab: true });
    }
  }, [
    state.userProfile.onboardingCompleted,
    state.dailyInterview.dateKey,
    state.dailyInterview.started,
    triggerMorningBestieGreeting,
  ]);

  const handleOpenBestieDrawerChange = (nextOpen: boolean) => {
    setBestieDrawerOpen(nextOpen);
    if (nextOpen && state.userProfile.onboardingCompleted) {
      const todayKey = formatDateKey(new Date());
      if (state.dailyInterview.dateKey !== todayKey || !state.dailyInterview.started) {
        void triggerMorningBestieGreeting({ openDrawerIfNotOnTab: false });
      }
    }
  };

  const handleCompleteOnboarding = (payload: {
    name: string;
    roles: string[];
    visibleTabs: TabId[];
  }) => {
    proactiveInFlightRef.current = "";
    const firstTab: TabId = payload.visibleTabs.includes("life")
      ? "life"
      : payload.visibleTabs[0] || "bestie";
    const rolesJoined = payload.roles.join(", ");
    const nowIso = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      activeTab: firstTab,
      userProfile: {
        name: payload.name,
        roles: payload.roles,
        focus: rolesJoined,
        visibleTabs: payload.visibleTabs,
        onboardingCompleted: true,
      },
      life: {
        ...prev.life,
        creatorName: payload.name,
      },
      bestie: {
        ...prev.bestie,
        memories: [
          {
            id: `mem-roles-${Date.now()}`,
            category: "Personal",
            content: `${payload.name}'s active roles: ${rolesJoined}. Tailor advice, tasks, and coaching to all of these hats.`,
            createdAt: nowIso,
          },
          ...prev.bestie.memories,
        ],
      },
    }));
  };

  const handleToggleVisibleTab = (tabId: TabId) => {
    setState((prev) => {
      const curr = prev.userProfile.visibleTabs;
      let nextTabs: TabId[];
      if (curr.includes(tabId)) {
        if (curr.length <= 1) return prev;
        nextTabs = curr.filter((id) => id !== tabId);
      } else {
        nextTabs = ALL_TABS.filter((id) => id === tabId || curr.includes(id));
      }
      const nextActive = nextTabs.includes(prev.activeTab)
        ? prev.activeTab
        : nextTabs[0];
      return {
        ...prev,
        activeTab: nextActive,
        userProfile: {
          ...prev.userProfile,
          visibleTabs: nextTabs,
        },
      };
    });
  };

  const handleApplyTabPreset = (tabs: TabId[], roles?: string[]) => {
    setState((prev) => {
      const nextActive = tabs.includes(prev.activeTab) ? prev.activeTab : tabs[0];
      const nextRoles = roles ?? prev.userProfile.roles;
      return {
        ...prev,
        activeTab: nextActive,
        userProfile: {
          ...prev.userProfile,
          roles: nextRoles,
          focus: nextRoles.join(", "),
          visibleTabs: tabs,
        },
      };
    });
  };

  const handleResetAllData = () => {
    proactiveInFlightRef.current = "";
    googleAccessTokenRef.current = null;
    clearInMemoryAccessToken();
    void signOutGoogleWorkspace();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setBestieDrawerOpen(false);
    setCustomizeTabsOpen(false);
    setSecurityModalOpen(false);
    resetAllData();
  };

  const handleSelectTab = (tab: TabId) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  };

  const handleToggleTheme = () => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === "light" ? "dark" : "light",
    }));
  };

  const handleToggleSidebar = () => {
    setState((prev) => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed,
    }));
  };

  const handleExportJson = () => {
    exportJson();
    pushNotification({
      triggerKey: `export-${Date.now()}`,
      title: "JSON Backup Exported",
      message: "Your StudioOS workspace snapshot was downloaded.",
      accentColor: "#10B981",
      tab: state.activeTab,
      severity: "success",
      dedupe: false,
    });
  };

  const handleImportJson = (jsonText: string) => {
    const res = importJson(jsonText);
    if (res.ok) {
      pushNotification({
        triggerKey: `import-ok-${Date.now()}`,
        title: "JSON Backup Restored",
        message: "All tabs, memories, habits, notes, and Kanban cards were restored.",
        accentColor: "#10B981",
        tab: state.activeTab,
        severity: "success",
        dedupe: false,
      });
    } else {
      pushNotification({
        triggerKey: `import-err-${Date.now()}`,
        title: "Import Failed",
        message: res.error || "Invalid backup file.",
        accentColor: "#F26B5B",
        tab: state.activeTab,
        severity: "warning",
        dedupe: false,
      });
    }
  };

  // App-Control Actions triggered by Bestie & VA structured JSON output & Proactive Check-in
  const handleExecuteBestieActions = useCallback(
    (
      actions: AppControlAction[]
    ): Array<{ type: AppControlAction["type"]; badgeText: string }> => {
      const badges: Array<{ type: AppControlAction["type"]; badgeText: string }> = [];
      const todayKey = formatDateKey(new Date());
      const nowIso = new Date().toISOString();

      setState((prev) => {
        let nextLife = { ...prev.life };
        let nextBrain = { ...prev.brain };
        let nextBestie = { ...prev.bestie };
        let nextOfflineQueue = [...prev.offlineQueue];

        const syncTodayRow = (lifeObj: typeof nextLife) => {
          const doneCount = lifeObj.habits.filter((h) => h.completed).length;
          const habitRate =
            lifeObj.habits.length > 0
              ? Math.round((doneCount / lifeObj.habits.length) * 100)
              : 0;
          const habitMap = Object.fromEntries(
            lifeObj.habits.map((h) => [h.id, h.completed])
          );
          return lifeObj.weeklyMetrics.map((point, idx) => {
            const isLast = idx === lifeObj.weeklyMetrics.length - 1;
            if (point.dateKey === todayKey || isLast) {
              return {
                ...point,
                dayLabel: "Today",
                dateKey: todayKey,
                posts: lifeObj.postsToday,
                audienceGrowth:
                  lifeObj.postsToday > 0 || doneCount > 0
                    ? lifeObj.postsToday * 100 + doneCount * 15
                    : 0,
                habitRate,
                habitMap,
              };
            }
            return point;
          });
        };

        actions.forEach((act, idx) => {
          const uid = `${Date.now()}-${idx}`;

          if (act.type === "LOG_MONEY" && typeof act.amount === "number" && act.amount > 0) {
            const currency = act.currency === "NGN" ? "NGN" : "USD";
            const moneyType = act.moneyType === "expense" ? "expense" : "income";
            const symbol = currency === "NGN" ? "₦" : "$";
            nextLife = {
              ...nextLife,
              moneyEntries: [
                {
                  id: `mon-${uid}`,
                  title: act.title || (moneyType === "income" ? "Bestie Logged Income" : "Bestie Logged Expense"),
                  currency,
                  amount: act.amount,
                  type: moneyType,
                  date: todayKey,
                },
                ...nextLife.moneyEntries,
              ],
            };
            badges.push({
              type: act.type,
              badgeText:
                act.label ||
                `Logged ${moneyType === "income" ? "+" : "-"}${symbol}${act.amount.toLocaleString()}`,
            });
          } else if (act.type === "ADD_TASK" && (act.title || act.label)) {
            const allowedTags: SpecificBrainTag[] = [
              "Personal",
              "My content",
              "Client work",
              "Ideas",
              "Learning",
            ];
            const tag: SpecificBrainTag = allowedTags.includes(act.tag as SpecificBrainTag)
              ? (act.tag as SpecificBrainTag)
              : "Personal";
            const taskTitle = (act.title || act.label).trim();
            const normalizedTitle = taskTitle.toLowerCase();

            const taskExists = nextBrain.tasks.some(
              (t) => t.title.toLowerCase() === normalizedTitle && !t.completed
            );
            if (!taskExists) {
              const newTask: BrainTask = {
                id: `task-${uid}`,
                title: taskTitle,
                tag,
                completed: false,
                createdAt: nowIso,
              };
              nextBrain = {
                ...nextBrain,
                tasks: [newTask, ...nextBrain.tasks],
              };
            }

            const deliverableExists = nextLife.deliverables.some(
              (d) => d.title.toLowerCase() === normalizedTitle
            );
            if (!deliverableExists) {
              nextLife = {
                ...nextLife,
                deliverables: [
                  {
                    id: `del-${uid}`,
                    title: taskTitle,
                    clientOrProject: tag,
                    dueLabel: "Today",
                    status: "In progress",
                  },
                  ...nextLife.deliverables,
                ],
              };
            }

            badges.push({
              type: act.type,
              badgeText: act.label || `Added to Work & Deliverables: ${taskTitle}`,
            });
          } else if (act.type === "LOG_WATER") {
            const delta = typeof act.delta === "number" ? Math.round(act.delta) : 1;
            nextLife = {
              ...nextLife,
              waterGlasses: Math.max(0, nextLife.waterGlasses + delta),
            };
            badges.push({
              type: act.type,
              badgeText: act.label || `${delta >= 0 ? "+" : ""}${delta} water logged`,
            });
          } else if (act.type === "LOG_SLEEP") {
            const nextSleep =
              typeof act.amount === "number" && act.amount > 0
                ? Math.min(24, act.amount)
                : Math.max(0, Math.min(24, nextLife.sleepHours + (act.delta ?? 1)));
            nextLife = { ...nextLife, sleepHours: Number(nextSleep.toFixed(1)) };
            badges.push({
              type: act.type,
              badgeText: act.label || `Sleep set to ${nextLife.sleepHours}h`,
            });
          } else if (act.type === "LOG_POST") {
            const delta = typeof act.delta === "number" ? Math.round(act.delta) : 1;
            nextLife = {
              ...nextLife,
              postsToday: Math.max(0, nextLife.postsToday + delta),
            };
            nextLife = { ...nextLife, weeklyMetrics: syncTodayRow(nextLife) };
            badges.push({
              type: act.type,
              badgeText: act.label || `Posts Today: ${nextLife.postsToday}`,
            });
          } else if (act.type === "TOGGLE_HABIT" && act.habitQuery) {
            const q = act.habitQuery.toLowerCase();
            let matchedLabel = "";
            nextLife = {
              ...nextLife,
              habits: nextLife.habits.map((h) => {
                if (!matchedLabel && h.label.toLowerCase().includes(q)) {
                  matchedLabel = h.label;
                  return { ...h, completed: true };
                }
                return h;
              }),
            };
            if (matchedLabel) {
              nextLife = { ...nextLife, weeklyMetrics: syncTodayRow(nextLife) };
              badges.push({
                type: act.type,
                badgeText: act.label || `Completed: ${matchedLabel}`,
              });
            }
          } else if (act.type === "ADD_HABIT" && (act.title || act.label)) {
            const habitLabel = (act.title || act.label).replace(/^Habit:\s*/i, "").trim();
            if (habitLabel) {
              const exists = nextLife.habits.some(
                (h) => h.label.toLowerCase() === habitLabel.toLowerCase()
              );
              if (!exists) {
                nextLife = {
                  ...nextLife,
                  habits: [
                    ...nextLife.habits,
                    {
                      id: `h-${uid}`,
                      label: habitLabel,
                      completed: false,
                      isCustom: true,
                    },
                  ],
                };
                nextLife = { ...nextLife, weeklyMetrics: syncTodayRow(nextLife) };
                badges.push({
                  type: act.type,
                  badgeText: act.label || `Added habit: ${habitLabel}`,
                });
              }
            }
          } else if (act.type === "SAVE_NOTE" && (act.noteContent || act.title)) {
            const allowedTags: SpecificBrainTag[] = [
              "Personal",
              "My content",
              "Client work",
              "Ideas",
              "Learning",
            ];
            const tag: SpecificBrainTag = allowedTags.includes(act.tag as SpecificBrainTag)
              ? (act.tag as SpecificBrainTag)
              : "Ideas";
            const raw = (act.noteContent || act.title || "").trim();
            const title = (act.title || raw.slice(0, 48)).trim();
            const newNote: BrainNote = {
              id: `note-${uid}`,
              title,
              rawContent: raw,
              summary: raw,
              tag,
              suggestedPlatform: "YouTube",
              createdAt: nowIso,
              pendingAiEnrich: !isOnline,
            };
            nextBrain = { ...nextBrain, notes: [newNote, ...nextBrain.notes] };
            if (!isOnline) {
              nextOfflineQueue = [
                ...nextOfflineQueue,
                {
                  id: `oq-note-${uid}`,
                  kind: "AI_ENRICH_NOTE",
                  label: `AI-tag note: ${title.slice(0, 36)}`,
                  payload: { noteId: newNote.id, rawContent: raw },
                  createdAt: nowIso,
                },
              ];
            }
            badges.push({
              type: act.type,
              badgeText: act.label || `Saved note to Second Brain (${tag})`,
            });
          } else if (act.type === "SAVE_MEMORY" && (act.title || act.noteContent)) {
            const allowedCats: MemoryCategory[] = ["Personal", "Goals", "Projects", "Skills"];
            const cat: MemoryCategory = allowedCats.includes(act.memoryCategory as MemoryCategory)
              ? (act.memoryCategory as MemoryCategory)
              : "Personal";
            const content = (act.title || act.noteContent || "").trim();
            nextBestie = {
              ...nextBestie,
              memories: [
                {
                  id: `mem-${uid}`,
                  category: cat,
                  content,
                  createdAt: nowIso,
                },
                ...nextBestie.memories,
              ],
            };
            badges.push({
              type: act.type,
              badgeText: act.label || `Saved to Memory Vault (${cat})`,
            });
          }
        });

        return {
          ...prev,
          life: nextLife,
          brain: nextBrain,
          bestie: nextBestie,
          offlineQueue: nextOfflineQueue,
        };
      });

      return badges;
    },
    [setState, isOnline]
  );

  // Studio context snapshot injected into Bestie & VA prompts
  const studioContext = useMemo(() => {
    const completedHabits = state.life.habits.filter((h) => h.completed).length;
    const openTasks = state.brain.tasks.filter((t) => !t.completed).slice(0, 6);
    const ngnNet = state.life.moneyEntries
      .filter((e) => e.currency === "NGN")
      .reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);
    const usdNet = state.life.moneyEntries
      .filter((e) => e.currency === "USD")
      .reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);

    return {
      userName: state.userProfile.name || state.life.creatorName,
      userRoles: state.userProfile.roles,
      userFocus: state.userProfile.focus,
      habitsCompleted: `${completedHabits}/${state.life.habits.length}`,
      habitNames: state.life.habits.map((h) => `${h.label} (${h.completed ? "done" : "open"})`),
      waterGlasses: `${state.life.waterGlasses}/${state.life.waterTarget}`,
      sleepHours: state.life.sleepHours,
      postsToday: `${state.life.postsToday}/${state.life.postsTarget}`,
      ngnNet,
      usdNet,
      openTasks: openTasks.map((t) => t.title),
      deliverablesCount: state.life.deliverables.length,
    };
  }, [
    state.life,
    state.brain.tasks,
    state.userProfile.name,
    state.userProfile.roles,
    state.userProfile.focus,
  ]);

  const handleBestiePersonality = (personality: BestiePersonality) => {
    setState((prev) => ({
      ...prev,
      bestie: { ...prev.bestie, personality },
    }));
  };

  const handleBestieMessages = (params: {
    userMessage: BestieMessage;
    assistantMessage: BestieMessage;
  }) => {
    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        messages: [...prev.bestie.messages, params.userMessage, params.assistantMessage],
      },
    }));
  };

  const handleUpdateMessageDraft = (messageId: string, nextDraft: EmailDraft) => {
    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        messages: prev.bestie.messages.map((m) =>
          m.id === messageId ? { ...m, emailDraft: nextDraft } : m
        ),
      },
    }));
  };

  const handleClearBestieChat = () => {
    setState((prev) => ({
      ...prev,
      dailyInterview: {
        ...prev.dailyInterview,
        completed: true,
        step: 5,
      },
      bestie: {
        ...prev.bestie,
        messages: [],
      },
    }));
  };

  const handleAddMemory = (category: MemoryCategory, content: string) => {
    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        memories: [
          {
            id: `mem-${Date.now()}`,
            category,
            content,
            createdAt: new Date().toISOString(),
          },
          ...prev.bestie.memories,
        ],
      },
    }));
  };

  const handleUpdateMemory = (id: string, content: string) => {
    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        memories: prev.bestie.memories.map((m) =>
          m.id === id ? { ...m, content } : m
        ),
      },
    }));
  };

  const handleDeleteMemory = (id: string) => {
    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        memories: prev.bestie.memories.filter((m) => m.id !== id),
      },
    }));
  };

  const handleSaveScanResult = (payload: {
    executiveSummary: string;
    emails: ScannedEmail[];
    calendarEvents: CalendarEventItem[];
  }) => {
    setState((prev) => ({
      ...prev,
      bestie: {
        ...prev.bestie,
        lastInboxSummary: payload.executiveSummary,
        scannedEmails: payload.emails,
        calendarEvents: payload.calendarEvents,
        lastScannedAt: new Date().toISOString(),
      },
    }));
    pushNotification({
      triggerKey: `inbox-scan-${Date.now()}`,
      title: "Inbox & Calendar Briefed",
      message: `Scanned ${payload.emails.length} emails and ${payload.calendarEvents.length} upcoming events.`,
      accentColor: "#F26B5B",
      tab: "bestie",
      severity: "info",
      dedupe: false,
    });
  };

  const handleConvertEmailToTask = (email: ScannedEmail) => {
    if (email.taskAdded) return;
    const taskTitle = email.suggestedTask || `Reply to ${email.from}: ${email.subject}`;
    const newTask: BrainTask = {
      id: `task-email-${Date.now()}`,
      title: taskTitle,
      tag: "Client work",
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      brain: {
        ...prev.brain,
        tasks: [newTask, ...prev.brain.tasks],
      },
      bestie: {
        ...prev.bestie,
        scannedEmails: prev.bestie.scannedEmails.map((em) =>
          em.id === email.id ? { ...em, taskAdded: true } : em
        ),
      },
    }));
    pushNotification({
      triggerKey: `email-task-${email.id}`,
      title: "Email Converted to Task",
      message: `Added "${taskTitle}" to Second Brain Tasks.`,
      accentColor: "#0EA5E9",
      tab: "brain",
      severity: "success",
      dedupe: false,
    });
  };

  const handleEmailSentSuccess = (draft: EmailDraft) => {
    pushNotification({
      triggerKey: `email-sent-${draft.id}`,
      title: "Email Sent via Gmail",
      message: `Sent "${draft.subject}" to ${draft.to}.`,
      accentColor: "#10B981",
      tab: "bestie",
      severity: "success",
      dedupe: false,
    });
  };

  const handlePromoteNoteToEditDesk = (note: BrainNote) => {
    if (note.promotedToCardId) {
      setState((prev) => ({ ...prev, activeTab: "editdesk" }));
      return;
    }

    const nowIso = new Date().toISOString();
    const cardId = `card-${Date.now()}`;
    const newCard: EditCard = {
      id: cardId,
      title: note.title,
      platform: note.suggestedPlatform,
      stage: "Brief",
      hook: note.summary,
      concept: note.rawContent,
      cutSheet: [
        {
          id: `cs-${Date.now()}-1`,
          timestamp: "0:00 - 0:05",
          bRoll: "Opening visual contrast / pattern interrupt",
          onScreenText: note.title,
          audioNotes: "Crisp voiceover hook",
        },
      ],
      captions: {
        primary: note.summary,
        shortAlt: note.title,
        hashtags: ["#CreatorStudio", `#${note.suggestedPlatform}`],
      },
      sourceNoteId: note.id,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setState((prev) => ({
      ...prev,
      activeTab: "editdesk",
      brain: {
        ...prev.brain,
        notes: prev.brain.notes.map((n) =>
          n.id === note.id ? { ...n, promotedToCardId: cardId } : n
        ),
      },
      editDesk: {
        ...prev.editDesk,
        cards: [newCard, ...prev.editDesk.cards],
      },
    }));

    pushNotification({
      triggerKey: `promote-${note.id}`,
      title: "Promoted to Edit Desk",
      message: `"${note.title}" added to Brief column for ${note.suggestedPlatform}.`,
      accentColor: "#F59E0B",
      tab: "editdesk",
      severity: "info",
      dedupe: false,
    });
  };

  const handleSyncPostToDashboard = (card: EditCard) => {
    if (card.syncedPost) return;
    const todayKey = formatDateKey(new Date());

    setState((prev) => {
      const nextPosts = prev.life.postsToday + 1;
      const doneCount = prev.life.habits.filter((h) => h.completed).length;
      const updatedWeekly = prev.life.weeklyMetrics.map((point, idx) => {
        const isLast = idx === prev.life.weeklyMetrics.length - 1;
        if (point.dateKey === todayKey || isLast) {
          return {
            ...point,
            dayLabel: "Today",
            dateKey: todayKey,
            posts: nextPosts,
            audienceGrowth:
              nextPosts > 0 || doneCount > 0 ? nextPosts * 100 + doneCount * 15 : 0,
          };
        }
        return point;
      });

      return {
        ...prev,
        life: {
          ...prev.life,
          postsToday: nextPosts,
          weeklyMetrics: updatedWeekly,
        },
        editDesk: {
          ...prev.editDesk,
          cards: prev.editDesk.cards.map((c) =>
            c.id === card.id ? { ...c, syncedPost: true } : c
          ),
        },
      };
    });

    pushNotification({
      triggerKey: `sync-post-${card.id}`,
      title: "Posts Today Incremented",
      message: `Logged "${card.title}" to your Life Dashboard daily posts.`,
      accentColor: "#10B981",
      tab: "life",
      severity: "success",
      dedupe: false,
    });
  };

  // First-time Welcome Onboarding Quiz when userProfile is not completed yet
  if (!state.userProfile.onboardingCompleted) {
    return (
      <>
        <WelcomeOnboardingCard
          theme={state.theme}
          googleUser={googleUser}
          hasGoogleToken={hasGoogleToken}
          connectingGoogle={connectingGoogle}
          isOnline={isOnline}
          onToggleTheme={handleToggleTheme}
          onConnectGoogle={handleConnectGoogle}
          onCompleteOnboarding={handleCompleteOnboarding}
        />
        <GoogleSettingsModal
          open={googleModalOpen}
          clientIdOverride={state.googleClientIdOverride}
          googleUser={googleUser}
          hasAccessToken={hasGoogleToken}
          connecting={connectingGoogle}
          authError={googleAuthError}
          onClose={() => setGoogleModalOpen(false)}
          onSaveClientId={(nextClientId) => {
            setState((prev) => ({ ...prev, googleClientIdOverride: nextClientId }));
          }}
          onConnect={() => void handleConnectGoogle()}
          onDisconnect={() => void handleDisconnectGoogle()}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] transition-colors duration-200">
      <Sidebar
        activeTab={state.activeTab}
        visibleTabs={state.userProfile.visibleTabs}
        collapsed={state.sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onSelectTab={handleSelectTab}
        onToggleCollapse={handleToggleSidebar}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenCustomizeTabs={() => setCustomizeTabsOpen(true)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={state.activeTab}
          theme={state.theme}
          notifications={state.notifications}
          googleUser={googleUser}
          hasGoogleToken={hasGoogleToken}
          connectingGoogle={connectingGoogle}
          isOnline={isOnline}
          offlineQueue={state.offlineQueue}
          syncingQueue={syncingQueue}
          onSyncOfflineQueue={() => void syncOfflineQueue()}
          onClearOfflineQueue={() =>
            setState((prev) => ({ ...prev, offlineQueue: [] }))
          }
          onToggleTheme={handleToggleTheme}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onResetAllData={handleResetAllData}
          onOpenCustomizeTabs={() => setCustomizeTabsOpen(true)}
          onMarkAllRead={() =>
            setState((prev) => ({
              ...prev,
              notifications: prev.notifications.map((n) => ({ ...n, read: true })),
            }))
          }
          onClearNotifications={() =>
            setState((prev) => ({ ...prev, notifications: [] }))
          }
          onNavigateTab={handleSelectTab}
          onConnectGoogle={() => void handleConnectGoogle()}
          onOpenGoogleSettings={() => setGoogleModalOpen(true)}
          onOpenSecuritySettings={() => setSecurityModalOpen(true)}
          hasPersonalGeminiKey={hasPersonalGeminiKey}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 max-w-[1400px] w-full mx-auto">
          {state.activeTab === "bestie" && (
            <BestieWorkspace
              bestie={state.bestie}
              studioContext={studioContext}
              hasGoogleToken={hasGoogleToken}
              isOnline={isOnline}
              userName={state.userProfile.name || state.life.creatorName}
              onTriggerMorningGreeting={() =>
                void triggerMorningBestieGreeting({
                  forceRestart: true,
                  openDrawerIfNotOnTab: false,
                })
              }
              onOpenSecuritySettings={() => setSecurityModalOpen(true)}
              onChangePersonality={handleBestiePersonality}
              onSendMessageResult={handleBestieMessages}
              onExecuteActions={handleExecuteBestieActions}
              onUpdateMessageDraft={handleUpdateMessageDraft}
              onClearChat={handleClearBestieChat}
              onAddMemory={handleAddMemory}
              onUpdateMemory={handleUpdateMemory}
              onDeleteMemory={handleDeleteMemory}
              onConnectGoogle={() => void handleConnectGoogle()}
              onSaveScanResult={handleSaveScanResult}
              onConvertEmailToTask={handleConvertEmailToTask}
              onEmailSentSuccess={handleEmailSentSuccess}
              onQueueOfflineEmail={handleQueueOfflineEmail}
            />
          )}

          {state.activeTab === "life" && (
            <LifeDashboard
              life={state.life}
              onUpdateLife={(updater) =>
                setState((prev) => ({ ...prev, life: updater(prev.life) }))
              }
              onTriggerAlert={pushNotification}
            />
          )}

          {state.activeTab === "academy" && (
            <AcademyWorkspace
              academy={state.academy}
              memories={state.bestie.memories}
              userRoles={state.userProfile.roles}
              isOnline={isOnline}
              onUpdateAcademy={(updater) =>
                setState((prev) => ({ ...prev, academy: updater(prev.academy) }))
              }
            />
          )}

          {state.activeTab === "brain" && (
            <SecondBrain
              notes={state.brain.notes}
              tasks={state.brain.tasks}
              chatHistory={state.brain.chatHistory}
              isOnline={isOnline}
              onUpdateBrain={(updater) =>
                setState((prev) => ({ ...prev, brain: updater(prev.brain) }))
              }
              onPromoteNoteToEditDesk={handlePromoteNoteToEditDesk}
              onQueueOfflineNoteEnrich={handleQueueOfflineNoteEnrich}
            />
          )}

          {state.activeTab === "editdesk" && (
            <EditDesk
              cards={state.editDesk.cards}
              onUpdateCards={(updater) =>
                setState((prev) => ({
                  ...prev,
                  editDesk: { ...prev.editDesk, cards: updater(prev.editDesk.cards) },
                }))
              }
              onSyncPostToDashboard={handleSyncPostToDashboard}
              onTriggerAlert={pushNotification}
            />
          )}

          {state.activeTab === "media" && (
            <MediaStudioWorkspace
              media={state.media}
              isOnline={isOnline}
              onUpdateMedia={(updater) =>
                setState((prev) => ({ ...prev, media: updater(prev.media) }))
              }
            />
          )}

          {state.activeTab === "gameroom" && (
            <GameRoomWorkspace
              gameRoom={state.gameRoom}
              notes={state.brain.notes}
              lessons={state.academy.lessons}
              isOnline={isOnline}
              onUpdateGameRoom={(updater) =>
                setState((prev) => ({
                  ...prev,
                  gameRoom: updater(prev.gameRoom),
                }))
              }
            />
          )}
        </main>
      </div>

      {/* Floating 'Chat with Bestie' Quick-Drawer accessible on every tab */}
      <FloatingBestieDrawer
        open={bestieDrawerOpen}
        onOpenChange={handleOpenBestieDrawerChange}
        bestie={state.bestie}
        studioContext={studioContext}
        hasGoogleToken={hasGoogleToken}
        isOnline={isOnline}
        isOnBestieTab={state.activeTab === "bestie"}
        userName={state.userProfile.name || state.life.creatorName}
        onTriggerMorningGreeting={() =>
          void triggerMorningBestieGreeting({
            forceRestart: true,
            openDrawerIfNotOnTab: false,
          })
        }
        onOpenSecuritySettings={() => setSecurityModalOpen(true)}
        onChangePersonality={handleBestiePersonality}
        onSendMessageResult={handleBestieMessages}
        onExecuteActions={handleExecuteBestieActions}
        onUpdateMessageDraft={handleUpdateMessageDraft}
        onClearChat={handleClearBestieChat}
        onAddMemory={handleAddMemory}
        onUpdateMemory={handleUpdateMemory}
        onDeleteMemory={handleDeleteMemory}
        onConnectGoogle={() => void handleConnectGoogle()}
        onEmailSentSuccess={handleEmailSentSuccess}
        onQueueOfflineEmail={handleQueueOfflineEmail}
        onOpenFullTab={() => handleSelectTab("bestie")}
      />

      <CustomizeTabsModal
        open={customizeTabsOpen}
        visibleTabs={state.userProfile.visibleTabs}
        currentRoles={state.userProfile.roles}
        onToggleTab={handleToggleVisibleTab}
        onApplyPreset={handleApplyTabPreset}
        onClose={() => setCustomizeTabsOpen(false)}
      />

      <GoogleSettingsModal
        open={googleModalOpen}
        clientIdOverride={state.googleClientIdOverride}
        googleUser={googleUser}
        hasAccessToken={hasGoogleToken}
        connecting={connectingGoogle}
        authError={googleAuthError}
        onClose={() => setGoogleModalOpen(false)}
        onSaveClientId={(nextClientId) => {
          setState((prev) => ({ ...prev, googleClientIdOverride: nextClientId }));
          pushNotification({
            triggerKey: `oauth-client-id-${Date.now()}`,
            title: "OAuth Client ID Updated",
            message: nextClientId
              ? "Saved custom Google OAuth Client ID."
              : "Reset to StudioOS default OAuth Client ID.",
            accentColor: "#F26B5B",
            tab: state.activeTab,
            severity: "info",
            dedupe: false,
          });
        }}
        onConnect={() => void handleConnectGoogle()}
        onDisconnect={() => void handleDisconnectGoogle()}
      />

      <SecurityPrivacyModal
        open={securityModalOpen}
        isOnline={isOnline}
        googleUser={googleUser}
        hasGoogleToken={hasGoogleToken}
        cachedEmailCount={state.bestie.scannedEmails.length}
        cachedEventCount={state.bestie.calendarEvents.length}
        onClose={() => setSecurityModalOpen(false)}
        onDisconnectAndWipeEmails={handleDisconnectGoogleAndWipeEmails}
        onOpenGoogleSettings={() => setGoogleModalOpen(true)}
        onExportJson={handleExportJson}
      />

      <NotificationToast toasts={activeToasts} onDismiss={dismissToast} />
    </div>
  );
}
