import React, { useEffect, useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import type { EditCard, SocialPlatform } from "../../types/studio";

interface NewBriefModalProps {
  open: boolean;
  onClose: () => void;
  onCreateCard: (card: EditCard, modelUsed: string) => void;
}

const PLATFORMS: SocialPlatform[] = ["TikTok", "YouTube", "Instagram", "LinkedIn"];

const BRIEF_PROGRESS_STEPS = [
  "Analyzing brief angle...",
  "Drafting cut sheet...",
  "Formatting B-roll cues...",
  "Polishing platform captions...",
];

export const NewBriefModal: React.FC<NewBriefModalProps> = ({
  open,
  onClose,
  onCreateCard,
}) => {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("TikTok");
  const [duration, setDuration] = useState("45-60s");
  const [goal, setGoal] = useState("Saves & shares");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setProgressStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setProgressStep((prev) =>
        prev < BRIEF_PROGRESS_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 1300);
    return () => window.clearInterval(timer);
  }, [loading]);

  if (!open) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/edit-desk/generate-brief", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({
          topic: topic.trim(),
          platform,
          duration,
          goal,
          notes,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to generate video brief.");
      }

      const nowIso = new Date().toISOString();
      const newCard: EditCard = {
        id: `card-${Date.now()}`,
        title: data.title || topic.trim(),
        platform,
        stage: "Brief",
        hook: data.hook || "",
        concept: data.concept || "",
        cutSheet: Array.isArray(data.cutSheet)
          ? data.cutSheet.map((row: Record<string, string>, idx: number) => ({
              id: `cs-${Date.now()}-${idx}`,
              timestamp: row.timestamp || "0:00 - 0:05",
              bRoll: row.bRoll || "",
              onScreenText: row.onScreenText || "",
              audioNotes: row.audioNotes || "",
            }))
          : [],
        captions: {
          primary: data.captions?.primary || "",
          shortAlt: data.captions?.shortAlt || "",
          hashtags: Array.isArray(data.captions?.hashtags)
            ? data.captions.hashtags
            : [],
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      onCreateCard(newCard, data.modelUsed || "gemini-3.8-flash");
      setTopic("");
      setNotes("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate brief.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-brief-title"
        className="w-full max-w-lg rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B]/20 text-[#B45309] dark:text-[#FBBF24]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2
                id="new-brief-title"
                className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]"
              >
                New AI Production Brief
              </h2>
              <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                Generates a timecoded cut sheet &amp; platform captions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E685F] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] mb-1.5">
              Video Topic or Core Idea
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., How I batch 7 days of creator content in 2 hours"
              className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 py-2.5 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F59E0B] focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] mb-1.5">
              Target Platform
            </span>
            <div className="grid grid-cols-4 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`h-9 rounded-xl border text-xs font-semibold transition-colors ${
                    platform === p
                      ? "border-[#F59E0B] bg-[#F59E0B] text-[#1E1E1E]"
                      : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Duration
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 45-60s or 8 min"
                className="mt-1.5 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F59E0B] focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Primary Goal / CTA
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Newsletter signups"
                className="mt-1.5 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F59E0B] focus:outline-none"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] mb-1.5">
              Optional Production Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visual vibe, specific props, talking points..."
              className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F59E0B] focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F87171]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] px-4 text-xs font-medium text-[#5C5750] dark:text-[#A69F96]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F59E0B] px-5 text-xs sm:text-sm font-semibold text-[#1E1E1E] hover:bg-[#D97706] hover:text-white disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {BRIEF_PROGRESS_STEPS[progressStep]}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Cut Sheet &amp; Captions
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
