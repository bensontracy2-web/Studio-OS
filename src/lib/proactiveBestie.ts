import type {
  BestieMessage,
  BestiePersonality,
  CalendarEventItem,
  MemoryItem,
  ScannedEmail,
} from "../types/studio";

/**
 * Clean conversational fallback greeting used ONLY when the device is genuinely offline
 * (`navigator.onLine === false`), without any rigid multi-step questionnaire.
 */
export function buildOfflineMorningGreetingMessage(params: {
  userName: string;
  personality: BestiePersonality;
  memories: MemoryItem[];
  scannedEmails: ScannedEmail[];
  calendarEvents: CalendarEventItem[];
}): BestieMessage {
  const name = params.userName.trim() || "friend";
  const hasGoogleContext =
    params.scannedEmails.length > 0 || params.calendarEvents.length > 0;

  let contextNote = "";
  if (hasGoogleContext) {
    const bits: string[] = [];
    if (params.scannedEmails.length > 0) {
      bits.push(`${params.scannedEmails.length} cached email(s)`);
    }
    if (params.calendarEvents.length > 0) {
      bits.push(`${params.calendarEvents.length} calendar event(s)`);
    }
    contextNote = ` I still have ${bits.join(" and ")} from your last sync.`;
  } else if (params.memories.length > 0) {
    contextNote = ` Your Memory Vault (${params.memories.length} saved notes) is ready locally.`;
  }

  const text =
    params.personality === "bestie"
      ? `Hey ${name}! Looks like you're offline right now, so full Gemini chat will resume as soon as you're back online.${contextNote} Meanwhile, you can still use quick offline commands like "Add task ...", "Log ₦20,000 income", or "Log 2 glasses of water".`
      : `Good day, ${name}. You're currently offline, so Gemini AI chat is paused until connectivity returns.${contextNote} Local commands like "Add task ...", "Log ₦20,000", and "Save note ..." still sync locally.`;

  return {
    id: `bmsg-greeting-offline-${Date.now()}`,
    role: "assistant",
    personality: params.personality,
    text,
    modelUsed: "offline-greeting",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Friendly prompt shown ONLY if neither server GEMINI_API_KEY nor a personal BYOK key is configured.
 */
export function buildMissingKeyGreetingMessage(params: {
  userName: string;
  personality: BestiePersonality;
}): BestieMessage {
  const name = params.userName.trim() || "friend";
  const text =
    params.personality === "bestie"
      ? `Hey ${name}! I'm so excited to chat with you, but I don't have a Gemini API key connected yet. Tap the shield icon (Security & Privacy Settings) in the top bar to paste a free Google AI Studio key and unlock full AI conversations!`
      : `Welcome, ${name}. To activate Gemini AI responses for Bestie & Executive VA, please add a free Google AI Studio API key in Security & Privacy Settings (shield icon in the top bar).`;

  return {
    id: `bmsg-greeting-nokey-${Date.now()}`,
    role: "assistant",
    personality: params.personality,
    text,
    modelUsed: "setup-required",
    timestamp: new Date().toISOString(),
  };
}
