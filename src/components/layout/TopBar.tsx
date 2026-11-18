import React, { useRef, useState } from "react";
import {
  Menu,
  Sun,
  Moon,
  Download,
  Upload,
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  RotateCcw,
  LayoutGrid,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { getTabConfig } from "../../config/tabs";
import { PWAInstallButton } from "./PWAInstallButton";
import type { GoogleSessionUser } from "../../lib/googleAuth";
import type {
  OfflineQueueItem,
  StudioNotification,
  TabId,
  ThemeMode,
} from "../../types/studio";

interface TopBarProps {
  activeTab: TabId;
  theme: ThemeMode;
  notifications: StudioNotification[];
  googleUser: GoogleSessionUser | null;
  hasGoogleToken: boolean;
  connectingGoogle: boolean;
  isOnline: boolean;
  offlineQueue: OfflineQueueItem[];
  syncingQueue: boolean;
  onSyncOfflineQueue: () => void;
  onClearOfflineQueue: () => void;
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
  onExportJson: () => void;
  onImportJson: (jsonText: string) => void;
  onResetAllData: () => void;
  onOpenCustomizeTabs: () => void;
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
  onNavigateTab: (tab: TabId) => void;
  onConnectGoogle: () => void;
  onOpenGoogleSettings: () => void;
  onOpenSecuritySettings: () => void;
  hasPersonalGeminiKey?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  theme,
  notifications,
  googleUser,
  hasGoogleToken,
  connectingGoogle,
  isOnline,
  offlineQueue,
  syncingQueue,
  onSyncOfflineQueue,
  onClearOfflineQueue,
  onToggleTheme,
  onOpenMobileNav,
  onExportJson,
  onImportJson,
  onResetAllData,
  onOpenCustomizeTabs,
  onMarkAllRead,
  onClearNotifications,
  onNavigateTab,
  onConnectGoogle,
  onOpenGoogleSettings,
  onOpenSecuritySettings,
  hasPersonalGeminiKey = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  const tabConfig = getTabConfig(activeTab);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImportJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 lg:h-16 items-center justify-between gap-2 sm:gap-3 border-b border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2]/90 dark:bg-[#161513]/90 backdrop-blur-md px-3 sm:px-4 lg:px-8">
      {/* Zone 1: Active workspace title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="flex lg:hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC]"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: tabConfig.accentHex }}
            aria-hidden="true"
          />
          <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-[#1E1E1E] dark:text-[#F5F2EC] truncate whitespace-nowrap">
            {tabConfig.label}
          </h1>
          <span className="hidden 2xl:inline text-xs text-[#6E685F] dark:text-[#9A9389] truncate whitespace-nowrap">
            · {tabConfig.subtitle}
          </span>
        </div>
      </div>

      {/* Zone 2: Online/Offline, PWA Install, Google, Customize Tabs, JSON Backup, Reset, Alerts, Theme */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Live Online / Offline Status Pill & Offline Sync Queue Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setQueueOpen((v) => !v)}
            title={
              isOnline
                ? `Online · ${offlineQueue.length} queued sync item(s)`
                : `Offline Mode · ${offlineQueue.length} item(s) queued for sync`
            }
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isOnline
                ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#065F46] dark:text-[#A7F3D0]"
                : "border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#92400E] dark:text-[#FCD34D]"
            }`}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-[#10B981]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-[#F59E0B]" />
            )}
            <span className="hidden sm:inline">
              {isOnline ? "Online" : "Offline"}
            </span>
            {offlineQueue.length > 0 && (
              <span className="rounded-md bg-[#1E1E1E] dark:bg-[#F5F2EC] px-1.5 py-0.5 text-[10px] font-bold text-[#FAF7F2] dark:text-[#1E1E1E] tabular-nums">
                {offlineQueue.length}
              </span>
            )}
          </button>

          {queueOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setQueueOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 mt-2 z-40 w-80 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-lg overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                      Offline Sync Queue ({offlineQueue.length})
                    </p>
                    <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
                      {isOnline
                        ? "Connected — ready to auto-sync"
                        : "Offline — actions auto-sync when reconnected"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {offlineQueue.length > 0 && (
                      <>
                        <button
                          type="button"
                          disabled={!isOnline || syncingQueue}
                          onClick={onSyncOfflineQueue}
                          title="Sync now"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#10B981] hover:bg-[#FAF7F2] dark:hover:bg-[#161513] disabled:opacity-40"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${syncingQueue ? "animate-spin" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={onClearOfflineQueue}
                          title="Clear queue"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#8C857B] hover:text-[#DC2626]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[#E8E2D8] dark:divide-[#322E29]">
                  {offlineQueue.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
                      All offline notes, tasks, and emails are synced.
                    </div>
                  ) : (
                    offlineQueue.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                            {item.label}
                          </span>
                          <span className="text-[10px] font-mono text-[#6E685F] shrink-0">
                            {item.kind === "AI_ENRICH_NOTE"
                              ? "Note"
                              : item.kind === "SEND_EMAIL"
                              ? "Send"
                              : "Draft"}
                          </span>
                        </div>
                        {item.lastError && (
                          <p className="text-[11px] text-[#DC2626]">{item.lastError}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <PWAInstallButton />

        {/* Customize Tabs Button */}
        <button
          type="button"
          onClick={onOpenCustomizeTabs}
          title="Customize visible tabs"
          aria-label="Customize Tabs"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors whitespace-nowrap shrink-0"
        >
          <LayoutGrid className="h-3.5 w-3.5 text-[#F26B5B]" />
          <span className="hidden xl:inline">Tabs</span>
        </button>

        {/* Connect Google Account + Client ID Settings */}
        <div className="flex items-center">
          {googleUser && hasGoogleToken ? (
            <button
              type="button"
              onClick={onOpenGoogleSettings}
              title={`Connected as ${googleUser.email}`}
              className="inline-flex h-9 items-center gap-2 rounded-l-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 sm:px-3 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors whitespace-nowrap shrink-0"
            >
              <span className="h-2 w-2 rounded-full bg-[#10B981] shrink-0" />
              <span className="hidden md:inline max-w-[130px] truncate">
                {googleUser.email}
              </span>
              <span className="md:hidden">Google</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={connectingGoogle}
              onClick={onConnectGoogle}
              title="Connect Google Account for Gmail & Calendar"
              className="inline-flex h-9 items-center gap-2 rounded-l-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 sm:px-3 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span className="hidden md:inline">
                {connectingGoogle ? "Connecting..." : "Connect Google"}
              </span>
              <span className="md:hidden">Google</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenGoogleSettings}
            aria-label="Google OAuth Client ID Settings"
            title="Edit Google OAuth Client ID"
            className="flex h-9 w-8 items-center justify-center rounded-r-lg border border-l-0 border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#6E685F] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925]"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Import JSON backup"
        />

        {/* Security & Privacy Settings Modal Button */}
        <button
          type="button"
          onClick={onOpenSecuritySettings}
          title={
            hasPersonalGeminiKey
              ? "Security & Privacy Settings (Personal Gemini Key active)"
              : "Security & Privacy Settings"
          }
          aria-label="Security & Privacy Settings"
          className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
          <span className="hidden xl:inline">Security</span>
          {hasPersonalGeminiKey && (
            <span
              className="h-2 w-2 rounded-full bg-[#10B981]"
              aria-hidden="true"
            />
          )}
        </button>

        {/* Export JSON with Privacy Warning Banner Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportConfirmOpen((v) => !v)}
            title="Export StudioOS workspace to JSON"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Export</span>
          </button>

          {exportConfirmOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setExportConfirmOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 mt-2 z-40 w-80 rounded-xl border border-[#F59E0B]/50 bg-[#FFFFFF] dark:bg-[#22201D] p-4 shadow-xl space-y-3">
                <div className="flex items-start gap-2.5 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-2.5">
                  <AlertTriangle className="h-4 w-4 text-[#D97706] dark:text-[#FBBF24] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#92400E] dark:text-[#FDE68A]">
                      Private Backup Warning
                    </p>
                    <p className="mt-1 text-[11px] text-[#78350F] dark:text-[#FCD34D]/90 leading-relaxed">
                      This exported JSON contains your personal notes, Memory Vault, habits, and financial ledger. Do not share it with others. (OAuth tokens, Gmail emails, and personal API keys are excluded.)
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setExportConfirmOpen(false)}
                    className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-medium text-[#5C5750] dark:text-[#A69F96]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportConfirmOpen(false);
                      onExportJson();
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1E1E1E] dark:bg-[#F5F2EC] px-3 text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download JSON
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import StudioOS JSON backup"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Import</span>
        </button>

        {/* Reset / Clear All Data with Safe Inline Confirmation */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setResetConfirmOpen((v) => !v)}
            title="Reset / Clear All Data"
            aria-label="Reset / Clear All Data"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-medium text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Reset</span>
          </button>

          {resetConfirmOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setResetConfirmOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 mt-2 z-40 w-72 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-4 shadow-xl space-y-3">
                <div>
                  <p className="text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    Reset / Clear All Data?
                  </p>
                  <p className="mt-1 text-xs text-[#6E685F] dark:text-[#9A9389] leading-relaxed">
                    This clears your local tasks, notes, habits, finances, and profile so you can start fresh from onboarding.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(false)}
                    className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-medium text-[#5C5750] dark:text-[#A69F96]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetConfirmOpen(false);
                      onResetAllData();
                    }}
                    className="h-8 rounded-lg bg-[#DC2626] px-3 text-xs font-semibold text-white hover:bg-[#B91C1C]"
                  >
                    Yes, Clear All
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Automated Notification Triggers Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const nextOpen = !notifOpen;
              setNotifOpen(nextOpen);
              if (nextOpen && unreadCount > 0) {
                onMarkAllRead();
              }
            }}
            aria-label="Automated notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums"
                style={{ backgroundColor: tabConfig.accentHex, color: tabConfig.textOnAccent }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setNotifOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 mt-2 z-40 w-80 sm:w-96 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-lg overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                      Automated Alerts
                    </p>
                    <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                      Triggered from habit, goal, and pipeline events
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      title="Mark all read"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[#6E685F] dark:text-[#A69F96] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onClearNotifications}
                      title="Clear alerts"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[#6E685F] dark:text-[#A69F96] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#E8E2D8] dark:divide-[#322E29]">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
                      No triggered alerts yet. Complete habits, hit targets, or move cards to trigger real-time alerts.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          onNavigateTab(n.tab);
                          setNotifOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-[#FAF7F2] dark:hover:bg-[#161513]/70 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-sm shrink-0"
                              style={{ backgroundColor: n.accentColor }}
                            />
                            {n.title}
                          </span>
                          <span className="text-[11px] font-mono text-[#8C857B] dark:text-[#787168] tabular-nums shrink-0">
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#5C5750] dark:text-[#A69F96] leading-relaxed">
                          {n.message}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 sm:px-3 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925] transition-colors whitespace-nowrap shrink-0"
        >
          {theme === "light" ? (
            <>
              <Moon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun className="h-3.5 w-3.5 text-[#FACC15]" />
              <span className="hidden xl:inline">Light</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
