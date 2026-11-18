import React, { useRef, useState } from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import type { MediaStudioState } from "../../types/studio";

interface SvgThumbnailDesignerProps {
  thumbnail: MediaStudioState["thumbnail"];
  onChangeThumbnail: (next: MediaStudioState["thumbnail"]) => void;
}

const ACCENT_SWATCHES = [
  "#EC4899",
  "#F26B5B",
  "#FACC15",
  "#10B981",
  "#0EA5E9",
  "#6366F1",
];

const RATIO_DIMS: Record<
  MediaStudioState["thumbnail"]["ratio"],
  { w: number; h: number; label: string }
> = {
  "16:9": { w: 1280, h: 720, label: "YouTube 16:9" },
  "4:5": { w: 1080, h: 1350, label: "IG Carousel 4:5" },
  "1:1": { w: 1080, h: 1080, label: "Square 1:1" },
};

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export const SvgThumbnailDesigner: React.FC<SvgThumbnailDesignerProps> = ({
  thumbnail,
  onChangeThumbnail,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [downloading, setDownloading] = useState(false);

  const dims = RATIO_DIMS[thumbnail.ratio];
  const headlineLines = wrapLines(
    thumbnail.headline || "Your High-Contrast Headline",
    thumbnail.ratio === "16:9" ? 20 : 16
  );
  const subLines = wrapLines(
    thumbnail.subheadline || "Actionable creator breakdown",
    thumbnail.ratio === "16:9" ? 42 : 32
  );

  const handleDownloadPng = async () => {
    const svgEl = svgRef.current;
    if (!svgEl || downloading) return;
    setDownloading(true);
    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, dims.w, dims.h);
        const pngBlob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/png")
        );
        if (pngBlob) {
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = `studioos-graphic-${thumbnail.ratio.replace(":", "x")}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }
      }
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSvg = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const blob = new Blob([serializer.serializeToString(svgEl)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studioos-graphic-${thumbnail.ratio.replace(":", "x")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Controls */}
      <div className="lg:col-span-5 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[#EC4899]" />
          <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
            SVG Thumbnail &amp; Carousel Designer
          </h3>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            Format
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(RATIO_DIMS) as Array<MediaStudioState["thumbnail"]["ratio"]>).map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChangeThumbnail({ ...thumbnail, ratio: r })}
                  className={`rounded-xl px-2.5 py-2 text-xs font-semibold ${
                    thumbnail.ratio === r
                      ? "bg-[#EC4899] text-white"
                      : "bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96]"
                  }`}
                >
                  {RATIO_DIMS[r].label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Layout Template */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            Layout Style
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "bold-split", label: "Bold Split" },
                { id: "editorial-card", label: "Warm Cream" },
                { id: "studio-gradient", label: "Glow Studio" },
              ] as const
            ).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() =>
                  onChangeThumbnail({ ...thumbnail, templateId: tpl.id })
                }
                className={`rounded-xl px-2.5 py-2 text-xs font-semibold ${
                  thumbnail.templateId === tpl.id
                    ? "bg-[#1E1E1E] dark:bg-[#F5F2EC] text-[#FAF7F2] dark:text-[#1E1E1E]"
                    : "bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96]"
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Swatches */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            Accent Color
          </span>
          <div className="flex items-center gap-2">
            {ACCENT_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => onChangeThumbnail({ ...thumbnail, accentHex: hex })}
                aria-label={`Select accent ${hex}`}
                className={`h-7 w-7 rounded-lg transition-transform ${
                  thumbnail.accentHex === hex
                    ? "ring-2 ring-offset-2 ring-[#1E1E1E] dark:ring-[#F5F2EC] scale-110"
                    : ""
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        {/* Text Fields */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            Kicker Badge
            <input
              type="text"
              value={thumbnail.kicker}
              onChange={(e) =>
                onChangeThumbnail({ ...thumbnail, kicker: e.target.value })
              }
              className="mt-1 h-9 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#EC4899] focus:outline-none"
            />
          </label>

          <label className="block text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            Main Headline
            <input
              type="text"
              value={thumbnail.headline}
              onChange={(e) =>
                onChangeThumbnail({ ...thumbnail, headline: e.target.value })
              }
              className="mt-1 h-9 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#EC4899] focus:outline-none"
            />
          </label>

          <label className="block text-xs font-medium text-[#6E685F] dark:text-[#9A9389]">
            Subheadline
            <input
              type="text"
              value={thumbnail.subheadline}
              onChange={(e) =>
                onChangeThumbnail({ ...thumbnail, subheadline: e.target.value })
              }
              className="mt-1 h-9 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#EC4899] focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownloadPng()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#EC4899] px-4 text-xs font-semibold text-white hover:bg-[#DB2777]"
          >
            <Download className="h-4 w-4" />
            Download PNG (Offline)
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] px-3.5 text-xs font-semibold hover:border-[#EC4899]"
          >
            SVG
          </button>
        </div>
      </div>

      {/* Live High-Contrast SVG Preview */}
      <div className="lg:col-span-7 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-3">
        <div className="flex items-center justify-between text-xs text-[#6E685F] dark:text-[#9A9389]">
          <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
            Live Export Canvas ({dims.w} × {dims.h}px)
          </span>
          <span>100% Vector + Offline PNG Export</span>
        </div>

        <div className="flex justify-center rounded-xl bg-[#FAF7F2] dark:bg-[#161513] p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dims.w} ${dims.h}`}
            xmlns="http://www.w3.org/2000/svg"
            className={`rounded-xl shadow-lg ${
              thumbnail.ratio === "16:9" ? "w-full h-auto" : "max-h-[460px] w-auto"
            }`}
          >
            <defs>
              <linearGradient id="studioGrad" x1="0" y1="0" x2="1" y2="1">
                <stop
                  offset="0%"
                  stopColor={
                    thumbnail.templateId === "editorial-card" ? "#FAF7F2" : "#18141A"
                  }
                />
                <stop
                  offset="100%"
                  stopColor={
                    thumbnail.templateId === "editorial-card" ? "#EFE8DB" : "#281D2B"
                  }
                />
              </linearGradient>
            </defs>

            <rect width={dims.w} height={dims.h} fill="url(#studioGrad)" />

            {/* Decorative Accent Geometry */}
            {thumbnail.templateId === "bold-split" && (
              <rect
                x={dims.w * 0.72}
                y={0}
                width={dims.w * 0.28}
                height={dims.h}
                fill={thumbnail.accentHex}
              />
            )}
            {thumbnail.templateId === "studio-gradient" && (
              <circle
                cx={dims.w * 0.84}
                cy={dims.h * 0.25}
                r={dims.w * 0.24}
                fill={thumbnail.accentHex}
                opacity={0.28}
              />
            )}
            {thumbnail.templateId === "editorial-card" && (
              <rect
                x={64}
                y={64}
                width={dims.w - 128}
                height={dims.h - 128}
                rx={28}
                fill="#FFFFFF"
                stroke="#E8E2D8"
                strokeWidth={4}
              />
            )}

            {/* Kicker Badge */}
            <rect
              x={100}
              y={120}
              width={Math.max(220, (thumbnail.kicker || "CREATOR").length * 18 + 54)}
              height={54}
              rx={12}
              fill={thumbnail.accentHex}
            />
            <text
              x={128}
              y={156}
              fill="#FFFFFF"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="800"
              fontSize="24"
              letterSpacing="2"
            >
              {(thumbnail.kicker || "CREATOR").toUpperCase()}
            </text>

            {/* Headline */}
            {headlineLines.map((ln, idx) => (
              <text
                key={`hl-${idx}`}
                x={100}
                y={275 + idx * (thumbnail.ratio === "16:9" ? 96 : 104)}
                fill={
                  thumbnail.templateId === "editorial-card" ? "#1E1E1E" : "#FAF7F2"
                }
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontSize={thumbnail.ratio === "16:9" ? "84" : "88"}
              >
                {ln}
              </text>
            ))}

            {/* Subheadline */}
            {subLines.map((ln, idx) => (
              <text
                key={`sub-${idx}`}
                x={100}
                y={dims.h - 170 + idx * 44}
                fill={
                  thumbnail.templateId === "editorial-card" ? "#5C5750" : "#D6CFC4"
                }
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="600"
                fontSize="32"
              >
                {ln}
              </text>
            ))}

            {/* Accent Bar */}
            <rect
              x={100}
              y={dims.h - 86}
              width={160}
              height={12}
              rx={6}
              fill={thumbnail.accentHex}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
