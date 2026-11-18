import React, { useEffect, useState } from "react";
import {
  Check,
  Plus,
  Minus,
  X,
  Droplets,
  Moon,
  Send,
  Pencil,
} from "lucide-react";
import type { HabitPill, LifeDashboardState } from "../../types/studio";

interface GreetingAndHabitsProps {
  life: LifeDashboardState;
  onToggleHabit: (id: string) => void;
  onAddHabit: (label: string) => void;
  onRemoveHabit: (id: string) => void;
  onUpdateCounter: (field: "waterGlasses" | "sleepHours" | "postsToday", delta: number) => void;
  onUpdateName: (name: string) => void;
}

export const GreetingAndHabits: React.FC<GreetingAndHabitsProps> = ({
  life,
  onToggleHabit,
  onAddHabit,
  onRemoveHabit,
  onUpdateCounter,
  onUpdateName,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [newHabitText, setNewHabitText] = useState("");
  const [addingHabit, setAddingHabit] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(life.creatorName);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const completedCount = life.habits.filter((h) => h.completed).length;
  const totalCount = life.habits.length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHabitText.trim();
    if (!trimmed) return;
    onAddHabit(trimmed);
    setNewHabitText("");
    setAddingHabit(false);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (trimmed) onUpdateName(trimmed);
    setEditingName(false);
  };

  return (
    <section className="space-y-5">
      {/* Live Greeting & Daily Habit Counter Card */}
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#059669] dark:text-[#10B981]">
              {formattedDate} · <span className="font-mono tabular-nums">{formattedTime}</span>
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1E1E1E] dark:text-[#F5F2EC] text-balance">
                {greeting},{" "}
                {editingName ? (
                  <form onSubmit={handleSaveName} className="inline-flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoFocus
                      maxLength={24}
                      className="w-36 rounded-lg border border-[#10B981] bg-[#FAF7F2] dark:bg-[#161513] px-2 py-0.5 text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#10B981] px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(life.creatorName);
                      setEditingName(true);
                    }}
                    title="Click to personalize your name"
                    className="inline-flex items-center gap-1.5 underline decoration-[#FACC15] decoration-2 underline-offset-4 hover:opacity-80"
                  >
                    <span>{life.creatorName || "Friend"}</span>
                    <Pencil className="h-3.5 w-3.5 text-[#8C857B]" />
                  </button>
                )}
              </h2>
            </div>
          </div>

          {/* Daily Habit Completion Counter */}
          <div className="flex flex-col sm:items-end gap-1.5 min-w-[210px]">
            <div className="flex items-baseline justify-between sm:justify-end gap-3 w-full">
              <span className="text-xs font-medium text-[#64605A] dark:text-[#A69F96]">
                Daily Habit Completion
              </span>
              <span className="font-mono text-lg font-bold text-[#1E1E1E] dark:text-[#F5F2EC] tabular-nums">
                {completedCount}/{totalCount}{" "}
                <span className="text-sm font-semibold text-[#059669] dark:text-[#10B981]">
                  ({completionPct}%)
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${completionPct}%`,
                  background: "linear-gradient(90deg, #FACC15 0%, #10B981 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Customizable Check-In Pills */}
        <div className="mt-5 pt-5 border-t border-[#E8E2D8] dark:border-[#322E29]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-[#5C5750] dark:text-[#A69F96]">
              Daily Check-In Habits
            </h3>
            <button
              type="button"
              onClick={() => setAddingHabit((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#1E1E1E] bg-[#FACC15] hover:bg-[#eab308] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Habit
            </button>
          </div>

          {addingHabit && (
            <form onSubmit={handleAddHabitSubmit} className="mb-3 flex items-center gap-2">
              <input
                type="text"
                value={newHabitText}
                onChange={(e) => setNewHabitText(e.target.value)}
                placeholder="e.g., Film 1 talking-head clip"
                className="flex-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#10B981] focus:outline-none"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#10B981] px-4 text-xs font-semibold text-white hover:bg-[#059669] transition-colors whitespace-nowrap"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingHabit(false)}
                className="h-9 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-medium text-[#5C5750] dark:text-[#A69F96]"
              >
                Cancel
              </button>
            </form>
          )}

          {life.habits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] px-4 py-4 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
              No daily habits yet — tap <strong>+ Add Habit</strong> above or let Bestie set them up with you.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {life.habits.map((habit: HabitPill) => (
                <div
                  key={habit.id}
                  className={`group inline-flex items-center rounded-xl border transition-all duration-150 ${
                    habit.completed
                      ? "border-[#10B981] bg-[#10B981]/12 dark:bg-[#10B981]/20 text-[#065F46] dark:text-[#A7F3D0]"
                      : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#FACC15]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleHabit(habit.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        habit.completed
                          ? "border-[#10B981] bg-[#10B981] text-white"
                          : "border-[#C7BFB3] dark:border-[#49433B] bg-white dark:bg-[#22201D]"
                      }`}
                    >
                      {habit.completed && <Check className="h-3 w-3 stroke-[3]" />}
                    </span>
                    <span className={habit.completed ? "line-through decoration-[#10B981]/60" : ""}>
                      {habit.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveHabit(habit.id)}
                    aria-label={`Remove ${habit.label}`}
                    className="pr-2 pl-0.5 py-2 text-[#8C857B] hover:text-[#DC2626] opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3 Daily Metric Steppers: Water, Sleep, Posts Today */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StepperCard
          icon={Droplets}
          label="Water Intake"
          value={life.waterGlasses}
          unit="glasses"
          target={life.waterTarget}
          accentHex="#10B981"
          onDecrement={() => onUpdateCounter("waterGlasses", -1)}
          onIncrement={() => onUpdateCounter("waterGlasses", 1)}
        />
        <StepperCard
          icon={Moon}
          label="Sleep"
          value={life.sleepHours}
          unit="hrs"
          target={life.sleepTarget}
          accentHex="#FACC15"
          onDecrement={() => onUpdateCounter("sleepHours", -0.5)}
          onIncrement={() => onUpdateCounter("sleepHours", 0.5)}
        />
        <StepperCard
          icon={Send}
          label="Posts Today"
          value={life.postsToday}
          unit="posts"
          target={life.postsTarget}
          accentHex="#10B981"
          onDecrement={() => onUpdateCounter("postsToday", -1)}
          onIncrement={() => onUpdateCounter("postsToday", 1)}
        />
      </div>
    </section>
  );
};

interface StepperCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  unit: string;
  target: number;
  accentHex: string;
  onDecrement: () => void;
  onIncrement: () => void;
}

const StepperCard: React.FC<StepperCardProps> = ({
  icon: Icon,
  label,
  value,
  unit,
  target,
  accentHex,
  onDecrement,
  onIncrement,
}) => {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  const hitTarget = value >= target;

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-4 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${accentHex}24`,
              color: accentHex === "#FACC15" ? "#B45309" : accentHex,
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
              {label}
            </p>
            <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] tabular-nums">
              Goal: {target} {unit}
            </p>
          </div>
        </div>
        {hitTarget && (
          <span className="text-[11px] font-semibold text-[#059669] dark:text-[#10B981] whitespace-nowrap">
            Target met
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDecrement}
          aria-label={`Decrease ${label}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#1E1E1E]/30 dark:hover:border-[#F5F2EC]/30 transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="text-center">
          <span className="font-mono text-2xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] tabular-nums">
            {value}
          </span>
          <span className="ml-1 text-xs text-[#6E685F] dark:text-[#9A9389]">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Increase ${label}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#1E1E1E] font-semibold transition-transform active:scale-95"
          style={{
            backgroundColor: accentHex,
            color: accentHex === "#FACC15" ? "#1E1E1E" : "#FFFFFF",
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FAF7F2] dark:bg-[#161513]">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: accentHex }}
        />
      </div>
    </div>
  );
};
