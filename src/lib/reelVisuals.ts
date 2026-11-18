import type { KineticScene } from "../types/studio";

export interface StockVisualAsset {
  id: string;
  label: string;
  url: string;
  keywords: string[];
  svgIndex: number;
}

export const FREE_LIFESTYLE_VISUALS: StockVisualAsset[] = [
  {
    id: "creator-filming-desk",
    label: "Creator filming at desk",
    url: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=1080&q=80",
    keywords: ["film", "camera", "shoot", "video", "reel", "tiktok", "youtube", "creator", "content", "record", "hook"],
    svgIndex: 0,
  },
  {
    id: "student-laptop-study",
    label: "Student working on laptop",
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1080&q=80",
    keywords: ["student", "study", "learn", "school", "notes", "course", "class", "academy", "exam", "read"],
    svgIndex: 1,
  },
  {
    id: "entrepreneur-portrait-desk",
    label: "Entrepreneur at desk",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1080&q=80",
    keywords: ["founder", "entrepreneur", "business", "client", "pitch", "ceo", "startup", "brand", "money", "income", "launch"],
    svgIndex: 2,
  },
  {
    id: "smartphone-closeup",
    label: "Smartphone closeup",
    url: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1080&q=80",
    keywords: ["phone", "mobile", "app", "scroll", "social", "dm", "post", "instagram", "notifications", "screen"],
    svgIndex: 3,
  },
  {
    id: "creator-laptop-coffee",
    label: "Creator planning on laptop",
    url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1080&q=80",
    keywords: ["plan", "morning", "routine", "habit", "batch", "organize", "system", "productivity", "workflow"],
    svgIndex: 1,
  },
  {
    id: "studio-mic-podcast",
    label: "Creator recording audio",
    url: "https://images.unsplash.com/photo-1590650153855-d9e808231d41?auto=format&fit=crop&w=1080&q=80",
    keywords: ["voice", "podcast", "speak", "mic", "audio", "story", "talk", "interview", "share"],
    svgIndex: 2,
  },
  {
    id: "tech-coding-desk",
    label: "Developer typing code",
    url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1080&q=80",
    keywords: ["code", "tech", "build", "software", "ai", "tool", "automation", "website", "coding", "dev"],
    svgIndex: 1,
  },
  {
    id: "team-brainstorm",
    label: "Creators collaborating",
    url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1080&q=80",
    keywords: ["team", "collab", "friend", "community", "meeting", "workshop", "together", "group", "grow"],
    svgIndex: 0,
  },
  {
    id: "founder-laptop-session",
    label: "Founder deep-work session",
    url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1080&q=80",
    keywords: ["focus", "deep", "work", "strategy", "career", "job", "goal", "session", "sprint"],
    svgIndex: 1,
  },
  {
    id: "creative-desk-overview",
    label: "Creative studio workspace",
    url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1080&q=80",
    keywords: ["studio", "desk", "edit", "design", "workspace", "setup", "gear", "digital", "freelance"],
    svgIndex: 2,
  },
  {
    id: "speaker-presentation",
    label: "Confident creator speaking",
    url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1080&q=80",
    keywords: ["confidence", "mindset", "tip", "secret", "advice", "mentor", "coach", "win", "success"],
    svgIndex: 2,
  },
  {
    id: "home-office-laptop",
    label: "Remote creator setup",
    url: "https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=1080&q=80",
    keywords: ["home", "remote", "freelancer", "side", "hustle", "daily", "life", "balance"],
    svgIndex: 1,
  },
  {
    id: "cinema-camera-gear",
    label: "Filmmaking lens & setup",
    url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1080&q=80",
    keywords: ["b-roll", "broll", "cinema", "visual", "cut", "edit", "frame", "scene", "lighting"],
    svgIndex: 0,
  },
  {
    id: "notebook-writing-person",
    label: "Creator scripting & writing",
    url: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&w=1080&q=80",
    keywords: ["write", "script", "journal", "plan", "draft", "idea", "brain", "caption"],
    svgIndex: 1,
  },
  {
    id: "creative-meeting-table",
    label: "Startup pitch & discussion",
    url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1080&q=80",
    keywords: ["audience", "growth", "agency", "client", "deal", "sponsor", "results"],
    svgIndex: 0,
  },
  {
    id: "startup-office-team",
    label: "Modern makers in motion",
    url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1080&q=80",
    keywords: ["ship", "launch", "execute", "momentum", "hype", "cta", "follow", "next"],
    svgIndex: 2,
  },
];

export function pickVisualForScene(
  scene: KineticScene,
  index: number,
  usedIds: Set<string>
): StockVisualAsset {
  const haystack = `${scene.text} ${scene.bRollCue} ${scene.emphasisWord} ${scene.veoPrompt || ""}`.toLowerCase();

  let bestAsset = FREE_LIFESTYLE_VISUALS[index % FREE_LIFESTYLE_VISUALS.length];
  let bestScore = -1;

  for (const asset of FREE_LIFESTYLE_VISUALS) {
    let score = 0;
    for (const kw of asset.keywords) {
      if (haystack.includes(kw)) {
        score += 3;
      }
    }
    if (!usedIds.has(asset.id)) {
      score += 2; // Prefer distinct visuals per scene
    }
    if (score > bestScore) {
      bestScore = score;
      bestAsset = asset;
    }
  }

  usedIds.add(bestAsset.id);
  return bestAsset;
}

export function buildOfflineHumanSvgDataUri(
  seed: number,
  bgHex: string,
  bgAltHex: string,
  accentHex: string
): string {
  const variant = Math.abs(seed) % 4;
  let silhouetteMarkup = "";

  if (variant === 0) {
    // Creator filming with tripod & ring light
    silhouetteMarkup = `
      <circle cx="720" cy="340" r="145" fill="none" stroke="${accentHex}" stroke-width="16" opacity="0.48"/>
      <circle cx="720" cy="340" r="112" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.32"/>
      <line x1="720" y1="485" x2="720" y2="920" stroke="#FFFFFF" stroke-width="10" opacity="0.24"/>
      <line x1="720" y1="680" x2="640" y2="940" stroke="#FFFFFF" stroke-width="8" opacity="0.22"/>
      <line x1="720" y1="680" x2="800" y2="940" stroke="#FFFFFF" stroke-width="8" opacity="0.22"/>
      <ellipse cx="400" cy="400" rx="76" ry="86" fill="#141218" opacity="0.9"/>
      <path d="M210 960 C215 650, 275 510, 400 510 C525 510, 585 650, 595 960 Z" fill="#141218" opacity="0.92"/>
      <path d="M510 610 L620 500 L645 525 L540 650 Z" fill="#141218" opacity="0.88"/>
      <rect x="688" y="310" width="64" height="106" rx="14" fill="${accentHex}" opacity="0.75"/>
    `;
  } else if (variant === 1) {
    // Student / founder focused at laptop desk
    silhouetteMarkup = `
      <circle cx="780" cy="240" r="170" fill="${accentHex}" opacity="0.18"/>
      <ellipse cx="470" cy="370" rx="74" ry="84" fill="#141218" opacity="0.9"/>
      <path d="M270 860 C285 600, 355 480, 470 480 C590 480, 650 610, 670 860 Z" fill="#141218" opacity="0.92"/>
      <polygon points="560,720 820,560 860,740 590,780" fill="#FFFFFF" opacity="0.22"/>
      <rect x="140" y="775" width="800" height="22" rx="11" fill="#FFFFFF" opacity="0.18"/>
      <rect x="520" y="640" width="240" height="135" rx="14" fill="#1E1B24" stroke="${accentHex}" stroke-width="5"/>
    `;
  } else if (variant === 2) {
    // Entrepreneur / speaker with studio microphone
    silhouetteMarkup = `
      <circle cx="540" cy="360" r="240" fill="${accentHex}" opacity="0.15"/>
      <ellipse cx="520" cy="340" rx="78" ry="88" fill="#141218" opacity="0.92"/>
      <path d="M310 960 C330 620, 400 465, 520 465 C640 465, 710 620, 730 960 Z" fill="#141218" opacity="0.94"/>
      <rect x="650" y="450" width="38" height="72" rx="19" fill="${accentHex}" opacity="0.9"/>
      <path d="M669 522 L669 650 L780 790" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.38"/>
    `;
  } else {
    // Hand holding glowing smartphone reel closeup
    silhouetteMarkup = `
      <circle cx="540" cy="480" r="260" fill="${accentHex}" opacity="0.18"/>
      <path d="M340 960 L410 640 L690 640 L750 960 Z" fill="#141218" opacity="0.88"/>
      <rect x="415" y="210" width="250" height="470" rx="34" fill="#141218" stroke="${accentHex}" stroke-width="8"/>
      <rect x="440" y="255" width="200" height="360" rx="18" fill="${accentHex}" opacity="0.32"/>
      <circle cx="540" cy="390" r="46" fill="#FFFFFF" opacity="0.4"/>
      <polygon points="528,370 528,410 564,390" fill="#FFFFFF" opacity="0.85"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgHex}" />
        <stop offset="100%" stop-color="${bgAltHex}" />
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.35" r="0.65">
        <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.38" />
        <stop offset="100%" stop-color="${bgHex}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bgGrad)" />
    <rect width="1080" height="1080" fill="url(#glow)" />
    ${silhouetteMarkup}
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function resizeImageFileToDataUrl(
  file: File,
  maxDim = 1080
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Canvas context unavailable."));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read selected image file."));
    };
    img.src = objectUrl;
  });
}

export function drawCoverMediaWithKenBurns(params: {
  ctx: CanvasRenderingContext2D;
  source: HTMLImageElement | HTMLVideoElement;
  sourceW: number;
  sourceH: number;
  canvasW: number;
  canvasH: number;
  progress: number;
  motionIndex: number;
}): void {
  const { ctx, source, sourceW, sourceH, canvasW, canvasH, progress, motionIndex } = params;
  if (sourceW <= 0 || sourceH <= 0) return;

  // Smooth Ken Burns zoom & pan
  const mode = motionIndex % 4;
  const eased = 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, progress)) * Math.PI);
  let zoom = 1.03 + eased * 0.11;
  let panX = 0;
  let panY = 0;

  if (mode === 0) {
    zoom = 1.02 + eased * 0.12;
    panX = (eased - 0.5) * 0.05;
    panY = (eased - 0.5) * 0.03;
  } else if (mode === 1) {
    zoom = 1.14 - eased * 0.11;
    panX = (0.5 - eased) * 0.05;
    panY = (eased - 0.5) * 0.03;
  } else if (mode === 2) {
    zoom = 1.04 + eased * 0.1;
    panY = (0.5 - eased) * 0.06;
  } else {
    zoom = 1.03 + eased * 0.11;
    panX = (eased - 0.5) * 0.06;
  }

  const baseScale = Math.max(canvasW / sourceW, canvasH / sourceH);
  const drawW = sourceW * baseScale * zoom;
  const drawH = sourceH * baseScale * zoom;

  const extraW = drawW - canvasW;
  const extraH = drawH - canvasH;
  const offsetX = -extraW * (0.5 + panX);
  const offsetY = -extraH * (0.5 + panY);

  ctx.save();
  ctx.drawImage(source, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

export function drawCoverVideoFullBleed(params: {
  ctx: CanvasRenderingContext2D;
  source: HTMLVideoElement;
  sourceW: number;
  sourceH: number;
  canvasW: number;
  canvasH: number;
}): void {
  const { ctx, source, sourceW, sourceH, canvasW, canvasH } = params;
  if (sourceW <= 0 || sourceH <= 0) return;

  const scale = Math.max(canvasW / sourceW, canvasH / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const offsetX = (canvasW - drawW) * 0.5;
  const offsetY = (canvasH - drawH) * 0.5;

  ctx.save();
  ctx.drawImage(source, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

export function buildGoogleFlowPrompt(params: {
  text: string;
  bRollCue?: string;
  aspectRatio: "9:16" | "16:9";
}): string {
  const line = params.text.trim() || "Sharing a quick daily insight";
  const cue = params.bRollCue?.trim() || "authentic creator in a bright minimalist studio";
  const framing =
    params.aspectRatio === "9:16"
      ? "Vertical 9:16 portrait framing, waist-up eye-level medium close-up"
      : "Widescreen 16:9 cinematic framing, eye-level medium shot";

  return `${framing} of a realistic human presenter (${cue}), natural candid movement and subtle handheld camera push-in, 35mm shallow depth of field. Warm golden window key light with soft studio fill, natural skin tones, cozy modern backdrop. Audio cue: presenter speaks naturally with warm energy: "${line}", subtle room tone.`;
}

