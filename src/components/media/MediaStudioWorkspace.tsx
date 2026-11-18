import React, { useState } from "react";
import { Clapperboard, Film, Image as ImageIcon, Sparkles } from "lucide-react";
import { KineticReelMaker } from "./KineticReelMaker";
import { PromptDirectorPanel } from "./PromptDirectorPanel";
import { SvgThumbnailDesigner } from "./SvgThumbnailDesigner";
import type { MediaStudioState } from "../../types/studio";

interface MediaStudioWorkspaceProps {
  media: MediaStudioState;
  isOnline: boolean;
  onUpdateMedia: (updater: (prev: MediaStudioState) => MediaStudioState) => void;
}

export const MediaStudioWorkspace: React.FC<MediaStudioWorkspaceProps> = ({
  media,
  isOnline,
  onUpdateMedia,
}) => {
  const [tool, setTool] = useState<"kinetic" | "prompts" | "thumbnail">("kinetic");

  return (
    <div className="space-y-6">
      {/* Magenta Rose Header */}
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EC4899] text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Free Media Studio
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96]">
              Kinetic Canvas Reels (.webm), Veo/CapCut B-roll Director, &amp; SVG Thumbnails (PNG) — 100% Free Tier &amp; Offline Export
            </p>
          </div>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#FAF7F2] dark:bg-[#161513] p-1 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setTool("kinetic")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tool === "kinetic"
                ? "bg-[#EC4899] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            Kinetic Reel Maker
          </button>
          <button
            type="button"
            onClick={() => setTool("prompts")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tool === "prompts"
                ? "bg-[#EC4899] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5" />
            Prompt Director
          </button>
          <button
            type="button"
            onClick={() => setTool("thumbnail")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tool === "thumbnail"
                ? "bg-[#EC4899] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            SVG Thumbnails
          </button>
        </div>
      </div>

      {tool === "kinetic" && (
        <KineticReelMaker
          media={media}
          isOnline={isOnline}
          onUpdateMedia={onUpdateMedia}
        />
      )}

      {tool === "prompts" && (
        <PromptDirectorPanel
          media={media}
          isOnline={isOnline}
          onUpdateMedia={onUpdateMedia}
        />
      )}

      {tool === "thumbnail" && (
        <SvgThumbnailDesigner
          thumbnail={media.thumbnail}
          onChangeThumbnail={(next) =>
            onUpdateMedia((prev) => ({ ...prev, thumbnail: next }))
          }
        />
      )}
    </div>
  );
};
