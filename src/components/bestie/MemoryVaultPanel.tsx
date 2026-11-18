import React, { useState } from "react";
import { Bookmark, Plus, Trash2, Pencil, Check } from "lucide-react";
import type { MemoryCategory, MemoryItem } from "../../types/studio";

interface MemoryVaultPanelProps {
  memories: MemoryItem[];
  onAddMemory: (category: MemoryCategory, content: string) => void;
  onUpdateMemory: (id: string, content: string) => void;
  onDeleteMemory: (id: string) => void;
}

const CATEGORIES: Array<"All" | MemoryCategory> = [
  "All",
  "Personal",
  "Goals",
  "Projects",
  "Skills",
];

const MEMORY_CATEGORIES: MemoryCategory[] = [
  "Personal",
  "Goals",
  "Projects",
  "Skills",
];

export const MemoryVaultPanel: React.FC<MemoryVaultPanelProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const [filter, setFilter] = useState<"All" | MemoryCategory>("All");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("Goals");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const filtered =
    filter === "All"
      ? memories
      : memories.filter((m) => m.category === filter);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddMemory(newCategory, newContent.trim());
    setNewContent("");
  };

  const handleSaveEdit = (id: string) => {
    if (editDraft.trim()) {
      onUpdateMemory(id, editDraft.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F26B5B]/15 text-[#F26B5B]">
            <Bookmark className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Companion Memory Vault
            </h3>
            <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
              Injected into every Bestie &amp; VA prompt ({memories.length} saved)
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
              filter === cat
                ? "border-[#F26B5B] bg-[#F26B5B]/15 text-[#D94E3E] dark:text-[#FF8C7E]"
                : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#6E685F] dark:text-[#A69F96]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Add Memory Form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
            aria-label="Memory category"
            className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-2 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC]"
          >
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add fact, goal, project, or skill..."
            className="flex-1 min-w-0 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#F26B5B] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newContent.trim()}
            aria-label="Add to Memory Vault"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F26B5B] text-white hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Memory Items */}
      <div className="divide-y divide-[#E8E2D8] dark:divide-[#322E29] max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
            No memories saved under {filter} yet.
          </p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="py-2.5 first:pt-1 last:pb-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#D94E3E] dark:text-[#FF8C7E]">
                  {item.category}
                </span>
                <div className="flex items-center gap-1">
                  {editingId === item.id ? (
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      aria-label="Save memory"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#10B981]"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditDraft(item.content);
                      }}
                      aria-label="Edit memory"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#8C857B] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteMemory(item.id)}
                    aria-label="Delete memory"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[#8C857B] hover:text-[#DC2626]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {editingId === item.id ? (
                <input
                  type="text"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(item.id);
                  }}
                  autoFocus
                  className="w-full rounded-lg border border-[#F26B5B] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-1 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
                />
              ) : (
                <p className="text-xs text-[#383530] dark:text-[#DCD6CD] leading-relaxed">
                  {item.content}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
