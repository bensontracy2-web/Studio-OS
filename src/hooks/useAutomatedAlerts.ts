import { useEffect, useRef, useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { StudioNotification, StudioState, TabId } from "../types/studio";

export function useAutomatedAlerts(
  state: StudioState,
  setState: Dispatch<SetStateAction<StudioState>>
) {
  const [activeToasts, setActiveToasts] = useState<StudioNotification[]>([]);
  const firedKeysRef = useRef<Set<string>>(
    new Set(state.notifications.map((n) => n.triggerKey))
  );

  const pushNotification = useCallback(
    (payload: {
      triggerKey: string;
      title: string;
      message: string;
      accentColor: string;
      tab: TabId;
      severity: "success" | "info" | "warning";
      dedupe?: boolean;
    }) => {
      if (payload.dedupe !== false && firedKeysRef.current.has(payload.triggerKey)) {
        return;
      }
      firedKeysRef.current.add(payload.triggerKey);

      const notif: StudioNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        triggerKey: payload.triggerKey,
        title: payload.title,
        message: payload.message,
        accentColor: payload.accentColor,
        tab: payload.tab,
        severity: payload.severity,
        createdAt: new Date().toISOString(),
        read: false,
      };

      setState((prev) => ({
        ...prev,
        notifications: [notif, ...prev.notifications].slice(0, 30),
      }));

      setActiveToasts((prev) => [notif, ...prev].slice(0, 3));
      window.setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== notif.id));
      }, 4500);
    },
    [setState]
  );

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Monitor real-time progress analytics & fire automated milestone alerts
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);

    // 1. 100% Daily Habits Completed
    const totalHabits = state.life.habits.length;
    const completedHabits = state.life.habits.filter((h) => h.completed).length;
    if (totalHabits > 0 && completedHabits === totalHabits) {
      pushNotification({
        triggerKey: `habits-100-${todayKey}`,
        title: "Daily Habit Sweep Complete",
        message: `All ${totalHabits} daily check-in habits are marked done today.`,
        accentColor: "#10B981",
        tab: "life",
        severity: "success",
      });
    }

    // 2. Hydration Goal Reached
    if (state.life.waterGlasses >= state.life.waterTarget && state.life.waterTarget > 0) {
      pushNotification({
        triggerKey: `water-goal-${todayKey}`,
        title: "Hydration Target Hit",
        message: `You reached ${state.life.waterGlasses}/${state.life.waterTarget} glasses of water today.`,
        accentColor: "#10B981",
        tab: "life",
        severity: "success",
      });
    }

    // 3. Posts Today Target Reached
    if (state.life.postsToday >= state.life.postsTarget && state.life.postsTarget > 0) {
      pushNotification({
        triggerKey: `posts-goal-${todayKey}`,
        title: "Daily Publishing Target Met",
        message: `${state.life.postsToday} posts logged today — keeping your 7-day momentum green.`,
        accentColor: "#FACC15",
        tab: "life",
        severity: "success",
      });
    }

    // 4. Low Sleep Warning
    if (state.life.sleepHours > 0 && state.life.sleepHours < 6) {
      pushNotification({
        triggerKey: `sleep-low-${todayKey}`,
        title: "Recovery Alert: Low Sleep",
        message: `Logged ${state.life.sleepHours}h sleep. Consider lightening deep-work blocks today.`,
        accentColor: "#F59E0B",
        tab: "life",
        severity: "warning",
      });
    }

    // 5. Dual-currency Monthly Goal Milestone (50% / 100%)
    const netUSD = state.life.moneyEntries.reduce((acc, entry) => {
      const signed = entry.type === "income" ? entry.amount : -entry.amount;
      const usdVal = entry.currency === "USD" ? signed : signed / Math.max(1, state.life.ngnPerUsd);
      return acc + usdVal;
    }, 0);
    const goalPct = state.life.monthlyGoalUSD > 0 ? (netUSD / state.life.monthlyGoalUSD) * 100 : 0;
    if (goalPct >= 100) {
      pushNotification({
        triggerKey: `money-100-${todayKey.slice(0, 7)}`,
        title: "Monthly Revenue Goal Reached",
        message: `Net monthly revenue crossed 100% of your $${state.life.monthlyGoalUSD.toLocaleString()} target.`,
        accentColor: "#10B981",
        tab: "life",
        severity: "success",
      });
    } else if (goalPct >= 75) {
      pushNotification({
        triggerKey: `money-75-${todayKey.slice(0, 7)}`,
        title: "75% Monthly Goal Milestone",
        message: `You're at ${Math.round(goalPct)}% of your $${state.life.monthlyGoalUSD.toLocaleString()} monthly revenue goal.`,
        accentColor: "#FACC15",
        tab: "life",
        severity: "info",
      });
    }
  }, [
    state.life.habits,
    state.life.waterGlasses,
    state.life.waterTarget,
    state.life.postsToday,
    state.life.postsTarget,
    state.life.sleepHours,
    state.life.moneyEntries,
    state.life.monthlyGoalUSD,
    state.life.ngnPerUsd,
    pushNotification,
  ]);

  return { activeToasts, pushNotification, dismissToast };
}
