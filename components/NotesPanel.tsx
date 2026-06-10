"use client";

import { useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { XIcon } from "./icons";

interface NotesPanelProps {
  open: boolean;
  /** Heading — the task title or lane label the note belongs to. */
  title: string;
  /** Small caption, e.g. "Task note" / "Lane note". */
  kindLabel: string;
  /** The current saved note (markdown). */
  value: string;
  /** Persist the edited markdown (called on blur / mode switch / close). */
  onSave: (value: string) => void;
  onClose: () => void;
}

/**
 * Markdown note editor. A right-side drawer on desktop, a full-screen sheet on
 * phones. Plain-text markdown editing with an Edit ⇄ Preview toggle; the draft
 * is committed on blur, when switching to preview, and on close, so the whole
 * editing session lands as one undo step.
 */
export default function NotesPanel({
  open,
  title,
  kindLabel,
  value,
  onSave,
  onClose,
}: NotesPanelProps) {
  const [draft, setDraft] = useState(value);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  // Load the note's text whenever a different note is opened.
  useEffect(() => {
    if (open) {
      setDraft(value);
      setMode("edit");
    }
  }, [open, value]);

  if (!open) return null;

  const commit = () => {
    if (draft !== value) onSave(draft);
  };
  const close = () => {
    commit();
    onClose();
  };
  const showPreview = () => {
    commit();
    setMode("preview");
  };

  const tab = (active: boolean) =>
    [
      "px-3 py-1 text-xs font-medium",
      active
        ? "bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
        : "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800",
    ].join(" ");

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/30" onClick={close} />
      <aside className="anim-slide-in absolute inset-y-0 right-0 flex h-full w-full flex-col bg-white shadow-xl dark:bg-neutral-900 sm:w-[28rem]">
        <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {kindLabel}
            </p>
            <h2 className="truncate text-sm font-semibold">{title || "Untitled"}</h2>
          </div>
          <div className="flex overflow-hidden rounded border border-neutral-300 dark:border-neutral-700">
            <button type="button" onClick={() => setMode("edit")} className={tab(mode === "edit")}>
              Edit
            </button>
            <button type="button" onClick={showPreview} className={tab(mode === "preview")}>
              Preview
            </button>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Close notes"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        {mode === "edit" ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            placeholder="Write a note… Markdown supported (# heading, **bold**, - lists, [ ] tasks, `code`)."
            className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
          />
        ) : draft.trim() ? (
          <div
            className="notes-prose flex-1 overflow-auto p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }}
          />
        ) : (
          <div className="flex-1 p-4 text-sm text-neutral-400 dark:text-neutral-600">
            Nothing to preview yet.
          </div>
        )}
      </aside>
    </div>
  );
}
