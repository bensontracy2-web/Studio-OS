import React, { useState } from "react";
import type {
  BrainNote,
  BrainTask,
  ChatMessage,
  SpecificBrainTag,
} from "../../types/studio";
import { QuickCaptureBox } from "./QuickCaptureBox";
import type { CaptureResultPayload } from "./QuickCaptureBox";
import { NotesAndTasksView } from "./NotesAndTasksView";
import { AskMyBrainChat } from "./AskMyBrainChat";

interface SecondBrainProps {
  notes: BrainNote[];
  tasks: BrainTask[];
  chatHistory: ChatMessage[];
  isOnline: boolean;
  onUpdateBrain: (
    updater: (prev: {
      notes: BrainNote[];
      tasks: BrainTask[];
      chatHistory: ChatMessage[];
    }) => {
      notes: BrainNote[];
      tasks: BrainTask[];
      chatHistory: ChatMessage[];
    }
  ) => void;
  onPromoteNoteToEditDesk: (note: BrainNote) => void;
  onQueueOfflineNoteEnrich?: (noteId: string, rawContent: string, title: string) => void;
}

export const SecondBrain: React.FC<SecondBrainProps> = ({
  notes,
  tasks,
  chatHistory,
  isOnline,
  onUpdateBrain,
  onPromoteNoteToEditDesk,
  onQueueOfflineNoteEnrich,
}) => {
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);

  const handleCaptured = (result: CaptureResultPayload) => {
    const nowIso = new Date().toISOString();
    const noteId = `note-${Date.now()}`;

    const newNote: BrainNote = {
      id: noteId,
      title: result.title,
      rawContent: result.rawContent,
      summary: result.summary,
      tag: result.tag,
      suggestedPlatform: result.suggestedPlatform,
      createdAt: nowIso,
      pendingAiEnrich: Boolean(result.pendingAiEnrich),
    };

    const extractedTasks: BrainTask[] = result.tasks.map((title, idx) => ({
      id: `task-${Date.now()}-${idx}`,
      title,
      tag: result.tag,
      completed: false,
      sourceNoteId: noteId,
      createdAt: nowIso,
    }));

    onUpdateBrain((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
      tasks: [...extractedTasks, ...prev.tasks],
    }));

    if (result.pendingAiEnrich && onQueueOfflineNoteEnrich) {
      onQueueOfflineNoteEnrich(noteId, result.rawContent, result.title);
    }

    setHighlightedNoteId(noteId);
    window.setTimeout(() => setHighlightedNoteId(null), 3500);
  };

  const handleDeleteNote = (id: string) => {
    onUpdateBrain((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
    }));
  };

  const handleChangeNoteTag = (id: string, tag: SpecificBrainTag) => {
    onUpdateBrain((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? { ...n, tag } : n)),
    }));
  };

  const handleToggleTask = (id: string) => {
    onUpdateBrain((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    }));
  };

  const handleAddManualTask = (title: string, tag: SpecificBrainTag) => {
    const newTask: BrainTask = {
      id: `task-${Date.now()}`,
      title,
      tag,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    onUpdateBrain((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  };

  const handleDeleteTask = (id: string) => {
    onUpdateBrain((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  const handleAppendMessages = (msgs: ChatMessage[]) => {
    onUpdateBrain((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, ...msgs],
    }));
  };

  const handleClearHistory = () => {
    onUpdateBrain((prev) => ({ ...prev, chatHistory: [] }));
  };

  const handleFocusNote = (noteId: string) => {
    setHighlightedNoteId(noteId);
    const el = document.getElementById(`brain-note-${noteId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightedNoteId(null), 3500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 xl:col-span-8 space-y-5">
        <QuickCaptureBox isOnline={isOnline} onCaptured={handleCaptured} />
        <NotesAndTasksView
          notes={notes}
          tasks={tasks}
          highlightedNoteId={highlightedNoteId}
          onPromoteToEditDesk={onPromoteNoteToEditDesk}
          onDeleteNote={handleDeleteNote}
          onChangeNoteTag={handleChangeNoteTag}
          onToggleTask={handleToggleTask}
          onAddManualTask={handleAddManualTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>

      <div className="lg:col-span-5 xl:col-span-4">
        <AskMyBrainChat
          notes={notes}
          tasks={tasks}
          history={chatHistory}
          onAppendMessages={handleAppendMessages}
          onClearHistory={handleClearHistory}
          onFocusNote={handleFocusNote}
        />
      </div>
    </div>
  );
};
