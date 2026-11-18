import React, { useState } from "react";
import type { EditCard, KanbanStage, TabId } from "../../types/studio";
import { KanbanBoard } from "./KanbanBoard";
import { NewBriefModal } from "./NewBriefModal";
import { CardDetailModal } from "./CardDetailModal";

interface EditDeskProps {
  cards: EditCard[];
  onUpdateCards: (updater: (prev: EditCard[]) => EditCard[]) => void;
  onSyncPostToDashboard: (card: EditCard) => void;
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

export const EditDesk: React.FC<EditDeskProps> = ({
  cards,
  onUpdateCards,
  onSyncPostToDashboard,
  onTriggerAlert,
}) => {
  const [newBriefOpen, setNewBriefOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null;

  const handleCreateCard = (card: EditCard, modelUsed: string) => {
    onUpdateCards((prev) => [card, ...prev]);
    onTriggerAlert({
      triggerKey: `brief-created-${card.id}`,
      title: "AI Production Brief Ready",
      message: `Generated ${card.cutSheet.length}-segment cut sheet for "${card.title}" (${modelUsed}).`,
      accentColor: "#F59E0B",
      tab: "editdesk",
      severity: "success",
      dedupe: false,
    });
  };

  const handleMoveCardStage = (cardId: string, nextStage: KanbanStage) => {
    onUpdateCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        if (c.stage !== "Delivered" && nextStage === "Delivered") {
          onTriggerAlert({
            triggerKey: `card-delivered-${c.id}-${Date.now()}`,
            title: "Edit Delivered",
            message: `"${c.title}" (${c.platform}) reached Delivered stage.`,
            accentColor: "#10B981",
            tab: "editdesk",
            severity: "success",
            dedupe: false,
          });
        }
        return { ...c, stage: nextStage, updatedAt: new Date().toISOString() };
      })
    );
  };

  const handleUpdateCard = (updated: EditCard) => {
    onUpdateCards((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleDeleteCard = (id: string) => {
    onUpdateCards((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div>
      <KanbanBoard
        cards={cards}
        onOpenNewBrief={() => setNewBriefOpen(true)}
        onSelectCard={(card) => setSelectedCardId(card.id)}
        onMoveCardStage={handleMoveCardStage}
      />

      <NewBriefModal
        open={newBriefOpen}
        onClose={() => setNewBriefOpen(false)}
        onCreateCard={handleCreateCard}
      />

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCardId(null)}
        onUpdateCard={handleUpdateCard}
        onDeleteCard={handleDeleteCard}
        onSyncPostToDashboard={onSyncPostToDashboard}
      />
    </div>
  );
};
