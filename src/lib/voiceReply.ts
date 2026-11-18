import type { BestiePersonality, TargetLanguage } from "../types/studio";
import { getAiRequestHeaders } from "./securityPrefs";

let currentAudio: HTMLAudioElement | null = null;

const LANG_BCP47: Record<TargetLanguage, string> = {
  Spanish: "es-ES",
  French: "fr-FR",
  Yoruba: "yo-NG",
  Japanese: "ja-JP",
  Portuguese: "pt-BR",
  German: "de-DE",
};

export function stopActiveVoice(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakWithBrowserFallback(
  text: string,
  personality: BestiePersonality,
  onEnd: () => void,
  targetLanguage?: TargetLanguage
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (targetLanguage) {
    utterance.lang = LANG_BCP47[targetLanguage];
    utterance.rate = 0.95;
  } else {
    utterance.rate = personality === "bestie" ? 1.05 : 1.0;
    utterance.pitch = personality === "bestie" ? 1.08 : 0.98;
  }
  utterance.onend = () => onEnd();
  utterance.onerror = () => onEnd();
  window.speechSynthesis.speak(utterance);
}

export async function speakBestieReply(
  text: string,
  personality: BestiePersonality,
  onEnd: () => void,
  targetLanguage?: TargetLanguage
): Promise<{ engine: "gemini-3.8-flash-tts" | "browser-speech" }> {
  stopActiveVoice();

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    speakWithBrowserFallback(text, personality, onEnd, targetLanguage);
    return { engine: "browser-speech" };
  }

  try {
    const resp = await fetch("/api/bestie/tts", {
      method: "POST",
      headers: getAiRequestHeaders(),
      body: JSON.stringify({ text, personality, language: targetLanguage }),
    });

    if (!resp.ok) {
      throw new Error("Gemini TTS unavailable");
    }

    const data = (await resp.json()) as {
      audioBase64?: string;
      mimeType?: string;
    };

    if (!data.audioBase64) {
      throw new Error("Empty audio payload");
    }

    const audio = new Audio(
      `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`
    );
    currentAudio = audio;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        onEnd();
        resolve();
      };
      audio.onerror = () => {
        if (currentAudio === audio) currentAudio = null;
        reject(new Error("Audio playback failed"));
      };
      audio.play().catch(reject);
    });

    return { engine: "gemini-3.8-flash-tts" };
  } catch {
    speakWithBrowserFallback(text, personality, onEnd, targetLanguage);
    return { engine: "browser-speech" };
  }
}
