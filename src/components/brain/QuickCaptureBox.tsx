import React, { useState } from "react";
import { Sparkles, Loader2, ArrowUpRight, WifiOff } from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import type { SocialPlatform, SpecificBrainTag } from "../../types/studio";

export interface CaptureResultPayload {
  rawContent: string;
  title: string;
  tag: SpecificBrainTag;
  summary: string;
  tasks: string[];
  suggestedPlatform: SocialPlatform;
  modelUsed: string;
  usedFallback: boolean;
  pendingAiEnrich?: boolean;
}

interface QuickCaptureBoxProps {
  isOnline: boolean;
  onCaptured: (result: CaptureResultPayload) => void;
}

function classifyOfflineCapture(raw: string): CaptureResultPayload {
  const lower = raw.toLowerCase();
  let tag: SpecificBrainTag = "Ideas";
  if (lower.includes("client") || lower.includes("invoice") || lower.includes("proposal")) {
    tag = "Client work";
  } else if (
    lower.includes("video") ||
    lower.includes("reel") ||
    lower.includes("tiktok") ||
    lower.includes("youtube") ||
    lower.includes("hook")
  ) {
    tag = "My content";
  } else if (
    lower.includes("learn") ||
    lower.includes("course") ||
    lower.includes("book") ||
    lower.includes("podcast")
  ) {
    tag = "Learning";
  } else if (lower.includes("health") || lower.includes("gym") || lower.includes("home")) {
    tag = "Personal";
  }

  let suggestedPlatform: SocialPlatform = "YouTube";
  if (lower.includes("tiktok")) suggestedPlatform = "TikTok";
  else if (lower.includes("ig") || lower.includes("instagram") || lower.includes("reel"))
    suggestedPlatform = "Instagram";
  else if (lower.includes("linkedin")) suggestedPlatform = "LinkedIn";

  const firstSentence = raw.split(/[.!?\n]/)[0]?.trim() || raw;
  const title = firstSentence.slice(0, 64);

  return {
    rawContent: raw,
    title,
    tag,
    summary: raw.slice(0, 180),
    tasks: [],
    suggestedPlatform,
    modelUsed: "offline-local",
    usedFallback: true,
    pendingAiEnrich: true,
  };
}

export const QuickCaptureBox: React.FC<QuickCaptureBoxProps> = ({
  isOnline,
  onCaptured,
}) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setLastFeedback(null);

    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      const localResult = classifyOfflineCapture(trimmed);
      onCaptured(localResult);
      setInput("");
      setLastFeedback(
        `Saved "${localResult.title}" offline under ${localResult.tag} — queued for AI enrichment when reconnected.`
      );
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch("/api/brain/capture", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({ content: trimmed }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to classify capture.");
      }

      onCaptured({
        rawContent: trimmed,
        title: data.title,
        tag: data.tag,
        summary: data.summary,
        tasks: data.tasks || [],
        suggestedPlatform: data.suggestedPlatform || "YouTube",
        modelUsed: data.modelUsed,
        usedFallback: Boolean(data.usedFallback),
      });

      setInput("");
      const taskMsg =
        data.tasks && data.tasks.length > 0
          ? ` and extracted ${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"}`
          : "";
      setLastFeedback(
        `Saved "${data.title}" under ${data.tag}${taskMsg} (${data.modelUsed}).`
      );
    } catch {
      const localResult = classifyOfflineCapture(trimmed);
      onCaptured(localResult);
      setInput("");
      setLastFeedback(
        `Saved "${localResult.title}" locally under ${localResult.tag} — queued for AI sync.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0EA5E9]/15 text-[#0284C7] dark:text-[#38BDF8]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Quick Capture
            </h2>
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
              Paste any thought, raw voice transcript, or link — AI auto-tags, titles, and extracts tasks
            </p>
          </div>
        </div>
        {!isOnline && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#92400E] dark:text-[#FCD34D]">
            <WifiOff className="h-3.5 w-3.5" />
            Offline Capture Queue
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a link, content hook, client note, or sudden idea... (e.g., 'Need to record a 45s IG Reel comparing our Lagos studio lights and email Tunde the invoice by Thursday')"
          className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 py-3 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#0EA5E9] focus:outline-none resize-y"
        />

        {error && (
          <p className="rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F87171]">
            {error}
          </p>
        )}

        {lastFeedback && (
          <p className="rounded-lg border border-[#0EA5E9]/30 bg-[#0EA5E9]/10 px-3 py-2 text-xs text-[#0369A1] dark:text-[#7DD3FC]">
            {lastFeedback}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
            Auto-assigns: Personal · My content · Client work · Ideas · Learning
          </p>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0EA5E9] px-4 text-xs sm:text-sm font-semibold text-white hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Organizing...
              </>
            ) : (
              <>
                <span>Capture &amp; Organize</span>
                <ArrowUpRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
