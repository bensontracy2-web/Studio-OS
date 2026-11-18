import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Download,
  Copy,
  Check,
  Lock,
  ExternalLink,
} from "lucide-react";
import {
  clearUserGeminiKey,
  getAiRequestHeaders,
  getUserGeminiKey,
  setUserGeminiKey,
} from "../../lib/securityPrefs";
import type { GoogleSessionUser } from "../../lib/googleAuth";

interface SecurityStatusResponse {
  serverKeyConfigured: boolean;
  usingPersonalKey: boolean;
  sessionRemaining: number;
  sessionLimit: number;
  windowMinutes: number;
  resetInSec: number;
}

interface SecurityPrivacyModalProps {
  open: boolean;
  isOnline: boolean;
  googleUser: GoogleSessionUser | null;
  hasGoogleToken: boolean;
  cachedEmailCount: number;
  cachedEventCount: number;
  onClose: () => void;
  onDisconnectAndWipeEmails: () => Promise<void> | void;
  onOpenGoogleSettings: () => void;
  onExportJson: () => void;
}

export const SecurityPrivacyModal: React.FC<SecurityPrivacyModalProps> = ({
  open,
  isOnline,
  googleUser,
  hasGoogleToken,
  cachedEmailCount,
  cachedEventCount,
  onClose,
  onDisconnectAndWipeEmails,
  onOpenGoogleSettings,
  onExportJson,
}) => {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [wipeNotice, setWipeNotice] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [statusInfo, setStatusInfo] = useState<SecurityStatusResponse | null>(null);
  const [checklist, setChecklist] = useState({
    geminiRestricted: false,
    originsRestricted: false,
    testingMode: false,
  });

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app-domain";

  const refreshStatus = async () => {
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    try {
      const resp = await fetch("/api/security/status", {
        headers: getAiRequestHeaders(),
      });
      if (resp.ok) {
        const data = (await resp.json()) as SecurityStatusResponse;
        setStatusInfo(data);
      }
    } catch {
      // Ignore offline/network errors cleanly
    }
  };

  useEffect(() => {
    if (open) {
      setKeyInput(getUserGeminiKey());
      setShowKey(false);
      setSavedNotice(null);
      setWipeNotice(null);
      void refreshStatus();
    }
  }, [open, isOnline]);

  if (!open) return null;

  const hasPersonalKeySaved = getUserGeminiKey().length > 0;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    setUserGeminiKey(trimmed);
    setKeyInput(trimmed);
    setSavedNotice(
      trimmed
        ? "Personal Gemini API key saved locally in this browser. All AI routes now use your key."
        : "Personal key cleared. Requests now use the rate-limited shared server key."
    );
    void refreshStatus();
  };

  const handleRemoveKey = () => {
    clearUserGeminiKey();
    setKeyInput("");
    setSavedNotice("Personal Gemini API key removed from this browser.");
    void refreshStatus();
  };

  const handleWipeClick = async () => {
    setWiping(true);
    try {
      await onDisconnectAndWipeEmails();
      setWipeNotice(
        "Google session disconnected, in-memory OAuth token cleared, and all cached Gmail/Calendar items wiped."
      );
    } finally {
      setWiping(false);
    }
  };

  const handleCopyOrigin = async () => {
    try {
      await navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 1800);
    } catch {
      // Clipboard blocked cleanly ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="security-privacy-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10B981]/15 text-[#059669] dark:text-[#34D399]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="security-privacy-title"
                className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC] truncate"
              >
                Security &amp; Privacy Settings
              </h2>
              <p className="text-xs text-[#6E685F] dark:text-[#9A9389] truncate">
                Bring-Your-Own-Key (BYOK), OAuth memory guardrails &amp; sharing checklist
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Security & Privacy Settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E685F] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* 1. BYOK Personal Gemini API Key */}
          <section className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#6366F1] shrink-0" />
                <h3 className="text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Personal Gemini API Key (Optional)
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  hasPersonalKeySaved
                    ? "bg-[#10B981]/15 text-[#065F46] dark:text-[#A7F3D0]"
                    : "bg-[#6366F1]/12 text-[#4338CA] dark:text-[#C7D2FE]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasPersonalKeySaved ? "bg-[#10B981]" : "bg-[#6366F1]"
                  }`}
                />
                {hasPersonalKeySaved
                  ? "Using Personal Key"
                  : statusInfo
                  ? `Shared Server Key (${statusInfo.sessionRemaining}/${statusInfo.sessionLimit} left / ${statusInfo.windowMinutes}m)`
                  : "Shared Server Key (Rate-Limited)"}
              </span>
            </div>

            <p className="text-xs text-[#5C5750] dark:text-[#A69F96] leading-relaxed">
              The owner&apos;s default server key is strictly kept on the backend and rate-limited per session. Friends can paste their own free Google AI Studio key below—it stays only in your browser&apos;s{" "}
              <span className="font-mono text-[11px]">localStorage</span> and is sent in{" "}
              <span className="font-mono text-[11px]">x-user-gemini-key</span> so your personal quota is used instead.
            </p>

            <form onSubmit={handleSaveKey} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    id="byok-gemini-key-input"
                    type={showKey ? "text" : "password"}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste optional Google AI Studio key (AIza...)"
                    aria-label="Personal Gemini API Key (Optional)"
                    className="w-full h-10 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] pl-3 pr-10 font-mono text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#6366F1] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E685F] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-[#6366F1] px-4 text-xs font-semibold text-white hover:opacity-90 whitespace-nowrap"
                  >
                    Save Key
                  </button>
                  {hasPersonalKeySaved && (
                    <button
                      type="button"
                      onClick={handleRemoveKey}
                      title="Remove personal key"
                      className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs font-semibold text-[#DC2626] hover:bg-[#DC2626]/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </form>

            {savedNotice && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#065F46] dark:text-[#A7F3D0]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {savedNotice}
              </p>
            )}

            <div className="flex items-center justify-between text-[11px] text-[#6E685F] dark:text-[#9A9389]">
              <span>Never included in Export JSON backups.</span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#6366F1] hover:underline"
              >
                Get free AI Studio key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </section>

          {/* 2. Google OAuth Token & Email Privacy Guardrails */}
          <section className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#F26B5B] shrink-0" />
                <h3 className="text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Google OAuth &amp; Inbox Privacy Guardrails
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#6E685F] dark:text-[#9A9389]">
                {cachedEmailCount} emails · {cachedEventCount} events in RAM only
              </span>
            </div>

            <div className="text-xs text-[#5C5750] dark:text-[#A69F96] space-y-1.5 leading-relaxed">
              <p>
                · Google OAuth access tokens stay strictly in React memory (
                <span className="font-mono text-[11px]">useState / useRef</span>)—never written to{" "}
                <span className="font-mono text-[11px]">localStorage</span> or exported JSON.
              </p>
              <p>
                · Scanned Gmail summaries &amp; calendar items live in memory only for your active tab session and are wiped automatically on reload or disconnect.
              </p>
              <p className="font-medium text-[#1E1E1E] dark:text-[#F5F2EC]">
                Active session:{" "}
                {googleUser && hasGoogleToken
                  ? `Connected as ${googleUser.email}`
                  : googleUser
                  ? `Signed in (${googleUser.email}) — token cleared`
                  : "Not connected"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={wiping}
                onClick={() => void handleWipeClick()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#DC2626] px-3.5 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" />
                {wiping ? "Wiping..." : "Disconnect Google & Wipe Cached Emails"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGoogleSettings();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925]"
              >
                OAuth Client ID Settings
              </button>
            </div>

            {wipeNotice && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#065F46] dark:text-[#A7F3D0]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {wipeNotice}
              </p>
            )}
          </section>

          {/* 3. Export JSON Privacy Warning Banner */}
          <section className="rounded-xl border border-[#F59E0B]/45 bg-[#F59E0B]/10 p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-[#D97706] dark:text-[#FBBF24] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[#92400E] dark:text-[#FDE68A]">
                  Export Backup Privacy Warning
                </h3>
                <p className="text-xs text-[#78350F] dark:text-[#FCD34D]/90 leading-relaxed">
                  Your exported JSON backup contains your personal notes, Companion Memory Vault, habits, and financial ledger (NGN/USD). Keep this file private and do not share it with others. (OAuth tokens, Gmail emails, and personal Gemini API keys are automatically excluded.)
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1E1E1E] dark:bg-[#F5F2EC] px-3 text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E] hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                Download Private Backup JSON
              </button>
            </div>
          </section>

          {/* 4. Built-In Deployment Security Checklist Card */}
          <section className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#1B1916] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Deployment Security Checklist (For App Owners)
                </h3>
                <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
                  Complete these 3 Google Cloud Console guardrails before sharing your URL with friends
                </p>
              </div>
              <span className="rounded-md bg-[#10B981]/12 px-2 py-0.5 text-[11px] font-bold text-[#059669] dark:text-[#34D399] tabular-nums">
                {Object.values(checklist).filter(Boolean).length}/3 checked
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] p-3 cursor-pointer hover:bg-[#FAF7F2] dark:hover:bg-[#22201D]">
                <input
                  type="checkbox"
                  checked={checklist.geminiRestricted}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, geminiRestricted: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div>
                  <p className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    (a) Restrict your Gemini API key to the Generative Language API
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6E685F] dark:text-[#9A9389] leading-relaxed">
                    In Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials, restrict{" "}
                    <span className="font-mono">GEMINI_API_KEY</span> solely to{" "}
                    <strong>Generative Language API</strong> and configure daily free-tier quota caps.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] p-3 cursor-pointer hover:bg-[#FAF7F2] dark:hover:bg-[#22201D]">
                <input
                  type="checkbox"
                  checked={checklist.originsRestricted}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, originsRestricted: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    (b) Restrict OAuth Authorized JavaScript origins to your exact HTTPS domain
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6E685F] dark:text-[#9A9389] leading-relaxed">
                    Under your OAuth 2.0 Web Client ID, allow only your exact deployed HTTPS origin and remove unused localhost/wildcard origins:
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md bg-[#FAF7F2] dark:bg-[#161513] border border-[#E8E2D8] dark:border-[#322E29] px-2 py-1 text-[11px] text-[#1E1E1E] dark:text-[#F5F2EC]">
                      {currentOrigin}
                    </code>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleCopyOrigin();
                      }}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E8E2D8] dark:border-[#322E29] px-2 text-[11px] font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925]"
                    >
                      {copiedOrigin ? (
                        <>
                          <Check className="h-3 w-3 text-[#10B981]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] p-3 cursor-pointer hover:bg-[#FAF7F2] dark:hover:bg-[#22201D]">
                <input
                  type="checkbox"
                  checked={checklist.testingMode}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, testingMode: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div>
                  <p className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    (c) Keep OAuth Consent Screen in Testing mode (with explicit Test Users)
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6E685F] dark:text-[#9A9389] leading-relaxed">
                    In Google Cloud Console &rarr; Google Auth Platform &rarr; Audience, keep publishing status in{" "}
                    <strong>Testing</strong> and add only trusted friends&apos; emails under{" "}
                    <strong>Test Users</strong> so outside strangers cannot use your OAuth client.
                  </p>
                </div>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
