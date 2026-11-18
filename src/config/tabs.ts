import type { TabId } from "../types/studio";

export interface TabThemeConfig {
  id: TabId;
  numberLabel: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  accentHex: string;
  secondaryHex?: string;
  textOnAccent: string;
  isImplemented: boolean;
}

export const TAB_CONFIGS: TabThemeConfig[] = [
  {
    id: "bestie",
    numberLabel: "01",
    label: "Bestie & VA",
    shortLabel: "Bestie",
    subtitle: "Hype buddy, executive VA, memory vault & inbox briefing",
    accentHex: "#F26B5B",
    textOnAccent: "#FFFFFF",
    isImplemented: true,
  },
  {
    id: "life",
    numberLabel: "02",
    label: "Life Dashboard",
    shortLabel: "Life",
    subtitle: "Daily habits, deliverables, dual-currency & growth",
    accentHex: "#10B981",
    secondaryHex: "#FACC15",
    textOnAccent: "#1E1E1E",
    isImplemented: true,
  },
  {
    id: "academy",
    numberLabel: "03",
    label: "Academy",
    shortLabel: "Academy",
    subtitle: "Context-aware mentor, micro-lessons & language lab",
    accentHex: "#6366F1",
    textOnAccent: "#FFFFFF",
    isImplemented: true,
  },
  {
    id: "brain",
    numberLabel: "04",
    label: "Second Brain",
    shortLabel: "Brain",
    subtitle: "AI quick-capture, extracted tasks & Q&A recall",
    accentHex: "#0EA5E9",
    textOnAccent: "#FFFFFF",
    isImplemented: true,
  },
  {
    id: "editdesk",
    numberLabel: "05",
    label: "Edit Desk",
    shortLabel: "Edit Desk",
    subtitle: "Production Kanban, cut sheets & social captions",
    accentHex: "#F59E0B",
    textOnAccent: "#1E1E1E",
    isImplemented: true,
  },
  {
    id: "media",
    numberLabel: "06",
    label: "Media Studio",
    shortLabel: "Media",
    subtitle: "Kinetic video maker, B-roll prompts & SVG graphics",
    accentHex: "#EC4899",
    textOnAccent: "#FFFFFF",
    isImplemented: true,
  },
  {
    id: "gameroom",
    numberLabel: "07",
    label: "Game Room",
    shortLabel: "Games",
    subtitle: "Offline Wordle, AI Quiz Arena & Cozy Tile-Match",
    accentHex: "#22C55E",
    secondaryHex: "#A855F7",
    textOnAccent: "#FFFFFF",
    isImplemented: true,
  },
];

export function getTabConfig(id: TabId): TabThemeConfig {
  return TAB_CONFIGS.find((t) => t.id === id) ?? TAB_CONFIGS[1];
}
