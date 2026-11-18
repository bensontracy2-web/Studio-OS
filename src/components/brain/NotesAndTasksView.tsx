import React, { useState } from "react";
import {
  Search,
  Clapperboard,
  Trash2,
  Check,
  Plus,
  FileText,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  BrainNote,
  BrainTask,
  BrainWorkspaceTag,
  SpecificBrainTag,
} from "../../types/studio";

interface NotesAndTasksViewProps {
  notes: BrainNote[];
  tasks: BrainTask[];
  highlightedNoteId: string | null;
  onPromoteToEditDesk: (note: BrainNote) => void;
  onDeleteNote: (id: string) => void;
  onChangeNoteTag: (id: string, tag: SpecificBrainTag) => void;
  onToggleTask: (id: string) => void;
  onAddManualTask: (title: string, tag: SpecificBrainTag) => void;
  onDeleteTask: (id: string) => void;
}

const WORKSPACE_TABS: BrainWorkspaceTag[] = [
  "Everything",
  "Personal",
  "My content",
  "Client work",
  "Ideas",
  "Learning",
];

const SPECIFIC_TAGS: SpecificBrainTag[] = [
  "Personal",
  "My content",
  "Client work",
  "Ideas",
  "Learning",
];

export const NotesAndTasksView: React.FC<NotesAndTasksViewProps> = ({
  notes,
  tasks,
  highlightedNoteId,
  onPromoteToEditDesk,
  onDeleteNote,
  onChangeNoteTag,
  onToggleTask,
  onAddManualTask,
  onDeleteTask,
}) => {
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<BrainWorkspaceTag>("Everything");
  const [subTab, setSubTab] = useState<"notes" | "tasks">("notes");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTag, setNewTaskTag] = useState<SpecificBrainTag>("Ideas");

  const q = search.trim().toLowerCase();

  const filteredNotes = notes.filter((n) => {
    const matchTag =
      selectedWorkspace === "Everything" || n.tag === selectedWorkspace;
    const matchQuery =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q) ||
      n.rawContent.toLowerCase().includes(q);
    return matchTag && matchQuery;
  });

  const filteredTasks = tasks.filter((t) => {
    const matchTag =
      selectedWorkspace === "Everything" || t.tag === selectedWorkspace;
    const matchQuery = !q || t.title.toLowerCase().includes(q);
    return matchTag && matchQuery;
  });

  const openTasksCount = tasks.filter((t) => !t.completed).length;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddManualTask(newTaskTitle.trim(), newTaskTag);
    setNewTaskTitle("");
  };

  return (
    <div className="rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 sm:p-6 space-y-4">
      {/* Sub-Tab & Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FAF7F2] dark:bg-[#161513] self-start">
          <button
            type="button"
            onClick={() => setSubTab("notes")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === "notes"
                ? "bg-[#0EA5E9] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Notes ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("tasks")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === "tasks"
                ? "bg-[#0EA5E9] text-white"
                : "text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Tasks ({openTasksCount} open)
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8C857B]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes & tasks..."
            className="h-9 w-full rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] pl-8 pr-3 text-xs text-[#1E1E1E] dark:text-[#F5F2EC] placeholder:text-[#8C857B] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>
      </div>

      {/* Workspace Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {WORKSPACE_TABS.map((ws) => {
          const active = selectedWorkspace === ws;
          return (
            <button
              key={ws}
              type="button"
              onClick={() => setSelectedWorkspace(ws)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                active
                  ? "border-[#0EA5E9] bg-[#0EA5E9]/12 text-[#0369A1] dark:text-[#7DD3FC]"
                  : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] text-[#5C5750] dark:text-[#A69F96] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
              }`}
            >
              {ws}
            </button>
          );
        })}
      </div>

      {/* Notes Sub-Tab */}
      {subTab === "notes" && (
        <div className="space-y-3">
          {filteredNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E8E2D8] dark:border-[#322E29] py-12 text-center">
              <p className="text-sm font-medium text-[#1E1E1E] dark:text-[#F5F2EC]">
                No notes in this view yet
              </p>
              <p className="mt-1 text-xs text-[#6E685F] dark:text-[#9A9389]">
                Use Quick Capture above to save and auto-tag a thought or link.
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isExpanded = Boolean(expandedIds[note.id]);
              const isHighlighted = highlightedNoteId === note.id;
              return (
                <article
                  key={note.id}
                  id={`brain-note-${note.id}`}
                  className={`rounded-xl border p-4 transition-colors ${
                    isHighlighted
                      ? "border-[#0EA5E9] bg-[#0EA5E9]/8 dark:bg-[#0EA5E9]/12"
                      : "border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2]/60 dark:bg-[#161513]/70"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                        {note.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6E685F] dark:text-[#9A9389]">
                        <select
                          aria-label={`Workspace tag for ${note.title}`}
                          value={note.tag}
                          onChange={(e) =>
                            onChangeNoteTag(
                              note.id,
                              e.target.value as SpecificBrainTag
                            )
                          }
                          className="rounded-md bg-transparent font-semibold text-[#0284C7] dark:text-[#38BDF8] focus:outline-none cursor-pointer"
                        >
                          {SPECIFIC_TAGS.map((t) => (
                            <option
                              key={t}
                              value={t}
                              className="bg-[#FFFFFF] dark:bg-[#22201D] text-[#1E1E1E] dark:text-[#F5F2EC]"
                            >
                              {t}
                            </option>
                          ))}
                        </select>
                        <span aria-hidden="true">·</span>
                        <span>Best for {note.suggestedPlatform}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPromoteToEditDesk(note)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                          note.promotedToCardId
                            ? "border border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#B45309] dark:text-[#FBBF24]"
                            : "bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
                        }`}
                      >
                        <Clapperboard className="h-3.5 w-3.5" />
                        {note.promotedToCardId ? "In Edit Desk" : "Promote to Edit Desk"}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        aria-label={`Delete ${note.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626] hover:bg-[#FFFFFF] dark:hover:bg-[#22201D]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-2.5 text-sm text-[#383530] dark:text-[#DCD6CD] leading-relaxed">
                    {note.summary}
                  </p>

                  {note.rawContent !== note.summary && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIds((prev) => ({
                            ...prev,
                            [note.id]: !prev[note.id],
                          }))
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7] dark:text-[#38BDF8] hover:underline"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Hide original capture
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            View original capture
                          </>
                        )}
                      </button>
                      {isExpanded && (
                        <p className="mt-2 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-3 text-xs text-[#5C5750] dark:text-[#A69F96] whitespace-pre-wrap leading-relaxed">
                          {note.rawContent}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Tasks Sub-Tab */}
      {subTab === "tasks" && (
        <div className="space-y-4">
          <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add an action item..."
              className="flex-1 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-sm text-[#1E1E1E] dark:text-[#F5F2EC] focus:border-[#0EA5E9] focus:outline-none"
            />
            <select
              value={newTaskTag}
              onChange={(e) =>
                setNewTaskTag(e.target.value as SpecificBrainTag)
              }
              className="rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FAF7F2] dark:bg-[#161513] px-3 py-2 text-xs text-[#1E1E1E] dark:text-[#F5F2EC]"
            >
              {SPECIFIC_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-xs font-semibold text-white hover:bg-[#0284C7] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </form>

          <div className="divide-y divide-[#E8E2D8] dark:divide-[#322E29]">
            {filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#6E685F] dark:text-[#9A9389]">
                No extracted or manual tasks in this workspace filter.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const sourceNote = task.sourceNoteId
                  ? notes.find((n) => n.id === task.sourceNoteId)
                  : undefined;
                return (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className="flex items-start gap-3 text-left min-w-0 flex-1"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          task.completed
                            ? "border-[#0EA5E9] bg-[#0EA5E9] text-white"
                            : "border-[#C7BFB3] dark:border-[#49433B] bg-[#FAF7F2] dark:bg-[#161513]"
                        }`}
                      >
                        {task.completed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            task.completed
                              ? "line-through text-[#8C857B]"
                              : "text-[#1E1E1E] dark:text-[#F5F2EC]"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6E685F] dark:text-[#9A9389]">
                          <span className="text-[#0284C7] dark:text-[#38BDF8] font-medium">
                            {task.tag}
                          </span>
                          {sourceNote && (
                            <>
                              {" · "}
                              <span>From: {sourceNote.title}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      aria-label={`Delete task ${task.title}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8C857B] hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
