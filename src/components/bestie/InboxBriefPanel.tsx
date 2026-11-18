import React, { useState } from "react";
import {
  Mail,
  Calendar,
  Loader2,
  CheckSquare,
  Reply,
  RefreshCw,
  Check,
} from "lucide-react";
import { getInMemoryAccessToken } from "../../lib/googleAuth";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import { ReviewApproveEmailCard } from "./ReviewApproveEmailCard";
import type {
  CalendarEventItem,
  EmailDraft,
  MemoryItem,
  ScannedEmail,
} from "../../types/studio";

interface InboxBriefPanelProps {
  hasGoogleToken: boolean;
  isOnline?: boolean;
  memories: MemoryItem[];
  lastInboxSummary?: string;
  scannedEmails: ScannedEmail[];
  calendarEvents: CalendarEventItem[];
  lastScannedAt?: string;
  onConnectGoogle: () => void;
  onSaveScanResult: (payload: {
    executiveSummary: string;
    emails: ScannedEmail[];
    calendarEvents: CalendarEventItem[];
  }) => void;
  onConvertEmailToTask: (email: ScannedEmail) => void;
  onEmailSentSuccess: (draft: EmailDraft) => void;
  onQueueOfflineEmail?: (kind: "SEND_EMAIL" | "CREATE_DRAFT", draft: EmailDraft) => void;
}

function extractSenderEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match && match[1]) return match[1].trim();
  if (fromHeader.includes("@")) return fromHeader.trim();
  return "";
}

export const InboxBriefPanel: React.FC<InboxBriefPanelProps> = ({
  hasGoogleToken,
  isOnline = true,
  memories,
  lastInboxSummary,
  scannedEmails,
  calendarEvents,
  lastScannedAt,
  onConnectGoogle,
  onSaveScanResult,
  onConvertEmailToTask,
  onEmailSentSuccess,
  onQueueOfflineEmail,
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReplyEmailId, setActiveReplyEmailId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, EmailDraft>>({});

  const handleScanInbox = async () => {
    const token = getInMemoryAccessToken();
    if (!token) {
      onConnectGoogle();
      return;
    }

    setScanning(true);
    setError(null);
    try {
      const resp = await fetch("/api/google/inbox-brief", {
        method: "POST",
        headers: getAiRequestHeaders({
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({ memories }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to scan Gmail & Calendar.");
      }

      onSaveScanResult({
        executiveSummary: data.executiveSummary || "",
        emails: Array.isArray(data.emails) ? data.emails : [],
        calendarEvents: Array.isArray(data.calendarEvents) ? data.calendarEvents : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan inbox.");
    } finally {
      setScanning(false);
    }
  };

  const handleOpenReply = (email: ScannedEmail) => {
    if (activeReplyEmailId === email.id) {
      setActiveReplyEmailId(null);
      return;
    }
    if (!replyDrafts[email.id]) {
      setReplyDrafts((prev) => ({
        ...prev,
        [email.id]: {
          id: `reply-${email.id}`,
          to: extractSenderEmail(email.from),
          subject: email.suggestedReplySubject || `Re: ${email.subject}`,
          body: email.suggestedReplyBody || "",
          status: "pending",
          replyToMessageId: email.threadId,
        },
      }));
    }
    setActiveReplyEmailId(email.id);
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F26B5B]/15 text-[#F26B5B]">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Inbox &amp; Schedule Briefing
            </h3>
            <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
              {lastScannedAt
                ? `Last scanned ${new Date(lastScannedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Gmail & Google Calendar executive digest"}
            </p>
          </div>
        </div>

        {hasGoogleToken ? (
          <button
            type="button"
            disabled={scanning}
            onClick={() => void handleScanInbox()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#F26B5B] px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0"
          >
            {scanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Scan Inbox &amp; Brief Me
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnectGoogle}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#F26B5B] px-3.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            Connect Google to Scan
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F87171]">
          {error}
        </p>
      )}

      {lastInboxSummary && (
        <div className="rounded-xl border border-[#F26B5B]/30 bg-[#F26B5B]/8 p-3.5">
          <p className="text-[11px] font-bold text-[#D94E3E] dark:text-[#FF8C7E] mb-1">
            Executive Briefing
          </p>
          <p className="text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] leading-relaxed">
            {lastInboxSummary}
          </p>
        </div>
      )}

      {/* Calendar Agenda */}
      {calendarEvents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#5C5750] dark:text-[#A69F96] flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#F26B5B]" />
            Upcoming Calendar ({calendarEvents.length})
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {calendarEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs"
              >
                <span className="font-medium text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                  {ev.summary}
                </span>
                <span className="font-mono text-[11px] text-[#6E685F] dark:text-[#9A9389] shrink-0 tabular-nums">
                  {ev.start
                    ? new Date(ev.start).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "All day"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scanned Emails */}
      {scannedEmails.length > 0 ? (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-0.5">
          {scannedEmails.map((em) => {
            const draft = replyDrafts[em.id];
            const isReplying = activeReplyEmailId === em.id && draft;
            return (
              <div
                key={em.id}
                className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1E1E1E] dark:text-[#F5F2EC] truncate">
                      {em.subject}
                    </p>
                    <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] truncate">
                      {em.from} ·{" "}
                      <span
                        className={
                          em.priority === "High"
                            ? "font-semibold text-[#D94E3E] dark:text-[#FF8C7E]"
                            : ""
                        }
                      >
                        {em.priority} priority
                      </span>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#383530] dark:text-[#DCD6CD] leading-relaxed">
                  {em.summary}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={Boolean(em.taskAdded)}
                    onClick={() => onConvertEmailToTask(em)}
                    className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                      em.taskAdded
                        ? "bg-[#10B981]/15 text-[#065F46] dark:text-[#A7F3D0]"
                        : "border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#F26B5B]"
                    }`}
                  >
                    {em.taskAdded ? (
                      <>
                        <Check className="h-3 w-3" /> Task Added
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3 w-3" /> Convert to Task
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenReply(em)}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#F26B5B]/50 bg-[#F26B5B]/12 px-2.5 text-[11px] font-semibold text-[#D94E3E] dark:text-[#FF8C7E] hover:bg-[#F26B5B]/20"
                  >
                    <Reply className="h-3 w-3" />
                    {isReplying ? "Hide Reply" : "Draft Reply"}
                  </button>
                </div>

                {isReplying && draft && (
                  <ReviewApproveEmailCard
                    draft={draft}
                    hasGoogleToken={hasGoogleToken}
                    isOnline={isOnline}
                    onConnectGoogle={onConnectGoogle}
                    onUpdateDraft={(next) =>
                      setReplyDrafts((prev) => ({ ...prev, [em.id]: next }))
                    }
                    onEmailSentSuccess={onEmailSentSuccess}
                    onQueueOfflineEmail={onQueueOfflineEmail}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] py-8 px-4 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
          {hasGoogleToken
            ? "Click \"Scan Inbox & Brief Me\" to summarize recent emails and calendar events."
            : "Connect your Google Account in the top bar to scan your Gmail inbox and Calendar agenda."}
        </div>
      )}
    </div>
  );
};
