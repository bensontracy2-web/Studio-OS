import React, { useState } from "react";
import { Plus, Trash2, Briefcase } from "lucide-react";
import type { Deliverable, DeliverableStatus } from "../../types/studio";

interface DeliverablesCardProps {
  deliverables: Deliverable[];
  onAddDeliverable: (item: Omit<Deliverable, "id">) => void;
  onCycleStatus: (id: string) => void;
  onDeleteDeliverable: (id: string) => void;
}

const STATUS_STYLES: Record<
  DeliverableStatus,
  { bg: string; text: string; border: string }
> = {
  "In progress": {
    bg: "bg-[#FACC15]/20 dark:bg-[#FACC15]/15",
    text: "text-[#854D0E] dark:text-[#FDE047]",
    border: "border-[#FACC15]/60",
  },
  "This week": {
    bg: "bg-[#FAF7F2] dark:bg-[#161513]",
    text: "text-[#5C5750] dark:text-[#D6D0C6]",
    border: "border-[#E8E2D8] dark:border-[#322E29]",
  },
  Ready: {
    bg: "bg-[#10B981]/15 dark:bg-[#10B981]/20",
    text: "text-[#065F46] dark:text-[#6EE7B7]",
    border: "border-[#10B981]/50",
  },
};

export const DeliverablesCard: React.FC<DeliverablesCardProps> = ({
  deliverables,
  onAddDeliverable,
  onCycleStatus,
  onDeleteDeliverable,
}) => {
  const [filter, setFilter] = useState<"All" | DeliverableStatus>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [dueLabel, setDueLabel] = useState("Friday");
  const [status, setStatus] = useState<DeliverableStatus>("This week");

  const filtered =
    filter === "All"
      ? deliverables
      : deliverables.filter((d) => d.status === filter);

  const readyCount = deliverables.filter((d) => d.status === "Ready").length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddDeliverable({
      title: title.trim(),
      clientOrProject: client.trim() || "Personal Studio",
      dueLabel: dueLabel.trim() || "This week",
      status,
    });
    setTitle("");
    setClient("");
    setShowAdd(false);
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FACC15]/20 text-[#92400E] dark:text-[#FACC15]">
            <Briefcase className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Work &amp; Deliverables
            </h3>
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
              {readyCount} of {deliverables.length} ready to ship
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#10B981] px-3 text-xs font-semibold text-white hover:bg-[#059669] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Deliverable
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-1 p-1 mb-4 rounded-xl bg-[#FAF7F2] dark:bg-[#161513] overflow-x-auto">
        {(["All", "In progress", "This week", "Ready"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === tab
                ? "bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC] shadow-xs"
                : "text-[#6E685F] dark:text-[#9A9389] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 space-y-2.5"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deliverable title (e.g., Sponsor Reel Cut #2)"
            className="w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 py-2 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#10B981] focus:outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Client / Project"
              className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
            />
            <input
              type="text"
              value={dueLabel}
              onChange={(e) => setDueLabel(e.target.value)}
              placeholder="Due (e.g., Thu 4 PM)"
              className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DeliverableStatus)}
              className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
            >
              <option value="In progress">In progress</option>
              <option value="This week">This week</option>
              <option value="Ready">Ready</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E685F] dark:text-[#9A9389]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white"
            >
              Save Item
            </button>
          </div>
        </form>
      )}

      {/* Deliverables Rows */}
      <div className="divide-y divide-[#E8E2D8] dark:divide-[#322E29] flex-1">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
            No deliverables match this status filter.
          </div>
        ) : (
          filtered.map((item) => {
            const st = STATUS_STYLES[item.status];
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6E685F] dark:text-[#9A9389] truncate">
                    {item.clientOrProject} · {item.dueLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onCycleStatus(item.id)}
                    title="Click to cycle status"
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${st.bg} ${st.text} ${st.border}`}
                  >
                    {item.status}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDeliverable(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626] hover:bg-[#FAF7F2] dark:hover:bg-[#161513] transition-colors"
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
