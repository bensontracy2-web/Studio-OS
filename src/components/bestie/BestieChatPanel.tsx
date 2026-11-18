import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Volume2,
  Square,
  Sparkles,
  Briefcase,
  CheckCircle2,
  Loader2,
  Trash2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { speakBestieReply, stopActiveVoice } from "../../lib/voiceReply";
import { parseOfflineBestieCommand } from "../../lib/offlineBestieParser";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import { consumeSsePost } from "../../lib/sseStream";
import { ReviewApproveEmailCard } from "./ReviewApproveEmailCard";
import type {
  AppControlAction,
  BestieMessage,
  BestiePersonality,
  EmailDraft,
  MemoryItem,
} from "../../types/studio";

interface BestieChatPanelProps {
  personality: BestiePersonality;
  memories: MemoryItem[];
  messages: BestieMessage[];
  studioContext: Record<string, unknown>;
  hasGoogleToken: boolean;
  isOnline?: boolean;
  compact?: boolean;
  userName?: string;
  onTriggerMorningGreeting?: () => void;
  onOpenSecuritySettings?: () => void;
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
  onConnectGoogle: () => void;
  onEmailSentSuccess: (draft: EmailDraft) => void;
  onQueueOfflineEmail?: (kind: "SEND_EMAIL" | "CREATE_DRAFT", draft: EmailDraft) => void;
}

const STARTER_COMMANDS: Record<BestiePersonality, string[]> = {
  bestie: [
    "Hey! Help me organize my day",
    "I'm making a dress today & made ₦20,000",
    "Remind me to drink water daily",
  ],
  va: [
    "What should I prioritize first today?",
    "I need to finish my CS assignment today",
    "Draft an email to my client",
  ],
};

export const BestieChatPanel: React.FC<BestieChatPanelProps> = ({
  personality,
  memories,
  messages,
  studioContext,
  hasGoogleToken,
  isOnline = true,
  compact = false,
  userName = "",
  onTriggerMorningGreeting,
  onOpenSecuritySettings,
  onChangePersonality,
  onSendMessageResult,
  onExecuteActions,
  onUpdateMessageDraft,
  onClearChat,
  onConnectGoogle,
  onEmailSentSuccess,
  onQueueOfflineEmail,
}) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingUserMsg, setPendingUserMsg] = useState<BestieMessage | null>(null);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    message: string;
    needsKey?: boolean;
  } | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [voiceEngineLabel, setVoiceEngineLabel] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading, streamingReply]);

  const handleToggleSpeak = async (msg: BestieMessage) => {
    if (speakingMsgId === msg.id) {
      stopActiveVoice();
      setSpeakingMsgId(null);
      setVoiceEngineLabel(null);
      return;
    }

    setSpeakingMsgId(msg.id);
    setVoiceEngineLabel("Loading voice...");
    const result = await speakBestieReply(msg.text, msg.personality, () => {
      setSpeakingMsgId(null);
      setVoiceEngineLabel(null);
    });
    setVoiceEngineLabel(
      result.engine === "gemini-3.8-flash-tts" ? "gemini-3.8-flash-tts" : "Browser speech"
    );
  };

  const runOfflineFallback = (userMsg: BestieMessage, trimmed: string) => {
    const offlineResult = parseOfflineBestieCommand(trimmed, personality);
    const executedBadges =
      offlineResult.actions.length > 0
        ? onExecuteActions(offlineResult.actions)
        : [];

    const assistantMsg: BestieMessage = {
      id: `bmsg-a-${Date.now()}`,
      role: "assistant",
      personality,
      text: offlineResult.reply,
      executedActions: executedBadges,
      modelUsed: "offline-parser",
      timestamp: new Date().toISOString(),
    };

    onSendMessageResult({ userMessage: userMsg, assistantMessage: assistantMsg });
  };

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: BestieMessage = {
      id: `bmsg-u-${Date.now()}`,
      role: "user",
      personality,
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setInput("");
    setLoading(true);
    setErrorState(null);

    const deviceOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);
    if (deviceOffline) {
      runOfflineFallback(userMsg, trimmed);
      setLoading(false);
      return;
    }

    try {
      setPendingUserMsg(userMsg);
      setStreamingReply("");

      const data = await consumeSsePost<{
        reply?: string;
        actions?: AppControlAction[];
        hasEmailDraft?: boolean;
        emailDraft?: { to?: string; subject?: string; body?: string };
        modelUsed?: string;
      }>(
        "/api/bestie/chat/stream",
        getAiRequestHeaders(),
        {
          message: trimmed,
          personality,
          memories,
          studioContext,
          history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        },
        {
          onChunk: (delta) => {
            setStreamingReply((prev) => (prev ?? "") + delta);
          },
          onDone: () => {
            // Finalized below once stream promise resolves
          },
        }
      );

      const rawActions: AppControlAction[] = Array.isArray(data.actions)
        ? data.actions
        : [];
      const executedBadges =
        rawActions.length > 0 ? onExecuteActions(rawActions) : [];

      const emailDraft: EmailDraft | undefined =
        data.hasEmailDraft && data.emailDraft
          ? {
              id: `edraft-${Date.now()}`,
              to: String(data.emailDraft.to || ""),
              subject: String(data.emailDraft.subject || ""),
              body: String(data.emailDraft.body || ""),
              status: "pending",
            }
          : undefined;

      const assistantMsg: BestieMessage = {
        id: `bmsg-a-${Date.now()}`,
        role: "assistant",
        personality,
        text: String(data.reply || "Got it!"),
        executedActions: executedBadges,
        emailDraft,
        modelUsed: data.modelUsed,
        timestamp: new Date().toISOString(),
      };

      setPendingUserMsg(null);
      setStreamingReply(null);
      onSendMessageResult({ userMessage: userMsg, assistantMessage: assistantMsg });
    } catch (err) {
      setPendingUserMsg(null);
      setStreamingReply(null);

      // Only invoke offline parser if browser genuinely lost internet connectivity
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        runOfflineFallback(userMsg, trimmed);
      } else {
        const errObj = err as Error & { code?: string };
        const msg = errObj instanceof Error ? errObj.message : "Could not reach Gemini AI.";
        const needsKey =
          errObj?.code === "MISSING_API_KEY" ||
          errObj?.code === "INVALID_API_KEY" ||
          errObj?.code === "SERVER_KEY_RATE_LIMITED" ||
          /api key|security & privacy/i.test(msg);

        // Preserve the user's draft text so they don't lose what they typed
        setInput(trimmed);
        setErrorState({ message: msg, needsKey });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSend(input);
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] overflow-hidden ${
        compact ? "h-full" : "h-[640px]"
      }`}
    >
      {/* Dual Personality Toggle Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2D8] dark:border-[#322E29] px-4 py-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FAF7F2] dark:bg-[#161513]">
          <button
            type="button"
            onClick={() => onChangePersonality("bestie")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              personality === "bestie"
                ? "bg-[#F26B5B] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Best Friend
          </button>
          <button
            type="button"
            onClick={() => onChangePersonality("va")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              personality === "va"
                ? "bg-[#F26B5B] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Executive VA
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {onTriggerMorningGreeting && (
            <button
              type="button"
              onClick={onTriggerMorningGreeting}
              disabled={loading}
              title="Get a fresh conversational greeting from Bestie & VA"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-[11px] font-semibold text-[#F26B5B] hover:bg-[#F26B5B]/10 disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              Say Hi
            </button>
          )}
          <button
            type="button"
            onClick={onClearChat}
            title="Clear chat history"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] p-6 text-center space-y-3">
            <p className="text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96]">
              Hey{userName ? ` ${userName}` : ""}! Ask me anything, talk through your day, or tell me what you&apos;re working on — I&apos;ll organize tasks, habits, money, and memories naturally as we chat.
            </p>
            {onTriggerMorningGreeting && (
              <button
                type="button"
                onClick={onTriggerMorningGreeting}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#F26B5B] px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Start Conversation
              </button>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            const isSpeaking = speakingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? "bg-[#F26B5B] text-white"
                      : "border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Missing API Key Prompt Action */}
                  {!isUser && msg.modelUsed === "setup-required" && onOpenSecuritySettings && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={onOpenSecuritySettings}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#F26B5B] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Add Free Gemini Key in Security Settings
                      </button>
                    </div>
                  )}

                  {/* App-Control Action Confirmation Badges */}
                  {!isUser && msg.executedActions && msg.executedActions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {msg.executedActions.map((act, idx) => (
                        <span
                          key={`${msg.id}-act-${idx}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#10B981]/40 bg-[#10B981]/15 px-2.5 py-1 text-[11px] font-semibold text-[#065F46] dark:text-[#A7F3D0]"
                        >
                          <CheckCircle2 className="h-3 w-3 text-[#10B981] shrink-0" />
                          {act.badgeText}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inline Review & Approve Email Card */}
                  {!isUser && msg.emailDraft && (
                    <ReviewApproveEmailCard
                      draft={msg.emailDraft}
                      hasGoogleToken={hasGoogleToken}
                      isOnline={isOnline}
                      onConnectGoogle={onConnectGoogle}
                      onUpdateDraft={(nextDraft) =>
                        onUpdateMessageDraft(msg.id, nextDraft)
                      }
                      onEmailSentSuccess={onEmailSentSuccess}
                      onQueueOfflineEmail={onQueueOfflineEmail}
                    />
                  )}
                </div>

                {/* Message Footer: Speaker Voice Reply & Mode Label */}
                <div className="mt-1 flex items-center gap-2.5 px-1">
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => void handleToggleSpeak(msg)}
                      aria-label={isSpeaking ? "Stop voice reply" : "Listen to reply"}
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                        isSpeaking
                          ? "bg-[#F26B5B]/15 text-[#D94E3E] dark:text-[#FF8C7E]"
                          : "text-[#6E685F] dark:text-[#9A9389] hover:text-[#F26B5B]"
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <Square className="h-3 w-3 fill-current" />
                          Stop ({voiceEngineLabel || "Speaking"})
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" />
                          Speak
                        </>
                      )}
                    </button>
                  )}
                  <span className="text-[10px] text-[#8C857B] font-mono tabular-nums">
                    {msg.personality === "bestie" ? "Bestie" : "Executive VA"} ·{" "}
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {pendingUserMsg && (
          <div className="flex flex-col items-end">
            <div className="max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed bg-[#F26B5B] text-white">
              <p className="whitespace-pre-wrap">{pendingUserMsg.text}</p>
            </div>
          </div>
        )}

        {streamingReply !== null && streamingReply.length > 0 && (
          <div className="flex flex-col items-start">
            <div className="max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]">
              <p className="whitespace-pre-wrap">
                {streamingReply}
                <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[#F26B5B] animate-pulse rounded-xs" />
              </p>
            </div>
          </div>
        )}

        {loading && !streamingReply && (
          <div className="flex items-center gap-2 text-xs text-[#F26B5B] px-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {personality === "bestie"
              ? "Bestie is typing..."
              : "Executive VA is thinking..."}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Starter Prompt Chips */}
      <div className="border-t border-[#E8E2D8] dark:border-[#322E29] px-3 py-2 flex items-center gap-1.5 overflow-x-auto bg-[#FAF7F2]/60 dark:bg-[#161513]/60">
        {STARTER_COMMANDS[personality].map((cmd) => (
          <button
            key={cmd}
            type="button"
            disabled={loading}
            onClick={() => void handleSend(cmd)}
            className="rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 py-1 text-[11px] font-medium text-[#5C5750] dark:text-[#A69F96] hover:border-[#F26B5B] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>

      {errorState && (
        <div className="mx-3 mb-2 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F87171] space-y-2">
          <p>{errorState.message}</p>
          {errorState.needsKey && onOpenSecuritySettings && (
            <button
              type="button"
              onClick={onOpenSecuritySettings}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
            >
              <ShieldCheck className="h-3 w-3" />
              Open Security Settings to Add Free Key
            </button>
          )}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#E8E2D8] dark:border-[#322E29] p-3 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            personality === "bestie"
              ? "Chat with Bestie about your day, goals, wins, or plans..."
              : "Ask Executive VA anything or share today's priorities & updates..."
          }
          className="h-10 flex-1 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3.5 text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#F26B5B] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F26B5B] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
