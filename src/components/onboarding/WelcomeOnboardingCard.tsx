import React, { useState } from "react";
import {
  Sparkles,
  Check,
  ArrowRight,
  Mail,
  Sun,
  Moon,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { TAB_CONFIGS } from "../../config/tabs";
import {
  ALL_TABS,
  FOCUS_ROLES,
  getCombinedTabsForRoles,
} from "../../data/initialState";
import type { GoogleSessionUser } from "../../lib/googleAuth";
import type { TabId, ThemeMode } from "../../types/studio";

interface WelcomeOnboardingCardProps {
  theme: ThemeMode;
  googleUser: GoogleSessionUser | null;
  hasGoogleToken: boolean;
  connectingGoogle: boolean;
  isOnline: boolean;
  onToggleTheme: () => void;
  onConnectGoogle: () => Promise<boolean>;
  onCompleteOnboarding: (payload: {
    name: string;
    roles: string[];
    visibleTabs: TabId[];
  }) => void;
}

export const WelcomeOnboardingCard: React.FC<WelcomeOnboardingCardProps> = ({
  theme,
  googleUser,
  hasGoogleToken,
  connectingGoogle,
  isOnline,
  onToggleTheme,
  onConnectGoogle,
  onCompleteOnboarding,
}) => {
  const [name, setName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [visibleTabs, setVisibleTabs] = useState<TabId[]>([...ALL_TABS]);
  const [formError, setFormError] = useState<string | null>(null);

  const syncRecommendedTabs = (nextRoles: string[]) => {
    if (nextRoles.length === 0) {
      setVisibleTabs([...ALL_TABS]);
    } else {
      setVisibleTabs(getCombinedTabsForRoles(nextRoles));
    }
  };

  const handleToggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role];
      syncRecommendedTabs(next);
      return next;
    });
    setFormError(null);
  };

  const handleAddCustomRole = () => {
    const trimmed = customRoleInput.trim();
    if (!trimmed) {
      setCustomInputOpen(false);
      return;
    }

    // Check if matches built-in or existing custom role (case-insensitive)
    const builtInMatch = FOCUS_ROLES.find(
      (f) => f.role.toLowerCase() === trimmed.toLowerCase()
    )?.role;
    const existingCustomMatch = customRoles.find(
      (r) => r.toLowerCase() === trimmed.toLowerCase()
    );
    const canonicalRole = builtInMatch || existingCustomMatch || trimmed;

    if (!builtInMatch && !existingCustomMatch) {
      setCustomRoles((prev) => [...prev, canonicalRole]);
    }

    setSelectedRoles((prev) => {
      const next = prev.includes(canonicalRole) ? prev : [...prev, canonicalRole];
      syncRecommendedTabs(next);
      return next;
    });

    setCustomRoleInput("");
    setCustomInputOpen(false);
    setFormError(null);
  };

  const handleToggleTab = (tabId: TabId) => {
    setVisibleTabs((prev) => {
      if (prev.includes(tabId)) {
        if (prev.length <= 1) return prev; // Keep at least 1 tab visible
        return prev.filter((id) => id !== tabId);
      }
      return ALL_TABS.filter((id) => id === tabId || prev.includes(id));
    });
  };

  const validateAndComplete = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError("Please tell me what I should call you first.");
      return false;
    }
    const chosenRoles =
      selectedRoles.length > 0 ? selectedRoles : ["Everyday Life & Self-Care"];
    const chosenTabs: TabId[] =
      visibleTabs.length > 0 ? visibleTabs : ["bestie", "life"];
    onCompleteOnboarding({
      name: cleanName,
      roles: chosenRoles,
      visibleTabs: chosenTabs,
    });
    return true;
  };

  const handleConnectAndFinish = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError("Enter your name above first so I know who to greet!");
      return;
    }
    const ok = await onConnectGoogle();
    if (ok) {
      validateAndComplete();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] flex flex-col">
      {/* Top minimal bar with Light / Dark mode toggle */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E1E1E] dark:bg-[#FACC15] text-[#FAF7F2] dark:text-[#1E1E1E] font-display font-bold text-base">
            S
          </div>
          <span className="font-display text-base font-bold tracking-tight">
            StudioOS
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs font-medium hover:bg-[#FAF7F2] dark:hover:bg-[#2C2925]"
        >
          {theme === "light" ? (
            <>
              <Moon className="h-3.5 w-3.5" />
              Dark
            </>
          ) : (
            <>
              <Sun className="h-3.5 w-3.5 text-[#FACC15]" />
              Light
            </>
          )}
        </button>
      </div>

      {/* Centered Multi-Color Onboarding Card */}
      <main className="flex-1 flex items-center justify-center px-4 pb-10 pt-2">
        <div className="w-full max-w-3xl rounded-3xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-xl overflow-hidden">
          {/* Multi-Color Signature Accent Strip */}
          <div className="grid grid-cols-7 h-2">
            {TAB_CONFIGS.map((tab) => (
              <div key={tab.id} style={{ backgroundColor: tab.accentHex }} />
            ))}
          </div>

          <div className="p-6 sm:p-8 space-y-7">
            {/* Bestie Warm Intro */}
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F26B5B] text-white shadow-sm">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#F26B5B]">
                  Welcome to Your Personal OS
                </span>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Hey! Let&apos;s set up your space in 30 seconds.
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96] leading-relaxed">
                  No pre-filled fake numbers or clutter. Pick every hat you wear, and I&apos;ll tailor your workspaces, Bestie, and Academy around you.
                </p>
              </div>
            </div>

            {/* 1. Name Input */}
            <div className="space-y-2">
              <label
                htmlFor="onboarding-name"
                className="block font-display text-sm sm:text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]"
              >
                1. What should I call you?
              </label>
              <input
                id="onboarding-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={32}
                placeholder="Type your first name or nickname..."
                autoFocus
                className="h-12 w-full rounded-2xl border-2 border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-4 text-sm sm:text-base font-medium text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#F26B5B] focus:outline-none transition-colors"
              />
            </div>

            {/* 2. Multi-Select Current Focus Pills + Custom Role */}
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm sm:text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    2. What best describes your current focus?
                  </h2>
                  <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                    Select as many roles as apply to you — I&apos;ll combine your recommended workspaces and AI coaching context automatically.
                  </p>
                </div>
                {selectedRoles.length > 0 && (
                  <span className="text-xs font-mono font-semibold text-[#10B981] tabular-nums shrink-0">
                    {selectedRoles.length} selected
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {FOCUS_ROLES.map(({ role, tagline }) => {
                  const selected = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleToggleRole(role)}
                      title={tagline}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                        selected
                          ? "border-[#10B981] bg-[#10B981]/14 text-[#065F46] dark:text-[#A7F3D0] shadow-xs"
                          : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#3A3631] dark:text-[#DCD6CD] hover:border-[#FACC15]"
                      }`}
                    >
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                      )}
                      <span>{role}</span>
                    </button>
                  );
                })}

                {customRoles.map((role) => {
                  const selected = selectedRoles.includes(role);
                  return (
                    <button
                      key={`custom-${role}`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleToggleRole(role)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                        selected
                          ? "border-[#6366F1] bg-[#6366F1]/14 text-[#4338CA] dark:text-[#C7D2FE] shadow-xs"
                          : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#3A3631] dark:text-[#DCD6CD] hover:border-[#6366F1]"
                      }`}
                    >
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-[#6366F1] shrink-0" />
                      )}
                      <span>{role}</span>
                    </button>
                  );
                })}

                {!customInputOpen ? (
                  <button
                    type="button"
                    onClick={() => setCustomInputOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-[#C7BFB3] dark:border-[#4A453E] bg-transparent px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#5C5750] dark:text-[#A69F96] hover:border-[#F26B5B] hover:text-[#F26B5B] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add custom role
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-2xl border border-[#F26B5B] bg-[#FAF7F2] dark:bg-[#161513] pl-3 pr-1.5 py-1">
                    <input
                      type="text"
                      value={customRoleInput}
                      onChange={(e) => setCustomRoleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomRole();
                        } else if (e.key === "Escape") {
                          setCustomInputOpen(false);
                          setCustomRoleInput("");
                        }
                      }}
                      maxLength={40}
                      placeholder="e.g. Podcaster, Nurse, Artist..."
                      autoFocus
                      aria-label="Custom role name"
                      className="w-44 bg-transparent text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomRole}
                      className="rounded-xl bg-[#F26B5B] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomInputOpen(false);
                        setCustomRoleInput("");
                      }}
                      aria-label="Cancel custom role"
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6E685F] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Workspace Checkboxes */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm sm:text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                    3. Pick the workspaces you want visible
                  </h2>
                  <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                    Combined from your selected roles — skip tools like Edit Desk or Media Studio if you don&apos;t need them, or toggle anytime later.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-[#6E685F] dark:text-[#9A9389] tabular-nums shrink-0">
                  {visibleTabs.length}/{TAB_CONFIGS.length} active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TAB_CONFIGS.map((tab) => {
                  const checked = visibleTabs.includes(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleToggleTab(tab.id)}
                      className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                        checked
                          ? "bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]"
                          : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] opacity-60 hover:opacity-90"
                      }`}
                      style={{
                        borderColor: checked ? tab.accentHex : undefined,
                      }}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                        style={{
                          backgroundColor: checked ? tab.accentHex : "transparent",
                          borderColor: checked ? tab.accentHex : "#C7BFB3",
                          color: checked ? tab.textOnAccent : "transparent",
                        }}
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: tab.accentHex }}
                          />
                          <span className="text-xs sm:text-sm font-bold truncate">
                            {tab.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#6E685F] dark:text-[#9A9389] line-clamp-1">
                          {tab.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {formError && (
              <p className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-2.5 text-xs font-medium text-[#DC2626] dark:text-[#F87171]">
                {formError}
              </p>
            )}

            {/* 4. Optional Google Connect + Prominent Skip Action */}
            <div className="border-t border-[#E8E2D8] dark:border-[#322E29] pt-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-medium text-[#5C5750] dark:text-[#A69F96]">
                  4. Optional: Connect Gmail &amp; Calendar so Bestie can brief you on emails &amp; meetings.
                </p>
                {googleUser && hasGoogleToken && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected ({googleUser.email})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {googleUser && hasGoogleToken ? (
                  <button
                    type="button"
                    onClick={validateAndComplete}
                    className="sm:col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F26B5B] px-5 text-sm font-bold text-white hover:opacity-95 transition-opacity"
                  >
                    Enter My Workspace
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={connectingGoogle || !isOnline}
                      onClick={() => void handleConnectAndFinish()}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#161513] px-4 text-xs sm:text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#F26B5B] disabled:opacity-50 transition-colors"
                    >
                      <Mail className="h-4 w-4 text-[#F26B5B] shrink-0" />
                      {connectingGoogle
                        ? "Connecting Google..."
                        : "Connect Gmail & Calendar"}
                    </button>

                    <button
                      type="button"
                      onClick={validateAndComplete}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F26B5B] px-4 text-xs sm:text-sm font-bold text-white hover:opacity-95 transition-opacity"
                    >
                      Skip — Use Without Google Account
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
