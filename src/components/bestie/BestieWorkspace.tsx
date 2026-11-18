import React from "react";
import { Sparkles, Briefcase } from "lucide-react";
import { BestieChatPanel } from "./BestieChatPanel";
import { MemoryVaultPanel } from "./MemoryVaultPanel";
import { InboxBriefPanel } from "./InboxBriefPanel";
import type {
  AppControlAction,
  BestieMessage,
  BestiePersonality,
  BestieState,
  CalendarEventItem,
  EmailDraft,
  MemoryCategory,
  ScannedEmail,
} from "../../types/studio";

interface BestieWorkspaceProps {
  bestie: BestieState;
  studioContext: Record<string, unknown>;
  hasGoogleToken: boolean;
  isOnline: boolean;
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
  onSaveScanResult: (payload: {
    executiveSummary: string;
    emails: ScannedEmail[];
    calendarEvents: CalendarEventItem[];
  }) => void;
  onConvertEmailToTask: (email: ScannedEmail) => void;
  onEmailSentSuccess: (draft: EmailDraft) => void;
  onQueueOfflineEmail: (kind: "SEND_EMAIL" | "CREATE_DRAFT", draft: EmailDraft) => void;
}

export const BestieWorkspace: React.FC<BestieWorkspaceProps> = ({
  bestie,
  studioContext,
  hasGoogleToken,
  isOnline,
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
  onSaveScanResult,
  onConvertEmailToTask,
  onEmailSentSuccess,
  onQueueOfflineEmail,
}) => {
  return (
    <div className="space-y-6">
      {/* Coral Hero Summary Card */}
      <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F26B5B] text-white">
            {bestie.personality === "bestie" ? (
              <Sparkles className="h-5 w-5" />
            ) : (
              <Briefcase className="h-5 w-5" />
            )}
          </span>
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              {bestie.personality === "bestie"
                ? "Best Friend & Hype Buddy"
                : "Executive VA & Chief of Staff"}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96]">
              {bestie.personality === "bestie"
                ? "Natural AI companion powered by your Memory Vault—chat freely and watch your tasks, habits, and money update automatically."
                : "Managing tasks, scanning Gmail & Calendar, drafting replies, and organizing your day through conversation."}
            </p>
          </div>
        </div>

        <div className="text-xs text-[#6E685F] dark:text-[#9A9389] tabular-nums">
          <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
            {bestie.memories.length} memories active
          </span>{" "}
          ·{" "}
          <span>
            {hasGoogleToken ? "Google Workspace connected" : "Google Workspace disconnected"}
          </span>
        </div>
      </div>

      {/* Main 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <BestieChatPanel
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
        </div>

        <div className="lg:col-span-5 space-y-5">
          <InboxBriefPanel
            hasGoogleToken={hasGoogleToken}
            isOnline={isOnline}
            memories={bestie.memories}
            lastInboxSummary={bestie.lastInboxSummary}
            scannedEmails={bestie.scannedEmails}
            calendarEvents={bestie.calendarEvents}
            lastScannedAt={bestie.lastScannedAt}
            onConnectGoogle={onConnectGoogle}
            onSaveScanResult={onSaveScanResult}
            onConvertEmailToTask={onConvertEmailToTask}
            onEmailSentSuccess={onEmailSentSuccess}
            onQueueOfflineEmail={onQueueOfflineEmail}
          />

          <MemoryVaultPanel
            memories={bestie.memories}
            onAddMemory={onAddMemory}
            onUpdateMemory={onUpdateMemory}
            onDeleteMemory={onDeleteMemory}
          />
        </div>
      </div>
    </div>
  );
};
