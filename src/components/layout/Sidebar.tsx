import React from "react";
import {
  Sparkles,
  LayoutDashboard,
  GraduationCap,
  Brain,
  Clapperboard,
  Image as ImageIcon,
  Gamepad2,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  X,
} from "lucide-react";
import { TAB_CONFIGS } from "../../config/tabs";
import type { TabId } from "../../types/studio";

interface SidebarProps {
  activeTab: TabId;
  visibleTabs: TabId[];
  collapsed: boolean;
  mobileOpen: boolean;
  onSelectTab: (tab: TabId) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onOpenCustomizeTabs: () => void;
}

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string }>> = {
  bestie: Sparkles,
  life: LayoutDashboard,
  academy: GraduationCap,
  brain: Brain,
  editdesk: Clapperboard,
  media: ImageIcon,
  gameroom: Gamepad2,
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  visibleTabs,
  collapsed,
  mobileOpen,
  onSelectTab,
  onToggleCollapse,
  onCloseMobile,
  onOpenCustomizeTabs,
}) => {
  const handleSelect = (tab: TabId) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const filteredTabs = TAB_CONFIGS.filter((t) => visibleTabs.includes(t.id));
  const navTabs = filteredTabs.length > 0 ? filteredTabs : TAB_CONFIGS;

  const renderNavItems = (isCollapsed: boolean) => (
    <nav className="flex-1 space-y-1 px-2.5 py-3 overflow-y-auto" aria-label="Workspace navigation">
      {navTabs.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleSelect(tab.id)}
            title={isCollapsed ? `${tab.label} — ${tab.subtitle}` : undefined}
            className={`group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#22201D] ${
              isActive
                ? "bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC] shadow-xs"
                : "text-[#5C5750] dark:text-[#A69F96] hover:bg-[#FAF7F2]/80 dark:hover:bg-[#161513]/60 hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
            style={{
              border: isActive ? `1.5px solid ${tab.accentHex}` : "1.5px solid transparent",
            }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105"
              style={{
                backgroundColor: isActive ? tab.accentHex : `${tab.accentHex}1F`,
                color: isActive ? tab.textOnAccent : tab.accentHex,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>

            {!isCollapsed && (
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                <span className="truncate whitespace-nowrap font-medium">{tab.label}</span>
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );

  // Mobile quick-access tabs filtered by user's visible workspaces (up to 5)
  const mobileQuickTabs = navTabs.slice(0, 5);

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] transition-[width] duration-200 ease-out ${
          collapsed ? "w-[76px]" : "w-[252px]"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-3.5">
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E1E1E] dark:bg-[#FACC15] text-[#FAF7F2] dark:text-[#1E1E1E] font-display font-bold text-sm">
                S
              </div>
              <span className="font-display text-base font-bold tracking-tight text-[#1E1E1E] dark:text-[#F5F2EC] whitespace-nowrap truncate">
                StudioOS
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-[#5C5750] dark:text-[#A69F96] hover:bg-[#FAF7F2] dark:hover:bg-[#161513] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC] transition-colors ${
              collapsed ? "mx-auto" : ""
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderNavItems(collapsed)}

        <div className="border-t border-[#E8E2D8] dark:border-[#322E29] p-3">
          <button
            type="button"
            onClick={onOpenCustomizeTabs}
            title="Customize Tabs"
            className={`flex w-full items-center gap-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#F26B5B] transition-colors ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-[#F26B5B] shrink-0" />
            {!collapsed && <span>Customize Tabs</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-[272px] max-w-[85vw] flex-col bg-[#FFFFFF] dark:bg-[#22201D] border-r border-[#E8E2D8] dark:border-[#322E29] shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-[#E8E2D8] dark:border-[#322E29] px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E1E1E] dark:bg-[#FACC15] text-[#FAF7F2] dark:text-[#1E1E1E] font-display font-bold text-sm">
                  S
                </div>
                <span className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  StudioOS
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C5750] dark:text-[#A69F96] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavItems(false)}
            <div className="border-t border-[#E8E2D8] dark:border-[#322E29] p-3">
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenCustomizeTabs();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-[#F26B5B]" />
                Customize Tabs
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 inset-x-0 z-30 flex lg:hidden h-14 items-center justify-around border-t border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF]/95 dark:bg-[#22201D]/95 backdrop-blur-md px-1"
      >
        {mobileQuickTabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[52px] h-11 rounded-lg px-2 transition-colors"
              style={{
                color: isActive ? tab.accentHex : undefined,
              }}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive ? "" : "text-[#6E685F] dark:text-[#A69F96]"
                }`}
              />
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  isActive
                    ? "text-[#1E1E1E] dark:text-[#F5F2EC] font-semibold"
                    : "text-[#6E685F] dark:text-[#A69F96]"
                }`}
              >
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
