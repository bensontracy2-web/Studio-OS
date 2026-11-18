import React from "react";
import type {
  Deliverable,
  DeliverableStatus,
  LifeDashboardState,
  MoneyEntry,
  TabId,
} from "../../types/studio";
import { formatDateKey } from "../../data/initialState";
import { GreetingAndHabits } from "./GreetingAndHabits";
import { DeliverablesCard } from "./DeliverablesCard";
import { MoneyTrackerCard } from "./MoneyTrackerCard";
import { AnalyticsAndMatrixCard } from "./AnalyticsAndMatrixCard";

interface LifeDashboardProps {
  life: LifeDashboardState;
  onUpdateLife: (updater: (prev: LifeDashboardState) => LifeDashboardState) => void;
  onTriggerAlert: (payload: {
    triggerKey: string;
    title: string;
    message: string;
    accentColor: string;
    tab: TabId;
    severity: "success" | "info" | "warning";
    dedupe?: boolean;
  }) => void;
}

export const LifeDashboard: React.FC<LifeDashboardProps> = ({
  life,
  onUpdateLife,
  onTriggerAlert,
}) => {
  const syncTodayMetric = (
    nextLife: LifeDashboardState,
    todayKey: string
  ): LifeDashboardState => {
    const doneCount = nextLife.habits.filter((h) => h.completed).length;
    const habitRate =
      nextLife.habits.length > 0
        ? Math.round((doneCount / nextLife.habits.length) * 100)
        : 0;
    const habitMap = Object.fromEntries(
      nextLife.habits.map((h) => [h.id, h.completed])
    );

    const updatedWeekly = nextLife.weeklyMetrics.map((point, idx) => {
      const isLast = idx === nextLife.weeklyMetrics.length - 1;
      if (point.dateKey === todayKey || isLast) {
        return {
          ...point,
          dayLabel: "Today",
          dateKey: todayKey,
          posts: nextLife.postsToday,
          audienceGrowth: 180 + nextLife.postsToday * 135 + doneCount * 20,
          habitRate,
          habitMap,
        };
      }
      return point;
    });

    return { ...nextLife, weeklyMetrics: updatedWeekly };
  };

  const handleToggleHabit = (id: string) => {
    const todayKey = formatDateKey(new Date());
    onUpdateLife((prev) => {
      const nextHabits = prev.habits.map((h) =>
        h.id === id ? { ...h, completed: !h.completed } : h
      );
      return syncTodayMetric({ ...prev, habits: nextHabits }, todayKey);
    });
  };

  const handleAddHabit = (label: string) => {
    const todayKey = formatDateKey(new Date());
    const newId = `h-${Date.now()}`;
    onUpdateLife((prev) => {
      const nextHabits = [
        ...prev.habits,
        { id: newId, label, completed: false, isCustom: true },
      ];
      return syncTodayMetric({ ...prev, habits: nextHabits }, todayKey);
    });
  };

  const handleRemoveHabit = (id: string) => {
    const todayKey = formatDateKey(new Date());
    onUpdateLife((prev) => {
      const nextHabits = prev.habits.filter((h) => h.id !== id);
      return syncTodayMetric({ ...prev, habits: nextHabits }, todayKey);
    });
  };

  const handleUpdateCounter = (
    field: "waterGlasses" | "sleepHours" | "postsToday",
    delta: number
  ) => {
    const todayKey = formatDateKey(new Date());
    onUpdateLife((prev) => {
      const raw = Number((prev[field] + delta).toFixed(1));
      const clamped =
        field === "sleepHours"
          ? Math.max(0, Math.min(24, raw))
          : Math.max(0, Math.round(raw));
      const next = { ...prev, [field]: clamped };
      return field === "postsToday" ? syncTodayMetric(next, todayKey) : next;
    });
  };

  const handleUpdateName = (creatorName: string) => {
    onUpdateLife((prev) => ({ ...prev, creatorName }));
  };

  const handleAddDeliverable = (item: Omit<Deliverable, "id">) => {
    const newItem: Deliverable = {
      ...item,
      id: `del-${Date.now()}`,
    };
    onUpdateLife((prev) => ({
      ...prev,
      deliverables: [newItem, ...prev.deliverables],
    }));
  };

  const handleCycleStatus = (id: string) => {
    const order: DeliverableStatus[] = ["This week", "In progress", "Ready"];
    onUpdateLife((prev) => {
      const nextDeliverables = prev.deliverables.map((d) => {
        if (d.id !== id) return d;
        const nextStatus = order[(order.indexOf(d.status) + 1) % order.length];
        if (nextStatus === "Ready") {
          onTriggerAlert({
            triggerKey: `deliverable-ready-${d.id}-${Date.now()}`,
            title: "Deliverable Ready to Ship",
            message: `"${d.title}" is marked Ready.`,
            accentColor: "#10B981",
            tab: "life",
            severity: "success",
            dedupe: false,
          });
        }
        return { ...d, status: nextStatus };
      });
      return { ...prev, deliverables: nextDeliverables };
    });
  };

  const handleDeleteDeliverable = (id: string) => {
    onUpdateLife((prev) => ({
      ...prev,
      deliverables: prev.deliverables.filter((d) => d.id !== id),
    }));
  };

  const handleAddMoneyEntry = (entry: Omit<MoneyEntry, "id">) => {
    const newEntry: MoneyEntry = { ...entry, id: `mon-${Date.now()}` };
    onUpdateLife((prev) => ({
      ...prev,
      moneyEntries: [newEntry, ...prev.moneyEntries],
    }));
  };

  const handleDeleteMoneyEntry = (id: string) => {
    onUpdateLife((prev) => ({
      ...prev,
      moneyEntries: prev.moneyEntries.filter((m) => m.id !== id),
    }));
  };

  const handleUpdateGoal = (monthlyGoalUSD: number, ngnPerUsd: number) => {
    onUpdateLife((prev) => ({ ...prev, monthlyGoalUSD, ngnPerUsd }));
  };

  const handleToggleMatrixDot = (dateKey: string, habitId: string) => {
    const todayKey = formatDateKey(new Date());
    if (dateKey === todayKey) {
      handleToggleHabit(habitId);
      return;
    }

    onUpdateLife((prev) => {
      const updated = prev.weeklyMetrics.map((point) => {
        if (point.dateKey !== dateKey) return point;
        const nextMap = {
          ...point.habitMap,
          [habitId]: !point.habitMap?.[habitId],
        };
        const doneCount = prev.habits.filter((h) => nextMap[h.id]).length;
        const habitRate =
          prev.habits.length > 0
            ? Math.round((doneCount / prev.habits.length) * 100)
            : 0;
        return { ...point, habitMap: nextMap, habitRate };
      });
      return { ...prev, weeklyMetrics: updated };
    });
  };

  return (
    <div className="space-y-6">
      <GreetingAndHabits
        life={life}
        onToggleHabit={handleToggleHabit}
        onAddHabit={handleAddHabit}
        onRemoveHabit={handleRemoveHabit}
        onUpdateCounter={handleUpdateCounter}
        onUpdateName={handleUpdateName}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DeliverablesCard
          deliverables={life.deliverables}
          onAddDeliverable={handleAddDeliverable}
          onCycleStatus={handleCycleStatus}
          onDeleteDeliverable={handleDeleteDeliverable}
        />

        <MoneyTrackerCard
          entries={life.moneyEntries}
          monthlyGoalUSD={life.monthlyGoalUSD}
          ngnPerUsd={life.ngnPerUsd}
          onAddEntry={handleAddMoneyEntry}
          onDeleteEntry={handleDeleteMoneyEntry}
          onUpdateGoal={handleUpdateGoal}
        />
      </div>

      <AnalyticsAndMatrixCard
        weeklyMetrics={life.weeklyMetrics}
        habits={life.habits}
        onToggleMatrixDot={handleToggleMatrixDot}
      />
    </div>
  );
};
