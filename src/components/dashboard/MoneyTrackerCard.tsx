import React, { useState } from "react";
import { Wallet, Plus, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { MoneyEntry } from "../../types/studio";

interface MoneyTrackerCardProps {
  entries: MoneyEntry[];
  monthlyGoalUSD: number;
  ngnPerUsd: number;
  onAddEntry: (entry: Omit<MoneyEntry, "id">) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateGoal: (goalUsd: number, ngnPerUsd: number) => void;
}

export const MoneyTrackerCard: React.FC<MoneyTrackerCardProps> = ({
  entries,
  monthlyGoalUSD,
  ngnPerUsd,
  onAddEntry,
  onDeleteEntry,
  onUpdateGoal,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(monthlyGoalUSD));
  const [rateDraft, setRateDraft] = useState(String(ngnPerUsd));

  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("USD");
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");

  const usdNet = entries.reduce((acc, e) => {
    if (e.currency !== "USD") return acc;
    return acc + (e.type === "income" ? e.amount : -e.amount);
  }, 0);

  const ngnNet = entries.reduce((acc, e) => {
    if (e.currency !== "NGN") return acc;
    return acc + (e.type === "income" ? e.amount : -e.amount);
  }, 0);

  const totalCombinedUSD = usdNet + ngnNet / Math.max(1, ngnPerUsd);
  const goalPct =
    monthlyGoalUSD > 0
      ? Math.max(0, Math.min(100, Math.round((totalCombinedUSD / monthlyGoalUSD) * 100)))
      : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount);
    if (!title.trim() || Number.isNaN(numeric) || numeric <= 0) return;
    onAddEntry({
      title: title.trim(),
      currency,
      amount: numeric,
      type,
      date: new Date().toISOString().slice(0, 10),
    });
    setTitle("");
    setAmount("");
    setShowAdd(false);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const g = Number(goalDraft);
    const r = Number(rateDraft);
    if (g > 0 && r > 0) {
      onUpdateGoal(g, r);
    }
    setEditingGoal(false);
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10B981]/18 text-[#059669] dark:text-[#10B981]">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Dual-Currency Money Tracker
            </h3>
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
              NGN ₦ + USD $ · Rate: ₦{ngnPerUsd.toLocaleString()}/$1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGoalDraft(String(monthlyGoalUSD));
              setRateDraft(String(ngnPerUsd));
              setEditingGoal((v) => !v);
            }}
            className="h-9 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#161513] whitespace-nowrap"
          >
            Edit Goal
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#FACC15] px-3 text-xs font-semibold text-[#1E1E1E] hover:bg-[#eab308] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Entry
          </button>
        </div>
      </div>

      {/* Dual Currency Net Balances */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5">
          <p className="text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            USD Net Balance
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] tabular-nums">
            ${usdNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5">
          <p className="text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            NGN Net Balance
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] tabular-nums">
            ₦{ngnNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Monthly Goal Progress Bar */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-xs font-medium text-[#5C5750] dark:text-[#A69F96]">
            Monthly Goal Progress (Combined USD Equiv.)
          </span>
          <span className="font-mono text-xs font-bold text-[#1E1E1E] dark:text-[#F5F2EC] tabular-nums">
            ${Math.round(totalCombinedUSD).toLocaleString()} / ${monthlyGoalUSD.toLocaleString()} ({goalPct}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${goalPct}%`,
              background: "linear-gradient(90deg, #10B981 0%, #FACC15 100%)",
            }}
          />
        </div>
      </div>

      {editingGoal && (
        <form
          onSubmit={handleSaveGoal}
          className="mb-4 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"
        >
          <label className="text-xs font-medium text-[#5C5750] dark:text-[#A69F96]">
            Monthly Goal ($)
            <input
              type="number"
              min="1"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1.5 text-xs font-mono text-[#1E1E1E] dark:text-[#F5F2EC]"
            />
          </label>
          <label className="text-xs font-medium text-[#5C5750] dark:text-[#A69F96]">
            FX Rate (₦ per $1)
            <input
              type="number"
              min="1"
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1.5 text-xs font-mono text-[#1E1E1E] dark:text-[#F5F2EC]"
            />
          </label>
          <button
            type="submit"
            className="h-8 rounded-lg bg-[#10B981] px-3 text-xs font-semibold text-white"
          >
            Update Target
          </button>
        </form>
      )}

      {showAdd && (
        <form
          onSubmit={handleAddSubmit}
          className="mb-4 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 space-y-2.5"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry label (e.g., Brand Retainer or Camera Lens)"
            className="w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 py-2 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "income" | "expense")}
              className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC]"
            >
              <option value="income">Income (+)</option>
              <option value="expense">Expense (-)</option>
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")}
              className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC]"
            >
              <option value="USD">USD ($)</option>
              <option value="NGN">NGN (₦)</option>
            </select>
            <input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1.5 text-xs font-mono text-[#1E1E1E] dark:text-[#F5F2EC]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E685F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white"
            >
              Save Entry
            </button>
          </div>
        </form>
      )}

      {/* Ledger List */}
      <div className="divide-y divide-[#E8E2D8] dark:divide-[#322E29] max-h-56 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
            No entries logged yet. Tap <strong>+ Log Entry</strong> or tell Bestie what you earned or spent.
          </div>
        ) : (
          entries.map((entry) => {
          const isIncome = entry.type === "income";
          const symbol = entry.currency === "USD" ? "$" : "₦";
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isIncome
                      ? "bg-[#10B981]/15 text-[#059669] dark:text-[#10B981]"
                      : "bg-[#F26B5B]/15 text-[#DC2626] dark:text-[#F87171]"
                  }`}
                >
                  {isIncome ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                    {entry.title}
                  </p>
                  <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] font-mono tabular-nums">
                    {entry.date} · {entry.currency}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-mono text-xs sm:text-sm font-semibold tabular-nums ${
                    isIncome
                      ? "text-[#059669] dark:text-[#10B981]"
                      : "text-[#DC2626] dark:text-[#F87171]"
                  }`}
                >
                  {isIncome ? "+" : "-"}
                  {symbol}
                  {entry.amount.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label={`Delete ${entry.title}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#8C857B] hover:text-[#DC2626]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
          })
        )}
      </div>
    </div>
  );
};
