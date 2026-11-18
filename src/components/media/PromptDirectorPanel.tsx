import React, { useState } from "react";
import { Copy, Check, Sparkles, Loader2, Clapperboard } from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import { buildGoogleFlowPrompt } from "../../lib/reelVisuals";
import type { KineticScene, MediaStudioState } from "../../types/studio";

interface PromptDirectorPanelProps {
  media: MediaStudioState;
  isOnline: boolean;
  onUpdateMedia: (updater: (prev: MediaStudioState) => MediaStudioState) => void;
}

export const PromptDirectorPanel: React.FC<PromptDirectorPanelProps> = ({
  media,
  isOnline,
  onUpdateMedia,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleRegenerateAiPrompts = async () => {
    if (!isOnline || loading || !media.scriptText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/media/split-script", {
        method: "POST",
        headers: getAiRequestHeaders(),
        body: JSON.stringify({
          script: media.scriptText,
          aspectRatio: media.aspectRatio,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not refresh Google Flow / Veo prompts.");
      }

      const nextScenes: KineticScene[] = (data.scenes || []).map(
        (s: Record<string, unknown>, idx: number) => ({
          id: `sc-dir-${Date.now()}-${idx}`,
          text: String(s.text || ""),
          emphasisWord: String(s.emphasisWord || "FOCUS"),
          durationSec: Math.max(1.5, Number(s.durationSec || 2.5)),
          bRollCue: String(s.bRollCue || ""),
          veoPrompt: String(s.veoPrompt || ""),
        })
      );
      if (nextScenes.length > 0) {
        onUpdateMedia((prev) => ({
          ...prev,
          scenes: nextScenes.map((ns, idx) => {
            const existing = prev.scenes[idx];
            return existing
              ? {
                  ...ns,
                  mediaUrl: existing.mediaUrl,
                  mediaType: existing.mediaType,
                  mediaLabel: existing.mediaLabel,
                  clipAudioMuted: existing.clipAudioMuted,
                  svgFallbackSeed: existing.svgFallbackSeed ?? idx,
                }
              : { ...ns, svgFallbackSeed: idx };
          }),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate prompts.");
    } finally {
      setLoading(false);
    }
  };

  const allPromptsText = media.scenes
    .map((s, i) => {
      const flowPrompt =
        s.veoPrompt ||
        buildGoogleFlowPrompt({
          text: s.text,
          bRollCue: s.bRollCue,
          aspectRatio: media.aspectRatio,
        });
      return `Scene ${i + 1} (${s.durationSec}s) — "${s.text}"\nCapCut Cue: ${s.bRollCue}\nGoogle Flow / Veo 3 Prompt: ${flowPrompt}`;
    })
    .join("\n\n");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC4899]/15 text-[#EC4899]">
            <Clapperboard className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Google Flow / Veo 3 &amp; CapCut Prompt Director
            </h3>
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
              Scene-by-scene cinematic video prompts ready for 1-click copy
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyText("all", allPromptsText)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 text-xs font-semibold hover:border-[#EC4899]"
          >
            {copiedId === "all" ? (
              <Check className="h-3.5 w-3.5 text-[#10B981]" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#EC4899]" />
            )}
            {copiedId === "all" ? "Copied All!" : "Copy All Prompts"}
          </button>

          <button
            type="button"
            disabled={!isOnline || loading}
            onClick={() => void handleRegenerateAiPrompts()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#EC4899] px-3.5 text-xs font-semibold text-white hover:bg-[#DB2777] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Refresh AI Prompts
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-[#DC2626]/10 px-4 py-2.5 text-xs text-[#DC2626]">
          {error}
        </p>
      )}

      {media.scenes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-10 text-center text-xs sm:text-sm text-[#6E685F] dark:text-[#9A9389]">
          Add or split a script in <strong>Kinetic Reel Maker</strong> first to generate scene-by-scene Google Flow / Veo 3 and CapCut B-roll prompts.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {media.scenes.map((scene, idx) => {
          const promptText =
            scene.veoPrompt ||
            buildGoogleFlowPrompt({
              text: scene.text,
              bRollCue: scene.bRollCue,
              aspectRatio: media.aspectRatio,
            });

          return (
            <div
              key={scene.id}
              className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-[#EC4899] tabular-nums">
                  SCENE {idx + 1} · {scene.durationSec}s
                </span>
                <button
                  type="button"
                  onClick={() => void copyText(scene.id, promptText)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold hover:border-[#EC4899]"
                >
                  {copiedId === scene.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#10B981]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#EC4899]" />
                      Copy Prompt
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Line: &ldquo;{scene.text}&rdquo;
              </p>

              <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
                <strong>CapCut Cut Cue:</strong> {scene.bRollCue}
              </p>

              <textarea
                rows={3}
                value={promptText}
                onChange={(e) =>
                  onUpdateMedia((prev) => ({
                    ...prev,
                    scenes: prev.scenes.map((s) =>
                      s.id === scene.id ? { ...s, veoPrompt: e.target.value } : s
                    ),
                  }))
                }
                className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-2.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] leading-relaxed focus:border-[#EC4899] focus:outline-none"
              />
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};
