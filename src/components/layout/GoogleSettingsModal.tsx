import React, { useState, useEffect } from "react";
import { X, CheckCircle2, RotateCcw, LogOut } from "lucide-react";
import {
  DEFAULT_OAUTH_CLIENT_ID,
  GOOGLE_WORKSPACE_SCOPES,
} from "../../lib/googleAuth";
import type { GoogleSessionUser } from "../../lib/googleAuth";

interface GoogleSettingsModalProps {
  open: boolean;
  clientIdOverride: string;
  googleUser: GoogleSessionUser | null;
  hasAccessToken: boolean;
  connecting: boolean;
  authError: string | null;
  onClose: () => void;
  onSaveClientId: (nextClientId: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const GoogleSettingsModal: React.FC<GoogleSettingsModalProps> = ({
  open,
  clientIdOverride,
  googleUser,
  hasAccessToken,
  connecting,
  authError,
  onClose,
  onSaveClientId,
  onConnect,
  onDisconnect,
}) => {
  const [draftId, setDraftId] = useState(clientIdOverride || DEFAULT_OAUTH_CLIENT_ID);

  useEffect(() => {
    if (open) {
      setDraftId(clientIdOverride || DEFAULT_OAUTH_CLIENT_ID);
    }
  }, [open, clientIdOverride]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftId.trim();
    onSaveClientId(cleaned === DEFAULT_OAUTH_CLIENT_ID ? "" : cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-settings-title"
        className="w-full max-w-lg rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-5 py-4">
          <div>
            <h2
              id="google-settings-title"
              className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]"
            >
              Google Account &amp; OAuth 2.0 Settings
            </h2>
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
              Gmail (read, compose, send) &amp; Calendar (read) integration
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E685F] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Connection Status Card */}
          <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {googleUser && hasAccessToken ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                      {googleUser.displayName}
                    </p>
                    <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] truncate">
                      {googleUser.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    {googleUser ? "Session needs refresh" : "Not connected"}
                  </p>
                  <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
                    Authorize Google Workspace access to scan Gmail &amp; Calendar.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {googleUser && hasAccessToken ? (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs font-semibold text-[#DC2626] hover:bg-[#DC2626]/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  disabled={connecting}
                  onClick={onConnect}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#F26B5B] px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {connecting ? "Connecting..." : "Connect Google Account"}
                </button>
              )}
            </div>
          </div>

          {authError && (
            <p className="rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F87171]">
              {authError}
            </p>
          )}

          {/* Editable Client ID Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="oauth-client-id-input"
                  className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]"
                >
                  Google OAuth 2.0 Client ID
                </label>
                {clientIdOverride && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftId(DEFAULT_OAUTH_CLIENT_ID);
                      onSaveClientId("");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#F26B5B] hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to StudioOS default
                  </button>
                )}
              </div>
              <input
                id="oauth-client-id-input"
                type="text"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="487646264655-....apps.googleusercontent.com"
                className="w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 font-mono text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F26B5B] focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-[#6E685F] dark:text-[#9A9389] leading-relaxed">
                Uses StudioOS&apos;s pre-configured Google OAuth client by default. Optionally paste a custom Web Client ID to override.
              </p>
            </div>

            <div className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] p-3">
              <p className="text-[11px] font-semibold text-[#5C5750] dark:text-[#A69F96] mb-1.5">
                Requested Workspace Permissions
              </p>
              <ul className="space-y-1 text-[11px] font-mono text-[#6E685F] dark:text-[#9A9389]">
                {GOOGLE_WORKSPACE_SCOPES.map((s) => (
                  <li key={s} className="truncate">
                    · {s.replace("https://www.googleapis.com/auth/", "")}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-4 text-xs font-medium text-[#5C5750] dark:text-[#A69F96]"
              >
                Close
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#1E1E1E] dark:bg-[#F5F2EC] px-4 text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E]"
              >
                Save Client ID
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
