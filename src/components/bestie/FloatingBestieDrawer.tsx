import React, { useState } from "react";
import { MessageCircleHeart, X, Bookmark, MessageSquare, ArrowUpRight } from "lucide-react";
import { BestieChatPanel } from "./BestieChatPanel";
import { MemoryVaultPanel } from "./MemoryVaultPanel";
import type {
  AppControlAction,
  BestieMessage,
  BestiePersonality,
  BestieState,
  EmailDraft,
  MemoryCategory,
} from "../../types/studio";

interface FloatingBestieDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bestie: BestieState;
  studioContext: Record<string, unknown>;
  hasGoogleToken: boolean;
  isOnline: boolean;
  isOnBestieTab: boolean;
  userName: string;
  onTriggerMorningGreeting: () => void;
  onOpenSecuritySettings: () => void;
  onChangePersonality: (p: BestiePersonality) => void;
  onSendMessageResult: (params: {
    userMessage: BestieMessage;
    assistantMessage: BestieMessage;
  }) => void;
  onExecuteActions: (
    actions: AppControlAction[]
  ) => Array<{ type: AppControlAction["type"]; badgeText: string }>;
  onUpdateMessageDraft: (messageId: string, nextDraft: EmailDraft) => void;
  onClearChat: () => void;
  onAddMemory: (category: MemoryCategory, content: string) => void;
  onUpdateMemory: (id: string, content: string) => void;
  onDeleteMemory: (id: string) => void;
  onConnectGoogle: () => void;
  onEmailSentSuccess: (draft: EmailDraft) => void;
  onQueueOfflineEmail: (kind: "SEND_EMAIL" | "CREATE_DRAFT", draft: EmailDraft) => void;
  onOpenFullTab: () => void;
}

export const FloatingBestieDrawer: React.FC<FloatingBestieDrawerProps> = ({
  open,
  onOpenChange,
  bestie,
  studioContext,
  hasGoogleToken,
  isOnline,
  isOnBestieTab,
  userName,
  onTriggerMorningGreeting,
  onOpenSecuritySettings,
  onChangePersonality,
  onSendMessageResult,
  onExecuteActions,
  onUpdateMessageDraft,
  onClearChat,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onConnectGoogle,
  onEmailSentSuccess,
  onQueueOfflineEmail,
  onOpenFullTab,
}) => {
  const [drawerTab, setDrawerTab] = useState<"chat" | "memory">("chat");

  return (
    <>
      {/* Floating Quick-Drawer Trigger Button (accessible on every tab) */}
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Chat with Bestie"
          className="fixed bottom-[68px] lg:bottom-6 right-4 lg:right-6 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#F26B5B] px-4 text-xs sm:text-sm font-semibold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B5B] focus-visible:ring-offset-2"
        >
          <MessageCircleHeart className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Chat with Bestie</span>
        </button>
      )}

      {/* Slide-Over Quick Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Chat with Bestie quick drawer"
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F26B5B] text-white">
                  <MessageCircleHeart className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                    Chat with Bestie &amp; VA
                  </h2>
                  <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] truncate">
                    Conversational AI, smart logging &amp; memory
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isOnBestieTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenFullTab();
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-[11px] font-semibold text-[#F26B5B] hover:bg-[#F26B5B]/10"
                  >
                    Full Tab
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close Bestie drawer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E685F] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sub-tab Switcher (Chat vs Memory Vault) */}
            <div className="flex items-center gap-1 border-b border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-4 py-2">
              <button
                type="button"
                onClick={() => setDrawerTab("chat")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  drawerTab === "chat"
                    ? "bg-[#F26B5B] text-white"
                    : "text-[#5C5750] dark:text-[#A69F96]"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat &amp; Actions
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab("memory")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  drawerTab === "memory"
                    ? "bg-[#F26B5B] text-white"
                    : "text-[#5C5750] dark:text-[#A69F96]"
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                Memory Vault ({bestie.memories.length})
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 min-h-0 p-3 overflow-y-auto">
              {drawerTab === "chat" ? (
                <BestieChatPanel
                  compact
                  personality={bestie.personality}
                  memories={bestie.memories}
                  messages={bestie.messages}
                  studioContext={studioContext}
                  hasGoogleToken={hasGoogleToken}
                  isOnline={isOnline}
                  userName={userName}
                  onTriggerMorningGreeting={onTriggerMorningGreeting}
                  onOpenSecuritySettings={onOpenSecuritySettings}
                  onChangePersonality={onChangePersonality}
                  onSendMessageResult={onSendMessageResult}
                  onExecuteActions={onExecuteActions}
                  onUpdateMessageDraft={onUpdateMessageDraft}
                  onClearChat={onClearChat}
                  onConnectGoogle={onConnectGoogle}
                  onEmailSentSuccess={onEmailSentSuccess}
                  onQueueOfflineEmail={onQueueOfflineEmail}
                />
              ) : (
                <MemoryVaultPanel
                  memories={bestie.memories}
                  onAddMemory={onAddMemory}
                  onUpdateMemory={onUpdateMemory}
                  onDeleteMemory={onDeleteMemory}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
