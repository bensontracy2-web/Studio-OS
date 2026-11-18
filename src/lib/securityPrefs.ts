const BYOK_GEMINI_KEY_STORAGE = "studio_os_byok_gemini_key_v1";
const SESSION_ID_STORAGE = "studio_os_session_id_v1";

type Listener = (hasKey: boolean) => void;
const listeners = new Set<Listener>();

let memorySessionId: string | null = null;

function notifyListeners(): void {
  const active = hasUserGeminiKey();
  listeners.forEach((cb) => cb(active));
}

export function getOrCreateSessionId(): string {
  if (memorySessionId) return memorySessionId;

  const generateId = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_STORAGE);
    if (existing && existing.trim()) {
      memorySessionId = existing.trim();
      return memorySessionId;
    }
    const fresh = generateId();
    window.sessionStorage.setItem(SESSION_ID_STORAGE, fresh);
    memorySessionId = fresh;
    return fresh;
  } catch {
    memorySessionId = generateId();
    return memorySessionId;
  }
}

export function getUserGeminiKey(): string {
  try {
    const raw = window.localStorage.getItem(BYOK_GEMINI_KEY_STORAGE);
    return raw ? raw.trim() : "";
  } catch {
    return "";
  }
}

export function hasUserGeminiKey(): boolean {
  return getUserGeminiKey().length > 0;
}

export function setUserGeminiKey(nextKey: string): void {
  const trimmed = nextKey.trim();
  try {
    if (trimmed) {
      window.localStorage.setItem(BYOK_GEMINI_KEY_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(BYOK_GEMINI_KEY_STORAGE);
    }
  } catch {
    // Ignore storage errors cleanly
  }
  notifyListeners();
}

export function clearUserGeminiKey(): void {
  setUserGeminiKey("");
}

export function subscribeUserGeminiKey(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getAiRequestHeaders(
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-studio-session": getOrCreateSessionId(),
    ...(extraHeaders ?? {}),
  };

  const userKey = getUserGeminiKey();
  if (userKey) {
    headers["x-user-gemini-key"] = userKey;
  }

  return headers;
}
