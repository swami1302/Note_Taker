"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import {
  ArrowRight,
  Check,
  CheckSquare,
  GripVertical,
  Lock,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes, useSoftDeleteNote, useBulkDeleteNotes, useTrash } from "@/lib/notes";
import { useConfirmStore } from "@/stores/confirm-store";
import { ThemeToggle } from "@/components/theme-toggle";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HomePage() {
  const { data: notes, isLoading, isError, error } = useNotes();
  const { data: trashNotes } = useTrash();
  const softDelete = useSoftDeleteNote();
  const bulkDelete = useBulkDeleteNotes();
  const confirm = useConfirmStore((s) => s.confirm);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderedNotes, setOrderedNotes] = useState<NonNullable<typeof notes>>([]);

  useEffect(() => {
    if (notes) {
      try {
        const savedOrder = localStorage.getItem("note-order");
        if (savedOrder) {
          const orderIds = JSON.parse(savedOrder) as string[];
          const sorted = [...notes].sort((a, b) => {
            const indexA = orderIds.indexOf(a.id);
            const indexB = orderIds.indexOf(b.id);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return 1;
            if (indexB !== -1) return -1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          setOrderedNotes(sorted);
        } else {
          setOrderedNotes(notes);
        }
      } catch {
        setOrderedNotes(notes);
      }
    } else {
      setOrderedNotes([]);
    }
  }, [notes]);

  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDraggedOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggedOverIndex(null);
    setDragActiveId(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !orderedNotes) return;

    const list = [...orderedNotes];
    const draggedItem = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);

    setOrderedNotes(list);

    const orderIds = list.map((n) => n.id);
    localStorage.setItem("note-order", JSON.stringify(orderIds));

    setDraggedIndex(null);
    setDraggedOverIndex(null);
    setDragActiveId(null);
  };

  const toggleSelect = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const selectAll = useCallback(() => {
    if (!orderedNotes) return;
    setSelected(new Set(orderedNotes.map((n) => n.id)));
  }, [orderedNotes]);

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  function handleDeleteOne(id: string, title: string) {
    confirm({
      title: "Move to trash?",
      description: `"${title || "Untitled"}" will be moved to trash. You can restore it within 30 days.`,
      confirmText: "Move to trash",
      onConfirm: async () => {
        try {
          await softDelete.mutateAsync(id);
          toast.success("Note moved to trash");
        } catch (err) {
          toast.error((err as Error).message);
        }
      },
    });
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    confirm({
      title: `Move ${selected.size} note${selected.size === 1 ? "" : "s"} to trash?`,
      description:
        "These notes will be moved to trash. You can restore them within 30 days.",
      confirmText: "Move to trash",
      onConfirm: async () => {
        try {
          await bulkDelete.mutateAsync([...selected]);
          toast.success(`${selected.size} note(s) moved to trash`);
          exitSelection();
        } catch (err) {
          toast.error((err as Error).message);
        }
      },
    });
  }

  const trashCount = trashNotes?.length ?? 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-12">
      {/* ─── Header ─── */}
      <header className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notes
              ? `${notes.length} note${notes.length === 1 ? "" : "s"}`
              : "…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/trash"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Trash2 className="size-4" />
            Trash
            {trashCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {trashCount}
              </Badge>
            )}
          </Link>
          {notes && notes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
            >
              {selecting ? (
                <>
                  <X className="size-4" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare className="size-4" />
                  Select
                </>
              )}
            </Button>
          )}
          <Link href="/editor/new" className={buttonVariants()}>
            <Plus className="size-4" />
            New note
          </Link>
        </div>
      </header>

      {/* ─── Error state ─── */}
      {isError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Couldn't load notes: {error.message}</p>
          <p className="mt-1 text-destructive/80">
            Is the backend running on <code>http://localhost:3001</code>?
          </p>
        </Card>
      )}

      {/* ─── Loading state ─── */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[70px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!isLoading && !isError && notes?.length === 0 && (
        <Card className="flex flex-col items-center gap-4 border-dashed py-16 text-center">
          <p className="text-muted-foreground">No notes yet.</p>
          <Link href="/editor/new" className={buttonVariants()}>
            <Plus className="size-4" />
            Create your first note
          </Link>
        </Card>
      )}

      {/* ─── Select-all bar ─── */}
      {selecting && notes && notes.length > 0 && (
        <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select all
          </Button>
          {selected.size > 0 && (
            <span>
              {selected.size} of {notes.length} selected
            </span>
          )}
        </div>
      )}

      {/* ─── Notes list ─── */}
      {!isError && orderedNotes && orderedNotes.length > 0 && (
        <ul className="space-y-3">
          {orderedNotes.map((note, index) => {
            const isSelected = selected.has(note.id);
            return (
              <li key={note.id} className="relative">
                {/* Drag insertion indicator line */}
                {draggedOverIndex === index && (
                  <div
                    className={`absolute left-0 right-0 h-[2px] bg-primary z-20 pointer-events-none ${
                      draggedIndex !== null && draggedIndex < index ? "bottom-[-7px]" : "top-[-7px]"
                    }`}
                  />
                )}
                {selecting ? (
                  /* ── Selection mode: click toggles selection ── */
                  <button
                    type="button"
                    onClick={() => toggleSelect(note.id)}
                    className="group block w-full text-left"
                  >
                    <Card
                      className={`flex flex-row items-center gap-3 px-4 py-3.5 transition ${
                        isSelected
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "group-hover:border-foreground/20 group-hover:shadow-sm"
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded border transition ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <Check className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {note.title || "Untitled"}
                          </span>
                          {note.locked && (
                            <Badge variant="secondary" className="gap-1">
                              <Lock className="size-3" />
                              Locked
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(note.updatedAt)}
                        </div>
                      </div>
                    </Card>
                  </button>
                ) : (
                  /* ── Normal mode: clickable card with drag handle & delete ── */
                  <div
                    className={`group relative transition-all duration-200 ${
                      draggedIndex === index ? "opacity-30 scale-[0.99]" : ""
                    }`}
                    draggable={dragActiveId === note.id && !selecting}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <Card className="flex flex-row items-center justify-between gap-3 px-4 py-3.5 transition group-hover:border-foreground/20 group-hover:shadow-sm">
                      {/* Drag Handle */}
                      {!selecting && (
                        <div
                          onMouseDown={() => setDragActiveId(note.id)}
                          onMouseUp={() => setDragActiveId(null)}
                          onMouseLeave={() => setDragActiveId(null)}
                          className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground/75 active:cursor-grabbing p-1 -ml-2 select-none relative z-10"
                          title="Drag to reorder"
                        >
                          <GripVertical className="size-4" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/editor/${note.id}`}
                          className="focus:outline-none"
                        >
                          {/* Pseudo-element to make the entire card clickable (except drag handle and delete) */}
                          <span className="absolute inset-0 rounded-xl" aria-hidden="true" />
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {note.title || "Untitled"}
                            </span>
                            {note.locked && (
                              <Badge variant="secondary" className="relative z-10 gap-1">
                                <Lock className="size-3" />
                                Locked
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(note.updatedAt)}
                          </div>
                        </Link>
                      </div>

                      <div className="relative z-10 flex shrink-0 items-center gap-2">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground transition group-hover:text-foreground">
                          {note.locked ? "View" : "Edit"}
                          <ArrowRight className="size-4" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteOne(note.id, note.title);
                          }}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Move "${note.title || "Untitled"}" to trash`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </Card>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ─── Bulk action bar (fixed at bottom) ─── */}
      {selecting && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
            <span className="text-sm font-medium">
              {selected.size} note{selected.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exitSelection}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
              >
                <Trash2 className="size-4" />
                {bulkDelete.isPending
                  ? "Deleting…"
                  : `Move to trash (${selected.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
