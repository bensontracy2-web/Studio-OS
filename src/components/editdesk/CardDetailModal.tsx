import React, { useEffect, useState } from "react";
import {
  X,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Send,
} from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import type {
  CutSheetRow,
  EditCard,
  KanbanStage,
  SocialPlatform,
} from "../../types/studio";

interface CardDetailModalProps {
  card: EditCard | null;
  onClose: () => void;
  onUpdateCard: (updated: EditCard) => void;
  onDeleteCard: (id: string) => void;
  onSyncPostToDashboard: (card: EditCard) => void;
}

const STAGES: KanbanStage[] = ["Brief", "Editing", "Review", "Delivered"];
const PLATFORMS: SocialPlatform[] = ["TikTok", "YouTube", "Instagram", "LinkedIn"];

const CUTSHEET_PROGRESS_STEPS = [
  "Reviewing brief angle...",
  "Drafting cut sheet...",
  "Formatting B-roll cues...",
  "Syncing audio & captions...",
];

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onSyncPostToDashboard,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatingSheet, setGeneratingSheet] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!generatingSheet) {
      setProgressStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setProgressStep((prev) =>
        prev < CUTSHEET_PROGRESS_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 1300);
    return () => window.clearInterval(timer);
  }, [generatingSheet]);

  if (!card) return null;

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleStageChange = (stage: KanbanStage) => {
    onUpdateCard({ ...card, stage, updatedAt: new Date().toISOString() });
  };

  const handleAddCutRow = () => {
    const newRow: CutSheetRow = {
      id: `cs-${Date.now()}`,
      timestamp: "0:00 - 0:10",
      bRoll: "New visual direction",
      onScreenText: "Key text overlay",
      audioNotes: "Voiceover + SFX",
    };
    onUpdateCard({
      ...card,
      cutSheet: [...card.cutSheet, newRow],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateCutRow = (
    rowId: string,
    field: keyof Omit<CutSheetRow, "id">,
    value: string
  ) => {
    onUpdateCard({
      ...card,
      cutSheet: card.cutSheet.map((r) =>
        r.id === rowId ? { ...r, [field]: value } : r
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemoveCutRow = (rowId: string) => {
    onUpdateCard({
      ...card,
      cutSheet: card.cutSheet.filter((r) => r.id !== rowId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleGenerateCutSheetWithAI = async () => {
    setGeneratingSheet(true);
    setAiError(null);
    try {
      const resp = await fetch("/api/edit-desk/generate-brief", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({
          topic: card.title,
          platform: card.platform,
          notes: card.concept || card.hook,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to generate cut sheet.");
      }

      onUpdateCard({
        ...card,
        hook: data.hook || card.hook,
        concept: data.concept || card.concept,
        cutSheet: Array.isArray(data.cutSheet)
          ? data.cutSheet.map((row: Record<string, string>, idx: number) => ({
              id: `cs-${Date.now()}-${idx}`,
              timestamp: row.timestamp || "0:00 - 0:05",
              bRoll: row.bRoll || "",
              onScreenText: row.onScreenText || "",
              audioNotes: row.audioNotes || "",
            }))
          : card.cutSheet,
        captions: data.captions ?? card.captions,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Could not generate cut sheet.");
    } finally {
      setGeneratingSheet(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E8E2D8] dark:border-[#322E29] px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="text"
              value={card.title}
              onChange={(e) =>
                onUpdateCard({
                  ...card,
                  title: e.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="w-full bg-transparent font-display text-lg sm:text-xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={card.platform}
                onChange={(e) =>
                  onUpdateCard({
                    ...card,
                    platform: e.target.value as SocialPlatform,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-1 text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29]">
                {STAGES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStageChange(st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      card.stage === st
                        ? "bg-[#F59E0B] text-[#1E1E1E]"
                        : "text-[#6E685F] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onDeleteCard(card.id);
                onClose();
              }}
              aria-label="Delete brief"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6E685F] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Hook & Concept */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] mb-1">
                Opening Hook
              </label>
              <textarea
                rows={2}
                value={card.hook}
                onChange={(e) =>
                  onUpdateCard({
                    ...card,
                    hook: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F59E0B] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] mb-1">
                Creative Concept
              </label>
              <textarea
                rows={2}
                value={card.concept}
                onChange={(e) =>
                  onUpdateCard({
                    ...card,
                    concept: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F59E0B] focus:outline-none"
              />
            </div>
          </div>

          {/* Timecoded Cut Sheet */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Timecoded Cut Sheet
                </h3>
                <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                  B-roll direction, on-screen text overlays, and audio cues
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateCutSheetWithAI}
                  disabled={generatingSheet}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F59E0B] bg-[#F59E0B]/15 px-3 text-xs font-semibold text-[#92400E] dark:text-[#FBBF24] hover:bg-[#F59E0B]/25 disabled:opacity-50"
                >
                  {generatingSheet ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {CUTSHEET_PROGRESS_STEPS[progressStep]}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {card.cutSheet.length === 0 ? "AI Generate Cut Sheet" : "Regenerate with AI"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleAddCutRow}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Segment
                </button>
              </div>
            </div>

            {aiError && (
              <p className="mb-3 rounded-lg bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626]">
                {aiError}
              </p>
            )}

            {card.cutSheet.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] py-8 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
                No cut sheet rows yet. Click &ldquo;AI Generate Cut Sheet&rdquo; or &ldquo;Add Segment&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E8E2D8] dark:border-[#322E29]">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-[#FAF7F2] dark:bg-[#161513] text-[11px] font-semibold text-[#5C5750] dark:text-[#A69F96]">
                    <tr>
                      <th className="px-3 py-2.5 w-28">Timecode</th>
                      <th className="px-3 py-2.5">B-Roll / Visual</th>
                      <th className="px-3 py-2.5">On-Screen Text</th>
                      <th className="px-3 py-2.5">Audio Notes</th>
                      <th className="px-2 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2D8] dark:divide-[#322E29] text-xs">
                    {card.cutSheet.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.timestamp}
                            onChange={(e) =>
                              handleUpdateCutRow(row.id, "timestamp", e.target.value)
                            }
                            className="w-full rounded-md bg-transparent px-1.5 py-1 font-mono text-xs font-semibold text-[#B45309] dark:text-[#FBBF24] focus:bg-[#FAF7F2] dark:focus:bg-[#161513] focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            rows={2}
                            value={row.bRoll}
                            onChange={(e) =>
                              handleUpdateCutRow(row.id, "bRoll", e.target.value)
                            }
                            className="w-full rounded-md bg-transparent px-1.5 py-1 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:bg-[#FAF7F2] dark:focus:bg-[#161513] focus:outline-none resize-none"
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            rows={2}
                            value={row.onScreenText}
                            onChange={(e) =>
                              handleUpdateCutRow(row.id, "onScreenText", e.target.value)
                            }
                            className="w-full rounded-md bg-transparent px-1.5 py-1 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] focus:bg-[#FAF7F2] dark:focus:bg-[#161513] focus:outline-none resize-none"
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            rows={2}
                            value={row.audioNotes}
                            onChange={(e) =>
                              handleUpdateCutRow(row.id, "audioNotes", e.target.value)
                            }
                            className="w-full rounded-md bg-transparent px-1.5 py-1 text-xs text-[#5C5750] dark:text-[#A69F96] focus:bg-[#FAF7F2] dark:focus:bg-[#161513] focus:outline-none resize-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCutRow(row.id)}
                            aria-label="Remove segment"
                            className="mt-1 text-[#8C857B] hover:text-[#DC2626]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Social Captions */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Social Captions ({card.platform})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#5C5750] dark:text-[#A69F96]">
                    Primary Caption
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(
                        "primary",
                        `${card.captions.primary}\n\n${card.captions.hashtags.join(" ")}`
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]"
                  >
                    {copiedKey === "primary" ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={card.captions.primary}
                  onChange={(e) =>
                    onUpdateCard({
                      ...card,
                      captions: { ...card.captions, primary: e.target.value },
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="w-full bg-transparent text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
                />
                {card.captions.hashtags.length > 0 && (
                  <p className="mt-2 text-xs text-[#B45309] dark:text-[#FBBF24]">
                    {card.captions.hashtags.join(" ")}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#5C5750] dark:text-[#A69F96]">
                    Short Alt Caption
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyText("alt", card.captions.shortAlt)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]"
                  >
                    {copiedKey === "alt" ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={card.captions.shortAlt}
                  onChange={(e) =>
                    onUpdateCard({
                      ...card,
                      captions: { ...card.captions, shortAlt: e.target.value },
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="w-full bg-transparent text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E2D8] dark:border-[#322E29] px-5 py-3.5 bg-[#FAF7F2]/70 dark:bg-[#161513]/70">
          <div>
            {card.stage === "Delivered" && (
              <button
                type="button"
                disabled={card.syncedPost}
                onClick={() => onSyncPostToDashboard(card)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {card.syncedPost
                  ? "Synced to Life Dashboard Posts"
                  : "Log +1 Post Today on Life Dashboard"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-[#F59E0B] px-5 text-xs font-semibold text-[#1E1E1E] hover:bg-[#D97706] hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
