import React, { useState } from "react";
import { Mail, Send, FileText, X, CheckCircle2, Loader2, Clock } from "lucide-react";
import { getInMemoryAccessToken } from "../../lib/googleAuth";
import type { EmailDraft } from "../../types/studio";

interface ReviewApproveEmailCardProps {
  draft: EmailDraft;
  hasGoogleToken: boolean;
  isOnline?: boolean;
  onConnectGoogle: () => void;
  onUpdateDraft: (updated: EmailDraft) => void;
  onEmailSentSuccess: (draft: EmailDraft) => void;
  onQueueOfflineEmail?: (kind: "SEND_EMAIL" | "CREATE_DRAFT", draft: EmailDraft) => void;
}

export const ReviewApproveEmailCard: React.FC<ReviewApproveEmailCardProps> = ({
  draft,
  hasGoogleToken,
  isOnline = true,
  onConnectGoogle,
  onUpdateDraft,
  onEmailSentSuccess,
  onQueueOfflineEmail,
}) => {
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);

  if (draft.status === "discarded") {
    return (
      <div className="mt-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs text-[#6E685F] dark:text-[#9A9389]">
        Email draft discarded.
      </div>
    );
  }

  if (draft.status === "sent") {
    return (
      <div className="mt-2.5 rounded-xl border border-[#10B981]/50 bg-[#10B981]/12 px-3.5 py-3 text-xs text-[#065F46] dark:text-[#A7F3D0] flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
        <span>
          Sent to <strong>{draft.to}</strong> — &ldquo;{draft.subject}&rdquo;
        </span>
      </div>
    );
  }

  if (queuedNotice) {
    return (
      <div className="mt-2.5 rounded-xl border border-[#F59E0B]/50 bg-[#F59E0B]/12 px-3.5 py-3 text-xs text-[#92400E] dark:text-[#FCD34D] flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-[#F59E0B]" />
        <span>{queuedNotice}</span>
      </div>
    );
  }

  const handleQueueOffline = (kind: "SEND_EMAIL" | "CREATE_DRAFT") => {
    if (!onQueueOfflineEmail) return;
    onQueueOfflineEmail(kind, draft);
    setQueuedNotice(
      kind === "SEND_EMAIL"
        ? `Queued email to ${draft.to} — will send when reconnected.`
        : `Queued Gmail draft "${draft.subject}" — will save when reconnected.`
    );
    setConfirmingSend(false);
  };

  const handleSaveGmailDraft = async () => {
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      handleQueueOffline("CREATE_DRAFT");
      return;
    }
    const token = getInMemoryAccessToken();
    if (!token) {
      onConnectGoogle();
      return;
    }
    setBusy("draft");
    setError(null);
    try {
      const resp = await fetch("/api/google/create-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          threadId: draft.replyToMessageId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not save draft.");
      }
      onUpdateDraft({ ...draft, status: "drafted" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Gmail draft.");
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmSend = async () => {
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      handleQueueOffline("SEND_EMAIL");
      return;
    }
    const token = getInMemoryAccessToken();
    if (!token) {
      onConnectGoogle();
      return;
    }
    setBusy("send");
    setError(null);
    try {
      const resp = await fetch("/api/google/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          threadId: draft.replyToMessageId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not send email.");
      }
      const sentDraft: EmailDraft = { ...draft, status: "sent" };
      onUpdateDraft(sentDraft);
      onEmailSentSuccess(sentDraft);
      setConfirmingSend(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-[#F26B5B]/50 bg-[#FFFFFF] dark:bg-[#22201D] p-3.5 space-y-2.5 text-[#1E1E1E] dark:text-[#F5F2EC]">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D94E3E] dark:text-[#F26B5B]">
          <Mail className="h-3.5 w-3.5" />
          Review &amp; Approve Email
        </span>
        {draft.status === "drafted" && (
          <span className="text-[11px] font-semibold text-[#10B981]">
            Saved in Gmail Drafts
          </span>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
          To
          <input
            type="email"
            value={draft.to}
            onChange={(e) => onUpdateDraft({ ...draft, to: e.target.value })}
            placeholder="recipient@example.com"
            className="mt-0.5 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F26B5B] focus:outline-none"
          />
        </label>

        <label className="block text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
          Subject
          <input
            type="text"
            value={draft.subject}
            onChange={(e) => onUpdateDraft({ ...draft, subject: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-1.5 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F26B5B] focus:outline-none"
          />
        </label>

        <label className="block text-[11px] font-medium text-[#6E685F] dark:text-[#9A9389]">
          Message
          <textarea
            rows={4}
            value={draft.body}
            onChange={(e) => onUpdateDraft({ ...draft, body: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-2.5 py-1.5 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#F26B5B] focus:outline-none leading-relaxed"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-[#DC2626]/10 px-2.5 py-1.5 text-[11px] text-[#DC2626] dark:text-[#F87171]">
          {error}
        </p>
      )}

      {!isOnline && onQueueOfflineEmail ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onUpdateDraft({ ...draft, status: "discarded" })}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#6E685F] hover:text-[#DC2626]"
          >
            <X className="h-3.5 w-3.5" />
            Discard
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!draft.to.trim() || !draft.subject.trim()}
              onClick={() => handleQueueOffline("CREATE_DRAFT")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-3 text-xs font-medium disabled:opacity-50"
            >
              <Clock className="h-3.5 w-3.5" />
              Queue Draft
            </button>
            <button
              type="button"
              disabled={!draft.to.trim() || !draft.subject.trim()}
              onClick={() => handleQueueOffline("SEND_EMAIL")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3.5 text-xs font-semibold text-[#1E1E1E] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Queue Send Offline
            </button>
          </div>
        </div>
      ) : !hasGoogleToken ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389]">
            Connect Google Account to send or save as Gmail draft.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateDraft({ ...draft, status: "discarded" })}
              className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] px-2.5 text-xs text-[#6E685F]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onConnectGoogle}
              className="h-8 rounded-lg bg-[#F26B5B] px-3 text-xs font-semibold text-white"
            >
              Connect Google
            </button>
          </div>
        </div>
      ) : confirmingSend ? (
        <div className="rounded-lg border border-[#F26B5B]/40 bg-[#F26B5B]/10 p-2.5 space-y-2">
          <p className="text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC]">
            Send this email to <strong>{draft.to || "(missing recipient)"}</strong> via Gmail?
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirmingSend(false)}
              className="h-8 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-3 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy !== null || !draft.to.trim() || !draft.subject.trim()}
              onClick={() => void handleConfirmSend()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F26B5B] px-3.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy === "send" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Confirm &amp; Send
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onUpdateDraft({ ...draft, status: "discarded" })}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#6E685F] hover:text-[#DC2626]"
          >
            <X className="h-3.5 w-3.5" />
            Discard
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy !== null || !draft.to.trim()}
              onClick={() => void handleSaveGmailDraft()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#F26B5B] disabled:opacity-50"
            >
              {busy === "draft" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Save Draft
            </button>
            <button
              type="button"
              disabled={busy !== null || !draft.to.trim() || !draft.subject.trim()}
              onClick={() => setConfirmingSend(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F26B5B] px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Approve &amp; Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
