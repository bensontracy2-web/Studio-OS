import React from "react";
import { X, Check, LayoutGrid } from "lucide-react";
import { TAB_CONFIGS } from "../../config/tabs";
import {
  ALL_TABS,
  FOCUS_ROLES,
  getCombinedTabsForRoles,
} from "../../data/initialState";
import type { TabId } from "../../types/studio";

interface CustomizeTabsModalProps {
  open: boolean;
  visibleTabs: TabId[];
  currentRoles: string[];
  onToggleTab: (tabId: TabId) => void;
  onApplyPreset: (tabs: TabId[], roles?: string[]) => void;
  onClose: () => void;
}

export const CustomizeTabsModal: React.FC<CustomizeTabsModalProps> = ({
  open,
  visibleTabs,
  currentRoles,
  onToggleTab,
  onApplyPreset,
  onClose,
}) => {
  if (!open) return null;

  const handleToggleRolePreset = (role: string) => {
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];
    const nextTabs = getCombinedTabsForRoles(nextRoles);
    onApplyPreset(nextTabs, nextRoles);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customize visible workspaces"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F26B5B]/15 text-[#F26B5B]">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                Customize Visible Tabs
              </h2>
              <p className="text-xs text-[#6E685F] dark:text-[#9A9389]">
                Combine multiple roles or toggle individual workspaces anytime.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close customize tabs"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E685F] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Multi-Select Role Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#6E685F] dark:text-[#9A9389]">
              Active Roles (tap to combine workspaces)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FOCUS_ROLES.map(({ role }) => {
                const active = currentRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleToggleRolePreset(role)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-[#10B981] bg-[#10B981]/12 text-[#065F46] dark:text-[#A7F3D0]"
                        : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96]"
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onApplyPreset([...ALL_TABS])}
                className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-1 text-[11px] font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]"
              >
                Show All 7
              </button>
            </div>
          </div>

          {/* Individual Tab Checkboxes */}
          <div className="space-y-2">
            {TAB_CONFIGS.map((tab) => {
              const checked = visibleTabs.includes(tab.id);
              const isOnlyVisible = checked && visibleTabs.length <= 1;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={isOnlyVisible}
                  onClick={() => onToggleTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    checked
                      ? "bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]"
                      : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] opacity-60 hover:opacity-90"
                  }`}
                  style={{
                    borderColor: checked ? tab.accentHex : undefined,
                  }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                    style={{
                      backgroundColor: checked ? tab.accentHex : "transparent",
                      borderColor: checked ? tab.accentHex : "#C7BFB3",
                      color: checked ? tab.textOnAccent : "transparent",
                    }}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold">{tab.label}</p>
                    <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] truncate">
                      {tab.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#E8E2D8] dark:border-[#322E29] px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
            {visibleTabs.length} of {TAB_CONFIGS.length} tabs visible
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl bg-[#1E1E1E] dark:bg-[#F5F2EC] px-4 text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
