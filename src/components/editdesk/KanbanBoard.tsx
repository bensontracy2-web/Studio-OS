import React, { useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Film,
  GripVertical,
} from "lucide-react";
import type { EditCard, KanbanStage, SocialPlatform } from "../../types/studio";

interface KanbanBoardProps {
  cards: EditCard[];
  onOpenNewBrief: () => void;
  onSelectCard: (card: EditCard) => void;
  onMoveCardStage: (cardId: string, stage: KanbanStage) => void;
}

const STAGES: KanbanStage[] = ["Brief", "Editing", "Review", "Delivered"];
const PLATFORMS: Array<"All" | SocialPlatform> = [
  "All",
  "TikTok",
  "YouTube",
  "Instagram",
  "LinkedIn",
];

const PLATFORM_ACCENT: Record<SocialPlatform, string> = {
  TikTok: "#1E1E1E",
  YouTube: "#DC2626",
  Instagram: "#EC4899",
  LinkedIn: "#0284C7",
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  cards,
  onOpenNewBrief,
  onSelectCard,
  onMoveCardStage,
}) => {
  const [platformFilter, setPlatformFilter] = useState<"All" | SocialPlatform>("All");
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<KanbanStage | null>(null);

  const filteredCards =
    platformFilter === "All"
      ? cards
      : cards.filter((c) => c.platform === platformFilter);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {PLATFORMS.map((p) => {
            const active = platformFilter === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(p)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                  active
                    ? "border-[#F59E0B] bg-[#F59E0B]/18 text-[#92400E] dark:text-[#FBBF24]"
                    : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenNewBrief}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-4 text-xs sm:text-sm font-semibold text-[#1E1E1E] hover:bg-[#D97706] hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          + New Brief
        </button>
      </div>

      {/* 4-Column Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {STAGES.map((stage, stageIdx) => {
          const stageCards = filteredCards.filter((c) => c.stage === stage);
          const isDropTarget = dragOverStage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                if (draggedCardId) {
                  onMoveCardStage(draggedCardId, stage);
                  setDraggedCardId(null);
                }
              }}
              className={`rounded-2xl border p-3.5 transition-colors min-h-[280px] ${
                isDropTarget
                  ? "border-[#F59E0B] bg-[#F59E0B]/10"
                  : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D]"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#E8E2D8] dark:border-[#322E29]">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{
                      backgroundColor:
                        stage === "Delivered" ? "#10B981" : "#F59E0B",
                      opacity: 0.45 + stageIdx * 0.18,
                    }}
                  />
                  <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    {stage}
                  </h3>
                </div>
                <span className="font-mono text-xs font-semibold text-[#6E685F] dark:text-[#9A9389] tabular-nums">
                  {stageCards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {stageCards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] py-8 px-3 text-center text-xs text-[#8C857B]">
                    No items in {stage}
                  </div>
                ) : (
                  stageCards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => setDraggedCardId(card.id)}
                      onDragEnd={() => {
                        setDraggedCardId(null);
                        setDragOverStage(null);
                      }}
                      className="group rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 hover:border-[#F59E0B] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCard(card)}
                          className="text-left min-w-0 flex-1"
                        >
                          <p className="text-xs font-semibold mb-1" style={{ color: card.platform === "TikTok" ? undefined : PLATFORM_ACCENT[card.platform] }}>
                            {card.platform} ·{" "}
                            <span className="font-mono text-[#6E685F] dark:text-[#9A9389] font-normal tabular-nums">
                              {card.cutSheet.length} cuts
                            </span>
                          </p>
                          <h4 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC] leading-snug group-hover:text-[#B45309] dark:group-hover:text-[#FBBF24] transition-colors">
                            {card.title}
                          </h4>
                        </button>
                        <GripVertical className="h-4 w-4 shrink-0 text-[#B3ACA1] dark:text-[#575148] cursor-grab hidden sm:block" />
                      </div>

                      {card.hook && (
                        <p className="mt-2 text-xs text-[#5C5750] dark:text-[#A69F96] line-clamp-2 leading-relaxed">
                          {card.hook}
                        </p>
                      )}

                      <div className="mt-3 pt-2.5 border-t border-[#E8E2D8] dark:border-[#322E29] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCard(card)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] dark:text-[#FBBF24] hover:underline"
                        >
                          <Film className="h-3 w-3" />
                          Cut Sheet &amp; Captions
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={stageIdx === 0}
                            onClick={() =>
                              onMoveCardStage(card.id, STAGES[stageIdx - 1])
                            }
                            aria-label="Move to previous stage"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#5C5750] dark:text-[#A69F96] disabled:opacity-30 hover:border-[#F59E0B]"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={stageIdx === STAGES.length - 1}
                            onClick={() =>
                              onMoveCardStage(card.id, STAGES[stageIdx + 1])
                            }
                            aria-label="Move to next stage"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#5C5750] dark:text-[#A69F96] disabled:opacity-30 hover:border-[#F59E0B]"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
