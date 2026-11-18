import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Sparkles,
  Scissors,
  Plus,
  Trash2,
  Loader2,
  Film,
  ImagePlus,
  Wand2,
  Mic,
  Volume2,
  VolumeX,
  Video,
  X,
  FileAudio,
  Check,
} from "lucide-react";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import {
  buildGoogleFlowPrompt,
  buildOfflineHumanSvgDataUri,
  drawCoverMediaWithKenBurns,
  drawCoverVideoFullBleed,
  pickVisualForScene,
  resizeImageFileToDataUrl,
} from "../../lib/reelVisuals";
import type {
  KineticScene,
  MediaStudioState,
  ReelVoiceId,
} from "../../types/studio";

interface KineticReelMakerProps {
  media: MediaStudioState;
  isOnline: boolean;
  onUpdateMedia: (updater: (prev: MediaStudioState) => MediaStudioState) => void;
}

const THEMES: Record<
  MediaStudioState["themeId"],
  { label: string; bg: string; bgAlt: string; text: string; accent: string }
> = {
  magenta: {
    label: "Magenta Studio",
    bg: "#1A1118",
    bgAlt: "#2E1525",
    text: "#FAF7F2",
    accent: "#EC4899",
  },
  cream: {
    label: "Warm Editorial",
    bg: "#26211B",
    bgAlt: "#3E342A",
    text: "#FAF7F2",
    accent: "#EC4899",
  },
  midnight: {
    label: "Indigo Night",
    bg: "#111324",
    bgAlt: "#1B2040",
    text: "#F5F2EC",
    accent: "#6366F1",
  },
  emerald: {
    label: "Emerald Crisp",
    bg: "#0F1E18",
    bgAlt: "#173328",
    text: "#F5F2EC",
    accent: "#10B981",
  },
};

const VOICE_OPTIONS: Array<{ id: ReelVoiceId; label: string }> = [
  { id: "Kore", label: "Kore · Warm" },
  { id: "Puck", label: "Puck · Upbeat" },
  { id: "Zephyr", label: "Zephyr · Crisp" },
  { id: "Charon", label: "Charon · Deep" },
];

function splitScriptLocally(
  script: string,
  aspectRatio: "9:16" | "16:9"
): KineticScene[] {
  const rawParts = script
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parts =
    rawParts.length > 0 ? rawParts : [script.trim() || "Create something bold today."];

  const used = new Set<string>();

  return parts.map((line, idx) => {
    const words = line.replace(/[^\w\s'-]/g, "").split(/\s+/).filter(Boolean);
    const emphasisWord =
      words.find((w) => w.length >= 4)?.toUpperCase() ||
      words[0]?.toUpperCase() ||
      "FOCUS";
    const bRollCue = idx === 0 ? "Creator filming close-up" : "Focused desk & lifestyle B-roll";
    const draftScene: KineticScene = {
      id: `sc-local-${Date.now()}-${idx}`,
      text: line,
      emphasisWord,
      durationSec: Math.min(4, Math.max(2, Number((words.length * 0.35).toFixed(1)))),
      bRollCue,
      veoPrompt: buildGoogleFlowPrompt({
        text: line,
        bRollCue,
        aspectRatio,
      }),
      svgFallbackSeed: idx,
    };
    const visual = pickVisualForScene(draftScene, idx, used);
    return {
      ...draftScene,
      mediaUrl: visual.url,
      mediaType: "image",
      mediaLabel: visual.label,
      svgFallbackSeed: visual.svgIndex,
    };
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const len = binary.length;
  const buf = new ArrayBuffer(len);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const KineticReelMaker: React.FC<KineticReelMakerProps> = ({
  media,
  isOnline,
  onUpdateMedia,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetSceneIdRef = useRef<string | null>(null);

  // Media element caches for untainted Canvas drawing
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const svgFallbackCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const sessionVideoUrlsRef = useRef<Map<string, string>>(new Map());

  // Voiceover WebAudio cache, per-scene WAV cache & video audio routing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceBufferRef = useRef<AudioBuffer | null>(null);
  const voiceCacheKeyRef = useRef<string>("");
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const sceneWavCacheRef = useRef<Map<string, string>>(new Map());
  const videoAudioNodesRef = useRef<
    Map<HTMLVideoElement, { source: MediaElementAudioSourceNode; gain: GainNode }>
  >(new Map());
  const lastPreviewSceneIdRef = useRef<string | null>(null);
  const flowToastTimerRef = useRef<number | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [downloadingSceneId, setDownloadingSceneId] = useState<string | null>(null);
  const [downloadedSceneId, setDownloadedSceneId] = useState<string | null>(null);
  const [flowToast, setFlowToast] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceEngine, setVoiceEngine] = useState<"gemini-3.8-flash-tts" | "speechSynthesis" | null>(null);
  const [voiceDurationSec, setVoiceDurationSec] = useState<number>(0);
  const [mediaLoadTick, setMediaLoadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const voiceoverEnabled = Boolean(media.voiceoverEnabled);
  const voiceId: ReelVoiceId = media.voiceId ?? "Kore";

  const narrationText = useMemo(
    () =>
      media.scenes.length > 0
        ? media.scenes.map((s) => s.text.trim()).filter(Boolean).join(". ")
        : media.scriptText.trim(),
    [media.scenes, media.scriptText]
  );

  const scenesDuration = useMemo(
    () =>
      Math.max(
        1,
        media.scenes.reduce((sum, s) => sum + Math.max(1, s.durationSec), 0)
      ),
    [media.scenes]
  );

  const totalDuration = useMemo(() => {
    if (voiceoverEnabled && voiceDurationSec > 0) {
      return Math.max(scenesDuration, Number((voiceDurationSec + 0.25).toFixed(1)));
    }
    return scenesDuration;
  }, [scenesDuration, voiceoverEnabled, voiceDurationSec]);

  const canvasDims =
    media.aspectRatio === "9:16"
      ? { width: 540, height: 960 }
      : { width: 960, height: 540 };

  const activeSceneInfo = useMemo(() => {
    let cursor = 0;
    for (let i = 0; i < media.scenes.length; i++) {
      const dur = Math.max(1, media.scenes[i].durationSec);
      const isLast = i === media.scenes.length - 1;
      if (elapsedSec <= cursor + dur || isLast) {
        return { scene: media.scenes[i], index: i, startSec: cursor };
      }
      cursor += dur;
    }
    return { scene: media.scenes[0], index: 0, startSec: 0 };
  }, [media.scenes, elapsedSec]);

  const getOrCreateAudioContext = (): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  };

  const stopPreviewAudio = () => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
        activeAudioSourceRef.current.disconnect();
      } catch {
        // already stopped
      }
      activeAudioSourceRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const ensureVideoAudioNode = (
    vid: HTMLVideoElement,
    ctx: AudioContext
  ): { source: MediaElementAudioSourceNode; gain: GainNode } | null => {
    const existing = videoAudioNodesRef.current.get(vid);
    if (existing) return existing;
    try {
      const source = ctx.createMediaElementSource(vid);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
      vid.muted = false;
      const entry = { source, gain };
      videoAudioNodesRef.current.set(vid, entry);
      return entry;
    } catch {
      return null;
    }
  };

  const pauseAllSceneVideos = () => {
    for (const vid of videoCacheRef.current.values()) {
      try {
        vid.pause();
      } catch {
        // ignore
      }
      const node = videoAudioNodesRef.current.get(vid);
      if (node) {
        node.gain.gain.value = 0;
      } else {
        vid.muted = true;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (flowToastTimerRef.current) {
        window.clearTimeout(flowToastTimerRef.current);
      }
      stopPreviewAudio();
      pauseAllSceneVideos();
      for (const objUrl of sessionVideoUrlsRef.current.values()) {
        URL.revokeObjectURL(objUrl);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close();
      }
    };
  }, []);

  // Preload images, offline SVG fallbacks, and local video clips whenever scenes/theme change
  useEffect(() => {
    const theme = THEMES[media.themeId] ?? THEMES.magenta;

    media.scenes.forEach((scene, idx) => {
      const svgSeed = scene.svgFallbackSeed ?? idx;
      const svgKey = `${media.themeId}-${svgSeed}`;
      if (!svgFallbackCacheRef.current.has(svgKey)) {
        const svgImg = new Image();
        svgImg.onload = () => setMediaLoadTick((n) => n + 1);
        svgImg.src = buildOfflineHumanSvgDataUri(
          svgSeed,
          theme.bg,
          theme.bgAlt,
          theme.accent
        );
        svgFallbackCacheRef.current.set(svgKey, svgImg);
      }

      const resolvedUrl =
        scene.mediaType === "video"
          ? sessionVideoUrlsRef.current.get(scene.id) || scene.mediaUrl
          : scene.mediaUrl;

      if (!resolvedUrl) return;

      if (scene.mediaType === "video") {
        if (!resolvedUrl.startsWith("blob:") && !resolvedUrl.startsWith("data:")) return;
        const vidKey = `${scene.id}::${resolvedUrl}`;
        if (!videoCacheRef.current.has(vidKey)) {
          const vid = document.createElement("video");
          vid.src = resolvedUrl;
          vid.muted = true;
          vid.loop = true;
          vid.playsInline = true;
          vid.preload = "auto";
          vid.onloadeddata = () => setMediaLoadTick((n) => n + 1);
          videoCacheRef.current.set(vidKey, vid);
        }
      } else {
        if (resolvedUrl.startsWith("https://") && !isOnline) return;
        if (!imageCacheRef.current.has(resolvedUrl)) {
          const img = new Image();
          if (!resolvedUrl.startsWith("data:") && !resolvedUrl.startsWith("blob:")) {
            img.crossOrigin = "anonymous";
          }
          img.onload = () => setMediaLoadTick((n) => n + 1);
          img.onerror = () => setMediaLoadTick((n) => n + 1);
          img.src = resolvedUrl;
          imageCacheRef.current.set(resolvedUrl, img);
        }
      }
    });
  }, [media.scenes, media.themeId, isOnline]);

  const getSceneDrawable = (
    scene: KineticScene | undefined,
    idx: number
  ): {
    source: HTMLImageElement | HTMLVideoElement | null;
    w: number;
    h: number;
  } => {
    if (!scene) {
      return { source: null, w: 0, h: 0 };
    }

    const theme = THEMES[media.themeId] ?? THEMES.magenta;
    const resolvedUrl =
      scene.mediaType === "video"
        ? sessionVideoUrlsRef.current.get(scene.id) || scene.mediaUrl
        : scene.mediaUrl;

    if (scene.mediaType === "video" && resolvedUrl) {
      const vid = videoCacheRef.current.get(`${scene.id}::${resolvedUrl}`);
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
        return {
          source: vid,
          w: vid.videoWidth,
          h: vid.videoHeight,
        };
      }
    }

    if (resolvedUrl && scene.mediaType !== "video") {
      const img = imageCacheRef.current.get(resolvedUrl);
      if (img && img.complete && img.naturalWidth > 0) {
        return {
          source: img,
          w: img.naturalWidth,
          h: img.naturalHeight,
        };
      }
    }

    const svgSeed = scene.svgFallbackSeed ?? idx;
    const svgKey = `${media.themeId}-${svgSeed}`;
    let svgImg = svgFallbackCacheRef.current.get(svgKey);
    if (!svgImg) {
      svgImg = new Image();
      svgImg.src = buildOfflineHumanSvgDataUri(
        svgSeed,
        theme.bg,
        theme.bgAlt,
        theme.accent
      );
      svgFallbackCacheRef.current.set(svgKey, svgImg);
    }
    if (svgImg.complete && svgImg.naturalWidth > 0) {
      return {
        source: svgImg,
        w: svgImg.naturalWidth,
        h: svgImg.naturalHeight,
      };
    }

    return { source: null, w: 0, h: 0 };
  };

  // Draw clean, natural frame onto HTML5 Canvas at exact time tSec
  const drawFrameAt = (tSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const theme = THEMES[media.themeId] ?? THEMES.magenta;

    let cursor = 0;
    let activeScene = media.scenes[0];
    let activeIndex = 0;
    let sceneProgress = 0;

    for (let i = 0; i < media.scenes.length; i++) {
      const dur = Math.max(1, media.scenes[i].durationSec);
      const isLast = i === media.scenes.length - 1;
      if (tSec <= cursor + dur || isLast) {
        activeScene = media.scenes[i];
        activeIndex = i;
        const effectiveDur = isLast ? Math.max(dur, totalDuration - cursor) : dur;
        sceneProgress = Math.min(
          1,
          Math.max(0, (tSec - cursor) / Math.max(0.5, effectiveDur))
        );
        break;
      }
      cursor += dur;
    }

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, theme.bg);
    grad.addColorStop(1, theme.bgAlt);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Full-bleed .mp4/.webm video clips behind captions, or Ken Burns zoom & pan for portrait photos / SVG fallbacks
    const drawable = getSceneDrawable(activeScene, activeIndex);
    if (drawable.source) {
      if (
        activeScene?.mediaType === "video" &&
        typeof HTMLVideoElement !== "undefined" &&
        drawable.source instanceof HTMLVideoElement
      ) {
        drawCoverVideoFullBleed({
          ctx,
          source: drawable.source,
          sourceW: drawable.w,
          sourceH: drawable.h,
          canvasW: width,
          canvasH: height,
        });
      } else {
        drawCoverMediaWithKenBurns({
          ctx,
          source: drawable.source,
          sourceW: drawable.w,
          sourceH: drawable.h,
          canvasW: width,
          canvasH: height,
          progress: sceneProgress,
          motionIndex: activeIndex,
        });
      }

      const scrim = ctx.createLinearGradient(0, 0, 0, height);
      scrim.addColorStop(0, "rgba(10, 10, 16, 0.36)");
      scrim.addColorStop(0.45, "rgba(10, 10, 16, 0.14)");
      scrim.addColorStop(0.75, "rgba(10, 10, 16, 0.62)");
      scrim.addColorStop(1, "rgba(10, 10, 16, 0.85)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, height);
    }

    // Top scene badge pill
    ctx.save();
    ctx.fillStyle = "rgba(15, 14, 18, 0.68)";
    ctx.beginPath();
    ctx.roundRect(34, 32, 166, 32, 10);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.fillRect(44, 45, 18, 5);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 15px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(
      `SCENE ${String(activeIndex + 1).padStart(2, "0")} / ${String(
        Math.max(1, media.scenes.length)
      ).padStart(2, "0")}`,
      70,
      53
    );

    if (voiceoverEnabled) {
      ctx.fillStyle = "rgba(15, 14, 18, 0.68)";
      ctx.beginPath();
      ctx.roundRect(width - 138, 32, 104, 32, 10);
      ctx.fill();
      ctx.fillStyle = "#F9A8D4";
      ctx.font = "700 13px system-ui, -apple-system, sans-serif";
      ctx.fillText("VOICEOVER", width - 120, 53);
    }
    ctx.restore();

    if (activeScene) {
      const ease = 1 - Math.pow(1 - Math.min(1, sceneProgress * 4), 3);
      const yOffset = (1 - ease) * 22;

      const isVertical = media.aspectRatio === "9:16";
      const fontSize = isVertical ? 38 : 40;
      ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const lines = wrapTextLines(ctx, activeScene.text, width - 92).slice(0, 4);
      const lineHeight = fontSize * 1.28;
      const blockHeight = lines.length * lineHeight;
      const baseCaptionTop = isVertical
        ? height - blockHeight - 130 + yOffset
        : height - blockHeight - 115 + yOffset;

      ctx.save();
      ctx.globalAlpha = Math.max(0.25, ease);

      const emp = (activeScene.emphasisWord || "FOCUS").toUpperCase();
      ctx.font = `900 ${isVertical ? 20 : 19}px system-ui, -apple-system, sans-serif`;
      const empWidth = ctx.measureText(emp).width + 28;
      const empX = 40;
      const empY = baseCaptionTop - 54;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.roundRect(empX, empY, empWidth, 38, 10);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(emp, empX + 14, empY + 26);

      ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
      let textY = baseCaptionTop;
      lines.forEach((ln) => {
        const tw = ctx.measureText(ln).width;
        ctx.fillStyle = "rgba(12, 12, 16, 0.78)";
        ctx.beginPath();
        ctx.roundRect(
          34,
          textY - fontSize + 4,
          Math.min(width - 68, tw + 28),
          lineHeight - 2,
          12
        );
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(ln, 48, textY);
        textY += lineHeight;
      });

      ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
      ctx.font = "600 15px system-ui, -apple-system, sans-serif";
      const footerLabel = activeScene.mediaLabel || activeScene.bRollCue || "Visual B-Roll";
      ctx.fillText(`Visual: ${footerLabel.slice(0, 48)}`, 40, height - 56);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = 0.85;
      ctx.font = "700 28px system-ui, -apple-system, sans-serif";
      ctx.fillText("Paste a script or add a scene", 40, height * 0.46);
      ctx.globalAlpha = 0.6;
      ctx.font = "500 18px system-ui, -apple-system, sans-serif";
      ctx.fillText("Tap Auto-Fill Visuals or + Add Clip / Photo.", 40, height * 0.46 + 38);
      ctx.restore();
    }

    // Bottom Timeline Progress Bar
    const barW = width - 80;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(40, height - 32, barW, 6);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(40, height - 32, barW * Math.min(1, tSec / totalDuration), 6);
  };

  useEffect(() => {
    if (!exporting) {
      drawFrameAt(elapsedSec);
    }
  }, [elapsedSec, media, mediaLoadTick, totalDuration, voiceoverEnabled, exporting]);

  // Keep active video clip & native clip audio synced during live preview
  useEffect(() => {
    if (!playing || exporting) {
      if (!exporting) {
        lastPreviewSceneIdRef.current = null;
        pauseAllSceneVideos();
      }
      return;
    }

    const active = activeSceneInfo.scene;
    const activeUrl =
      active?.mediaType === "video"
        ? sessionVideoUrlsRef.current.get(active.id) || active.mediaUrl
        : undefined;
    const activeVidKey = active && activeUrl ? `${active.id}::${activeUrl}` : "";

    for (const [key, vid] of videoCacheRef.current.entries()) {
      if (key !== activeVidKey) {
        if (!vid.paused) vid.pause();
        const node = videoAudioNodesRef.current.get(vid);
        if (node) node.gain.gain.value = 0;
        else vid.muted = true;
      }
    }

    if (active?.mediaType === "video" && activeUrl) {
      const vid = videoCacheRef.current.get(activeVidKey);
      if (vid) {
        const sceneChanged = lastPreviewSceneIdRef.current !== active.id;
        lastPreviewSceneIdRef.current = active.id;
        if (sceneChanged) {
          try {
            vid.currentTime = 0;
          } catch {
            // ignore seek error before metadata ready
          }
        }
        const node = videoAudioNodesRef.current.get(vid);
        if (node) {
          node.gain.gain.value = active.clipAudioMuted ? 0 : 1;
          vid.muted = false;
        } else {
          vid.muted = Boolean(active.clipAudioMuted);
        }
        if (vid.paused) {
          void vid.play().catch(() => {});
        }
      }
    } else {
      lastPreviewSceneIdRef.current = active?.id || null;
    }
  }, [playing, exporting, activeSceneInfo.scene, media.scenes]);

  // Playback loop
  useEffect(() => {
    if (!playing || exporting) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setElapsedSec((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setPlaying(false);
          stopPreviewAudio();
          return 0;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, exporting, totalDuration]);

  const fetchGeminiTtsBase64 = async (
    textToSpeak: string
  ): Promise<{ audioBase64: string; modelUsed: string }> => {
    const resp = await fetch("/api/media/voiceover", {
      method: "POST",
      headers: getAiRequestHeaders(),
      body: JSON.stringify({
        script: textToSpeak,
        voiceName: voiceId,
      }),
    });
    const data = (await resp.json()) as {
      audioBase64?: string;
      modelUsed?: string;
      error?: string;
    };
    if (!resp.ok || !data.audioBase64) {
      throw new Error(data.error || "Gemini TTS unavailable");
    }
    return {
      audioBase64: data.audioBase64,
      modelUsed: data.modelUsed || "gemini-3.8-flash-tts",
    };
  };

  const ensureVoiceoverAudio = async (): Promise<{
    buffer: AudioBuffer | null;
    engine: "gemini-3.8-flash-tts" | "speechSynthesis";
  }> => {
    if (!narrationText) {
      return { buffer: null, engine: "speechSynthesis" };
    }

    const desiredKey = `${voiceId}::${narrationText}`;
    if (voiceBufferRef.current && voiceCacheKeyRef.current === desiredKey) {
      return { buffer: voiceBufferRef.current, engine: "gemini-3.8-flash-tts" };
    }

    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setVoiceEngine("speechSynthesis");
      setVoiceStatus("Offline: using browser speechSynthesis preview fallback");
      return { buffer: null, engine: "speechSynthesis" };
    }

    setVoiceLoading(true);
    setVoiceStatus(`Generating voiceover (${voiceId} · gemini-3.8-flash-tts)...`);

    try {
      const { audioBase64 } = await fetchGeminiTtsBase64(narrationText);
      const audioCtx = getOrCreateAudioContext();
      await audioCtx.resume();
      const bytes = base64ToUint8Array(audioBase64);
      const decoded = await audioCtx.decodeAudioData(bytes.buffer.slice(0));

      voiceBufferRef.current = decoded;
      voiceCacheKeyRef.current = desiredKey;
      setVoiceDurationSec(decoded.duration);
      setVoiceEngine("gemini-3.8-flash-tts");
      setVoiceStatus(
        `Voiceover ready · ${decoded.duration.toFixed(1)}s (gemini-3.8-flash-tts)`
      );
      return { buffer: decoded, engine: "gemini-3.8-flash-tts" };
    } catch {
      voiceBufferRef.current = null;
      voiceCacheKeyRef.current = "";
      setVoiceDurationSec(0);
      setVoiceEngine("speechSynthesis");
      setVoiceStatus("Using browser speechSynthesis narration fallback");
      return { buffer: null, engine: "speechSynthesis" };
    } finally {
      setVoiceLoading(false);
    }
  };

  // 1-Click Scene Audio Export (.wav) for external neural lip-sync tools
  const handleDownloadSceneWav = async (scene: KineticScene, idx: number) => {
    const cleanText = scene.text.trim();
    if (!cleanText || downloadingSceneId) return;

    setError(null);
    const cacheKey = `${voiceId}::${cleanText}`;
    const cachedBase64 = sceneWavCacheRef.current.get(cacheKey);

    const triggerWavDownload = (b64: string) => {
      const bytes = base64ToUint8Array(b64);
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scene-${idx + 1}-voiceover-${voiceId.toLowerCase()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadedSceneId(scene.id);
      window.setTimeout(
        () => setDownloadedSceneId((cur) => (cur === scene.id ? null : cur)),
        2500
      );
    };

    if (cachedBase64) {
      triggerWavDownload(cachedBase64);
      return;
    }

    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setError(
        "Connect online once to generate gemini-3.8-flash-tts .wav audio for this scene."
      );
      return;
    }

    setDownloadingSceneId(scene.id);
    try {
      const { audioBase64 } = await fetchGeminiTtsBase64(cleanText);
      sceneWavCacheRef.current.set(cacheKey, audioBase64);
      triggerWavDownload(audioBase64);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate scene voiceover (.wav)."
      );
    } finally {
      setDownloadingSceneId(null);
    }
  };

  const handleTogglePlay = async () => {
    if (exporting) return;

    if (playing) {
      setPlaying(false);
      stopPreviewAudio();
      return;
    }

    const hasVideoClips = media.scenes.some((s) => s.mediaType === "video");
    if (hasVideoClips || (voiceoverEnabled && narrationText)) {
      const audioCtx = getOrCreateAudioContext();
      await audioCtx.resume();
      for (const vid of videoCacheRef.current.values()) {
        ensureVideoAudioNode(vid, audioCtx);
      }
    }

    if (voiceoverEnabled && narrationText) {
      const { buffer, engine } = await ensureVoiceoverAudio();
      if (engine === "gemini-3.8-flash-tts" && buffer) {
        const audioCtx = getOrCreateAudioContext();
        await audioCtx.resume();
        stopPreviewAudio();

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        const startOffset = elapsedSec < buffer.duration ? elapsedSec : 0;
        source.start(0, startOffset);
        activeAudioSourceRef.current = source;
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(narrationText);
        utt.rate = 1.02;
        window.speechSynthesis.speak(utt);
      }
    }

    setPlaying(true);
  };

  const handleAutoFillVisuals = () => {
    if (media.scenes.length === 0) return;
    const used = new Set<string>();

    onUpdateMedia((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene, idx) => {
        const asset = pickVisualForScene(scene, idx, used);
        if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
          const theme = THEMES[prev.themeId] ?? THEMES.magenta;
          const svgUrl = buildOfflineHumanSvgDataUri(
            asset.svgIndex,
            theme.bg,
            theme.bgAlt,
            theme.accent
          );
          return {
            ...scene,
            mediaUrl: svgUrl,
            mediaType: "image",
            mediaLabel: `${asset.label} (Offline illustration)`,
            svgFallbackSeed: asset.svgIndex,
          };
        }
        return {
          ...scene,
          mediaUrl: asset.url,
          mediaType: "image",
          mediaLabel: asset.label,
          svgFallbackSeed: asset.svgIndex,
        };
      }),
    }));
    setError(null);
  };

  const handleTriggerSceneUpload = (sceneId: string) => {
    uploadTargetSceneIdRef.current = sceneId;
    fileInputRef.current?.click();
  };

  const handleSceneFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const sceneId = uploadTargetSceneIdRef.current;
    e.target.value = "";
    if (!file || !sceneId) return;

    setError(null);
    try {
      if (file.type.startsWith("video/")) {
        const prevObj = sessionVideoUrlsRef.current.get(sceneId);
        if (prevObj) URL.revokeObjectURL(prevObj);
        const objUrl = URL.createObjectURL(file);
        sessionVideoUrlsRef.current.set(sceneId, objUrl);
        updateScene(sceneId, {
          mediaUrl: objUrl,
          mediaType: "video",
          mediaLabel: `Clip: ${file.name}`,
          clipAudioMuted: false,
        });
      } else if (file.type.startsWith("image/")) {
        const dataUrl = await resizeImageFileToDataUrl(file, 1080);
        updateScene(sceneId, {
          mediaUrl: dataUrl,
          mediaType: "image",
          mediaLabel: `Photo: ${file.name}`,
          clipAudioMuted: undefined,
        });
      } else {
        setError("Please select an image (.jpg/.png/.webp) or video clip (.mp4/.webm).");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load selected clip or photo."
      );
    }
  };

  const handleBridgeToGoogleFlow = async (scene: KineticScene) => {
    const promptText =
      scene.veoPrompt?.trim() ||
      buildGoogleFlowPrompt({
        text: scene.text,
        bRollCue: scene.bRollCue,
        aspectRatio: media.aspectRatio,
      });

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = promptText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        // Proceed cleanly even if clipboard is blocked
      }
    }

    if (flowToastTimerRef.current) {
      window.clearTimeout(flowToastTimerRef.current);
    }
    setFlowToast(
      "Scene prompt copied! Paste it into Google Flow, download the .mp4, and tap '+ Add Clip / Photo' to drop it into this scene"
    );
    flowToastTimerRef.current = window.setTimeout(() => {
      setFlowToast(null);
    }, 7500);
  };

  const handleAiSplit = async () => {
    if (!isOnline || aiLoading || !media.scriptText.trim()) return;
    setAiLoading(true);
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
        throw new Error(data.error || "Could not split script with AI.");
      }

      const used = new Set<string>();
      const nextScenes: KineticScene[] = (data.scenes || []).map(
        (s: Record<string, unknown>, idx: number) => {
          const text = String(s.text || "");
          const bRollCue = String(s.bRollCue || "Studio B-roll");
          const rawPrompt = typeof s.veoPrompt === "string" ? s.veoPrompt.trim() : "";
          const base: KineticScene = {
            id: `sc-ai-${Date.now()}-${idx}`,
            text,
            emphasisWord: String(s.emphasisWord || "KEY"),
            durationSec: Math.max(1.5, Number(s.durationSec || 2.5)),
            bRollCue,
            veoPrompt:
              rawPrompt ||
              buildGoogleFlowPrompt({
                text,
                bRollCue,
                aspectRatio: media.aspectRatio,
              }),
            svgFallbackSeed: idx,
          };
          const visual = pickVisualForScene(base, idx, used);
          return {
            ...base,
            mediaUrl: visual.url,
            mediaType: "image",
            mediaLabel: visual.label,
            svgFallbackSeed: visual.svgIndex,
          };
        }
      );

      if (nextScenes.length > 0) {
        onUpdateMedia((prev) => ({ ...prev, scenes: nextScenes }));
        setElapsedSec(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI split failed.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLocalSplit = () => {
    const nextScenes = splitScriptLocally(media.scriptText, media.aspectRatio);
    onUpdateMedia((prev) => ({ ...prev, scenes: nextScenes }));
    setElapsedSec(0);
    setError(null);
  };

  const handleExportWebm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    if (typeof MediaRecorder === "undefined" || !("captureStream" in canvas)) {
      setError("WebM recording is not supported in this browser.");
      return;
    }

    setPlaying(false);
    stopPreviewAudio();
    setExporting(true);
    setError(null);
    setExportStatus("Preparing visuals & captions...");

    let exportAudioSource: AudioBufferSourceNode | null = null;
    let exportDuration = scenesDuration;
    const connectedExportGains: Array<{ gain: GainNode; dest: MediaStreamAudioDestinationNode }> = [];

    try {
      let voiceBuffer: AudioBuffer | null = null;
      let usedFallbackSpeech = false;

      if (voiceoverEnabled && narrationText) {
        setExportStatus("Preparing voiceover narration (gemini-3.8-flash-tts)...");
        const voiceResult = await ensureVoiceoverAudio();
        if (voiceResult.engine === "gemini-3.8-flash-tts" && voiceResult.buffer) {
          voiceBuffer = voiceResult.buffer;
          exportDuration = Math.max(
            scenesDuration,
            Number((voiceBuffer.duration + 0.25).toFixed(1))
          );
        } else {
          usedFallbackSpeech = true;
        }
      }

      const hasUnmutedVideoClip = media.scenes.some(
        (s) => s.mediaType === "video" && !s.clipAudioMuted
      );

      const canvasStream = canvas.captureStream(30);
      let combinedStream: MediaStream = canvasStream;
      let dest: MediaStreamAudioDestinationNode | null = null;

      if (voiceBuffer || hasUnmutedVideoClip) {
        const audioCtx = getOrCreateAudioContext();
        await audioCtx.resume();
        dest = audioCtx.createMediaStreamDestination();

        if (voiceBuffer) {
          exportAudioSource = audioCtx.createBufferSource();
          exportAudioSource.buffer = voiceBuffer;
          exportAudioSource.connect(dest);
        }

        if (hasUnmutedVideoClip) {
          for (const sc of media.scenes) {
            if (sc.mediaType !== "video" || sc.clipAudioMuted) continue;
            const url = sessionVideoUrlsRef.current.get(sc.id) || sc.mediaUrl;
            if (!url) continue;
            const vid = videoCacheRef.current.get(`${sc.id}::${url}`);
            if (!vid) continue;
            const node = ensureVideoAudioNode(vid, audioCtx);
            if (node) {
              node.gain.gain.value = 0;
              node.gain.connect(dest);
              connectedExportGains.push({ gain: node.gain, dest });
            }
          }
        }

        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
      }

      const preferredCodecs = dest
        ? [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=opus",
            "video/webm",
          ]
        : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

      const mimeType =
        preferredCodecs.find((c) => MediaRecorder.isTypeSupported(c)) || "video/webm";

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
      });

      pauseAllSceneVideos();

      setExportStatus(
        voiceBuffer && hasUnmutedVideoClip
          ? "Rendering .webm with .mp4 clips, clip audio, captions & AI voiceover..."
          : voiceBuffer
          ? "Rendering .webm with visuals, captions & AI voiceover..."
          : hasUnmutedVideoClip
          ? "Rendering .webm with .mp4 clips, clip audio & captions..."
          : "Rendering .webm frames offline..."
      );

      recorder.start();
      if (exportAudioSource) {
        exportAudioSource.start(0);
      }

      const resolveSceneAtTime = (t: number) => {
        let cursor = 0;
        for (let i = 0; i < media.scenes.length; i++) {
          const dur = Math.max(1, media.scenes[i].durationSec);
          const isLast = i === media.scenes.length - 1;
          if (t <= cursor + dur || isLast) {
            return media.scenes[i];
          }
          cursor += dur;
        }
        return media.scenes[0];
      };

      let lastExportSceneId: string | null = null;
      const fps = 30;
      const totalFrames = Math.ceil(exportDuration * fps);
      for (let f = 0; f <= totalFrames; f++) {
        const t = (f / totalFrames) * exportDuration;
        const sc = resolveSceneAtTime(t);
        if (sc && sc.id !== lastExportSceneId) {
          lastExportSceneId = sc.id;
          pauseAllSceneVideos();
          if (sc.mediaType === "video") {
            const url = sessionVideoUrlsRef.current.get(sc.id) || sc.mediaUrl;
            const vid = url ? videoCacheRef.current.get(`${sc.id}::${url}`) : undefined;
            if (vid) {
              try {
                vid.currentTime = 0;
              } catch {
                // ignore seek error
              }
              const node = videoAudioNodesRef.current.get(vid);
              if (node) {
                node.gain.gain.value = sc.clipAudioMuted ? 0 : 1;
              }
              await vid.play().catch(() => {});
            }
          }
        }
        drawFrameAt(t);
        setElapsedSec(t);
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      recorder.stop();
      if (exportAudioSource) {
        try {
          exportAudioSource.stop();
        } catch {
          // ignore
        }
      }
      pauseAllSceneVideos();

      const blob = await stopped;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studioos-reel-${media.aspectRatio.replace(":", "x")}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setExportStatus(
        voiceBuffer
          ? "Downloaded .webm with visuals, captions & Gemini voiceover!"
          : usedFallbackSpeech
          ? "Downloaded .webm video! (Browser speechSynthesis plays in preview only.)"
          : "Downloaded .webm video!"
      );
      setTimeout(() => setExportStatus(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export .webm.");
      setExportStatus(null);
    } finally {
      for (const item of connectedExportGains) {
        try {
          item.gain.gain.value = 0;
          item.gain.disconnect(item.dest);
        } catch {
          // ignore
        }
      }
      pauseAllSceneVideos();
      setExporting(false);
    }
  };

  const updateScene = (id: string, patch: Partial<KineticScene>) => {
    onUpdateMedia((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const handleClearSceneMedia = (sceneId: string) => {
    const prevObj = sessionVideoUrlsRef.current.get(sceneId);
    if (prevObj) {
      URL.revokeObjectURL(prevObj);
      sessionVideoUrlsRef.current.delete(sceneId);
    }
    updateScene(sceneId, {
      mediaUrl: undefined,
      mediaType: undefined,
      mediaLabel: undefined,
    });
  };

  const handleToggleVoiceover = async () => {
    const nextEnabled = !voiceoverEnabled;
    onUpdateMedia((prev) => ({ ...prev, voiceoverEnabled: nextEnabled }));
    if (!nextEnabled) {
      stopPreviewAudio();
      setVoiceStatus(null);
      return;
    }
    if (narrationText) {
      await ensureVoiceoverAudio();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Hidden gallery file picker shared across scene cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        onChange={(e) => void handleSceneFileSelected(e)}
        className="hidden"
      />

      {/* Left: Script & Scene Editor */}
      <div className="lg:col-span-7 space-y-5">
        <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Script to Kinetic Scenes
            </h3>
            <div className="flex items-center gap-1.5">
              {(["9:16", "16:9"] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() =>
                    onUpdateMedia((prev) => ({ ...prev, aspectRatio: ratio }))
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ${
                    media.aspectRatio === ratio
                      ? "bg-[#EC4899] text-white"
                      : "bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96]"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={4}
            value={media.scriptText}
            onChange={(e) =>
              onUpdateMedia((prev) => ({ ...prev, scriptText: e.target.value }))
            }
            placeholder="Paste your short-form script here..."
            className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 py-3 text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#EC4899] focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!isOnline || aiLoading || !media.scriptText.trim()}
              onClick={() => void handleAiSplit()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#EC4899] px-3.5 text-xs font-semibold text-white hover:bg-[#DB2777] disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI Split Scenes + Prompts
            </button>

            <button
              type="button"
              onClick={handleLocalSplit}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#EC4899]"
            >
              <Scissors className="h-3.5 w-3.5 text-[#EC4899]" />
              Split Locally (Offline)
            </button>

            <div className="ml-auto flex items-center gap-1">
              {(Object.keys(THEMES) as Array<MediaStudioState["themeId"]>).map(
                (tId) => (
                  <button
                    key={tId}
                    type="button"
                    onClick={() =>
                      onUpdateMedia((prev) => ({ ...prev, themeId: tId }))
                    }
                    title={THEMES[tId].label}
                    className={`h-7 w-7 rounded-lg border-2 transition-transform ${
                      media.themeId === tId
                        ? "border-[#EC4899] scale-110"
                        : "border-transparent opacity-70"
                    }`}
                    style={{ backgroundColor: THEMES[tId].bg }}
                  />
                )
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626]">
              {error}
            </p>
          )}
        </div>

        {/* Editable Scene Timeline */}
        <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Timed Scenes ({media.scenes.length}) · {totalDuration.toFixed(1)}s
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={media.scenes.length === 0}
                onClick={handleAutoFillVisuals}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#EC4899]/12 px-2.5 text-xs font-semibold text-[#BE185D] dark:text-[#F9A8D4] hover:bg-[#EC4899]/20 disabled:opacity-40"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Auto-Fill Visuals
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateMedia((prev) => ({
                    ...prev,
                    scenes: [
                      ...prev.scenes,
                      {
                        id: `sc-${Date.now()}`,
                        text: "New kinetic punchline here.",
                        emphasisWord: "NEW",
                        durationSec: 2.5,
                        bRollCue: "Creator studio shot",
                        veoPrompt: buildGoogleFlowPrompt({
                          text: "New kinetic punchline here.",
                          bRollCue: "Creator studio shot",
                          aspectRatio: prev.aspectRatio,
                        }),
                        svgFallbackSeed: prev.scenes.length,
                      },
                    ],
                  }))
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs font-semibold text-[#EC4899]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Scene
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {media.scenes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] px-4 py-6 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
                No scenes yet — paste a script above and split scenes, or click{" "}
                <strong>+ Add Scene</strong>.
              </p>
            ) : (
              media.scenes.map((scene, idx) => {
                const activeClipUrl =
                  scene.mediaType === "video"
                    ? sessionVideoUrlsRef.current.get(scene.id) || scene.mediaUrl
                    : scene.mediaUrl;
                const hasCustomOrAutoMedia = Boolean(activeClipUrl);
                const isDownloadingThis = downloadingSceneId === scene.id;
                const isDownloadedThis = downloadedSceneId === scene.id;

                return (
                  <div
                    key={scene.id}
                    className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#EC4899]">
                        SCENE {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#6E685F] flex items-center gap-1">
                          Sec:
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={0.5}
                            value={scene.durationSec}
                            onChange={(e) =>
                              updateScene(scene.id, {
                                durationSec: Math.max(1, Number(e.target.value) || 2),
                              })
                            }
                            className="w-14 rounded-md border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-1.5 py-0.5 text-xs tabular-nums"
                          />
                        </label>
                        {media.scenes.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMedia((prev) => ({
                                ...prev,
                                scenes: prev.scenes.filter((s) => s.id !== scene.id),
                              }))
                            }
                            aria-label={`Delete scene ${idx + 1}`}
                            className="text-[#8C857B] hover:text-[#DC2626]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={scene.text}
                      onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                      className="h-8 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-medium focus:border-[#EC4899] focus:outline-none"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={scene.emphasisWord}
                        onChange={(e) =>
                          updateScene(scene.id, { emphasisWord: e.target.value })
                        }
                        placeholder="Emphasis badge word"
                        className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-[11px] focus:border-[#EC4899] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={scene.bRollCue}
                        onChange={(e) =>
                          updateScene(scene.id, { bRollCue: e.target.value })
                        }
                        placeholder="B-Roll visual cue"
                        className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-[11px] focus:border-[#EC4899] focus:outline-none"
                      />
                    </div>

                    {/* Per-Scene Visual Background + Google Flow Video Bridge + Clip Audio + WAV Export */}
                    <div className="space-y-2 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {scene.mediaType === "video" && activeClipUrl ? (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#EC4899]/15 text-[#EC4899]">
                              <Video className="h-4 w-4" />
                            </span>
                          ) : hasCustomOrAutoMedia ? (
                            <img
                              src={activeClipUrl}
                              alt={scene.mediaLabel || "Scene visual"}
                              className="h-8 w-8 shrink-0 rounded-md object-cover border border-[#E8E2D8] dark:border-[#322E29]"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#FAF7F2] dark:bg-[#161513] text-[#8C857B]">
                              <Film className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span className="text-[11px] text-[#5C5750] dark:text-[#A69F96] truncate max-w-[160px] sm:max-w-[210px]">
                            {scene.mediaLabel || "Offline human-silhouette fallback"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {hasCustomOrAutoMedia && (
                            <button
                              type="button"
                              onClick={() => handleClearSceneMedia(scene.id)}
                              title="Clear attached clip or photo"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[#8C857B] hover:text-[#DC2626] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {scene.mediaType === "video" && (
                            <button
                              type="button"
                              onClick={() =>
                                updateScene(scene.id, {
                                  clipAudioMuted: !Boolean(scene.clipAudioMuted),
                                })
                              }
                              title="Toggle native clip audio vs StudioOS voiceover narration"
                              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                scene.clipAudioMuted
                                  ? "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#6E685F] dark:text-[#9A9389]"
                                  : "border-[#10B981]/50 bg-[#10B981]/15 text-[#065F46] dark:text-[#A7F3D0]"
                              }`}
                            >
                              {scene.clipAudioMuted ? (
                                <VolumeX className="h-3 w-3" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                              Clip Audio: {scene.clipAudioMuted ? "Muted" : "On"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTriggerSceneUpload(scene.id)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#EC4899]/40 bg-[#EC4899]/10 px-2 text-[11px] font-semibold text-[#BE185D] dark:text-[#F9A8D4] hover:bg-[#EC4899]/20 whitespace-nowrap"
                          >
                            <ImagePlus className="h-3 w-3" />
                            + Add Clip / Photo
                          </button>

                          <a
                            href="https://labs.google/fx/tools/flow"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => void handleBridgeToGoogleFlow(scene)}
                            title="Copy formatted Google Flow / Veo 3 prompt & open Google Flow"
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#6366F1]/45 bg-[#6366F1]/12 px-2 text-[11px] font-semibold text-[#4338CA] dark:text-[#C7D2FE] hover:bg-[#6366F1]/22 whitespace-nowrap"
                          >
                            <span aria-hidden="true">🎬</span>
                            Generate in Google Flow
                          </a>

                          <button
                            type="button"
                            disabled={!scene.text.trim() || isDownloadingThis}
                            onClick={() => void handleDownloadSceneWav(scene, idx)}
                            title="Download isolated scene voiceover (.wav)"
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2 text-[11px] font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#EC4899] disabled:opacity-40 whitespace-nowrap"
                          >
                            {isDownloadingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin text-[#EC4899]" />
                            ) : isDownloadedThis ? (
                              <Check className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <FileAudio className="h-3 w-3 text-[#EC4899]" />
                            )}
                            {isDownloadedThis ? "Saved .wav" : "Download Voiceover (.wav)"}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-md bg-[#FAF7F2] dark:bg-[#161513] px-2 py-1.5">
                        <span className="shrink-0 text-[10px] font-mono font-bold uppercase tracking-wider text-[#6366F1] mt-0.5">
                          Flow Prompt
                        </span>
                        <input
                          type="text"
                          value={
                            scene.veoPrompt ??
                            buildGoogleFlowPrompt({
                              text: scene.text,
                              bRollCue: scene.bRollCue,
                              aspectRatio: media.aspectRatio,
                            })
                          }
                          onChange={(e) =>
                            updateScene(scene.id, { veoPrompt: e.target.value })
                          }
                          aria-label={`Google Flow prompt for scene ${idx + 1}`}
                          className="w-full bg-transparent text-[11px] text-[#5C5750] dark:text-[#A69F96] focus:text-[#1E1E1E] dark:focus:text-[#F5F2EC] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right: Voiceover Controls + HTML5 Canvas Preview + .webm Export */}
      <div className="lg:col-span-5 rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-[#EC4899]" />
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Canvas Video Preview ({media.aspectRatio})
            </h3>
          </div>
          <span className="text-xs font-mono text-[#6E685F] tabular-nums">
            {elapsedSec.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </span>
        </div>

        {/* Built-In Voiceover Narration Control */}
        <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={voiceoverEnabled}
              onClick={() => void handleToggleVoiceover()}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]"
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  voiceoverEnabled
                    ? "bg-[#EC4899]"
                    : "bg-[#D6CEC2] dark:bg-[#3A352F]"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    voiceoverEnabled ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </span>
              {voiceoverEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-[#EC4899]" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-[#8C857B]" />
              )}
              <span>Generate Voiceover</span>
            </button>

            {voiceoverEnabled && (
              <div className="flex items-center gap-1.5">
                <select
                  value={voiceId}
                  onChange={(e) => {
                    voiceBufferRef.current = null;
                    voiceCacheKeyRef.current = "";
                    setVoiceDurationSec(0);
                    onUpdateMedia((prev) => ({
                      ...prev,
                      voiceId: e.target.value as ReelVoiceId,
                    }));
                  }}
                  aria-label="Voiceover voice"
                  className="h-7 rounded-md border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2 text-[11px] font-medium text-[#1E1E1E] dark:text-[#F5F2EC]"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={voiceLoading || !narrationText}
                  onClick={() => void ensureVoiceoverAudio()}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[#EC4899]/15 px-2 text-[11px] font-semibold text-[#BE185D] dark:text-[#F9A8D4] disabled:opacity-40"
                >
                  {voiceLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Mic className="h-3 w-3" />
                  )}
                  Render Audio
                </button>
              </div>
            )}
          </div>

          {voiceoverEnabled && (
            <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
              {voiceStatus ||
                (voiceEngine === "gemini-3.8-flash-tts"
                  ? "gemini-3.8-flash-tts narration mixes into preview & .webm export."
                  : "Uses gemini-3.8-flash-tts online with browser speechSynthesis fallback.")}
            </p>
          )}
        </div>

        <div className="flex justify-center rounded-xl bg-[#FAF7F2] dark:bg-[#161513] p-3">
          <canvas
            ref={canvasRef}
            width={canvasDims.width}
            height={canvasDims.height}
            className={`rounded-xl shadow-md border border-[#E8E2D8] dark:border-[#322E29] ${
              media.aspectRatio === "9:16"
                ? "max-h-[420px] w-auto"
                : "w-full h-auto"
            }`}
          />
        </div>

        {exportStatus && (
          <p className="rounded-lg bg-[#EC4899]/12 px-3 py-2 text-xs font-medium text-[#BE185D] dark:text-[#F9A8D4]">
            {exportStatus}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={exporting || voiceLoading}
              onClick={() => void handleTogglePlay()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E1E1E] dark:bg-[#F5F2EC] px-3.5 text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E] disabled:opacity-50"
            >
              {playing ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Play Preview
                </>
              )}
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => {
                setPlaying(false);
                stopPreviewAudio();
                setElapsedSec(0);
              }}
              aria-label="Restart preview"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E2D8] dark:border-[#322E29]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={exporting || voiceLoading}
            onClick={() => void handleExportWebm()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#EC4899] px-3.5 text-xs font-semibold text-white hover:bg-[#DB2777] disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exporting..." : "Export .webm"}
          </button>
        </div>
      </div>

      {/* Google Flow Bridge Toast Notification */}
      {flowToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-[#6366F1]/50 bg-[#FFFFFF] dark:bg-[#22201D] p-4 shadow-xl flex items-start gap-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#6366F1]/15 text-base">
            🎬
          </span>
          <p className="flex-1 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] leading-relaxed">
            {flowToast}
          </p>
          <button
            type="button"
            onClick={() => setFlowToast(null)}
            aria-label="Dismiss notification"
            className="text-[#8C857B] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
