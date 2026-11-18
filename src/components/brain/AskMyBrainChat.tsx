import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, Trash2, BookOpen } from "lucide-react";
import type { BrainNote, BrainTask, ChatMessage } from "../../types/studio";
import { getAiRequestHeaders } from "../../lib/securityPrefs";
import { consumeSsePost } from "../../lib/sseStream";

interface AskMyBrainChatProps {
  notes: BrainNote[];
  tasks: BrainTask[];
  history: ChatMessage[];
  onAppendMessages: (msgs: ChatMessage[]) => void;
  onClearHistory: () => void;
  onFocusNote: (noteId: string) => void;
}

const STARTER_PROMPTS = [
  "What content hooks have I saved lately?",
  "Summarize my open client work tasks.",
  "Which idea should I film next?",
];

export const AskMyBrainChat: React.FC<AskMyBrainChatProps> = ({
  notes,
  tasks,
  history,
  onAppendMessages,
  onClearHistory,
  onFocusNote,
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, loading, streamingAnswer]);

  const sendQuestion = async (textToAsk: string) => {
    const trimmed = textToAsk.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    onAppendMessages([userMsg]);
    setQuestion("");
    setLoading(true);
    setStreamingAnswer("");
    setError(null);

    try {
      const data = await consumeSsePost<{
        answer?: string;
        citedNoteIds?: string[];
        modelUsed?: string;
      }>(
        "/api/brain/ask/stream",
        getAiRequestHeaders(),
        {
          question: trimmed,
          notes,
          tasks,
        },
        {
          onChunk: (delta) => {
            setStreamingAnswer((prev) => (prev ?? "") + delta);
          },
          onDone: () => {
            // Finalized below
          },
        }
      );

      const aiMsg: ChatMessage = {
        id: `msg-a-${Date.now()}`,
        role: "assistant",
        text: String(data.answer || "I couldn't find enough context to answer that yet."),
        citedNoteIds: Array.isArray(data.citedNoteIds) ? data.citedNoteIds : [],
        modelUsed: data.modelUsed,
        timestamp: new Date().toISOString(),
      };
      setStreamingAnswer(null);
      onAppendMessages([aiMsg]);
    } catch (err) {
      setStreamingAnswer(null);
      setError(err instanceof Error ? err.message : "Could not reach Second Brain.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(question);
  };

  return (
    <aside className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 flex flex-col h-[540px] lg:sticky lg:top-20">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E8E2D8] dark:border-[#322E29]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0EA5E9]/15 text-[#0284C7] dark:text-[#38BDF8]">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
              Ask My Brain
            </h3>
            <p className="text-[11px] text-[#6E685F] dark:text-[#9A9389] tabular-nums">
              Grounded in {notes.length} notes · {tasks.length} tasks
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            title="Clear chat history"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626] hover:bg-[#FAF7F2] dark:hover:bg-[#161513]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3">
        {history.length === 0 ? (
          <div className="h-full flex flex-col justify-center space-y-3 px-1">
            <p className="text-xs text-[#6E685F] dark:text-[#9A9389] leading-relaxed">
              Ask questions across everything you&apos;ve captured. Try a starter prompt:
            </p>
            <div className="space-y-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendQuestion(prompt)}
                  className="w-full text-left rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs font-medium text-[#1E1E1E] dark:text-[#F5F2EC] hover:border-[#0EA5E9] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#0EA5E9] text-white"
                    : "border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]"
                }`}
              >
                {msg.text}

                {msg.role === "assistant" &&
                  msg.citedNoteIds &&
                  msg.citedNoteIds.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#E8E2D8] dark:border-[#322E29] flex flex-wrap gap-1.5">
                      {msg.citedNoteIds.map((nid) => {
                        const matched = notes.find((n) => n.id === nid);
                        if (!matched) return null;
                        return (
                          <button
                            key={nid}
                            type="button"
                            onClick={() => onFocusNote(nid)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#0EA5E9]/12 px-2 py-0.5 text-[11px] font-medium text-[#0284C7] dark:text-[#38BDF8] hover:underline"
                          >
                            <BookOpen className="h-3 w-3" />
                            <span className="truncate max-w-[160px]">{matched.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
              {msg.modelUsed && (
                <span className="mt-1 text-[10px] font-mono text-[#8C857B]">
                  {msg.modelUsed}
                </span>
              )}
            </div>
          ))
        )}

        {streamingAnswer !== null && streamingAnswer.length > 0 && (
          <div className="flex flex-col items-start">
            <div className="max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#1E1E1E] dark:text-[#F5F2EC]">
              {streamingAnswer}
              <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[#0EA5E9] animate-pulse rounded-xs" />
            </div>
          </div>
        )}

        {loading && !streamingAnswer && (
          <div className="flex items-center gap-2 text-xs text-[#0284C7] dark:text-[#38BDF8] px-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching your Second Brain...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-[#DC2626]/10 px-2.5 py-1.5 text-xs text-[#DC2626] dark:text-[#F87171]">
          {error}
        </p>
      )}

      {/* Chat Input */}
      <form
        onSubmit={handleSubmit}
        className="pt-2 border-t border-[#E8E2D8] dark:border-[#322E29] flex items-center gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your notes or tasks..."
          className="h-10 flex-1 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 text-xs sm:text-sm text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#0EA5E9] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          aria-label="Send question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0EA5E9] text-white hover:bg-[#0284C7] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
};
