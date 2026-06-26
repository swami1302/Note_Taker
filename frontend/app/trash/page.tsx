"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Clock,
  RotateCcw,
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
import {
  useTrash,
  useRestoreNote,
  useBulkRestoreNotes,
  usePermanentDeleteNote,
  useEmptyTrash,
} from "@/lib/notes";
import { useConfirmStore } from "@/stores/confirm-store";
import { ThemeToggle } from "@/components/theme-toggle";

const TRASH_RETENTION_DAYS = 30;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Returns days remaining before auto-purge. */
function daysRemaining(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const expiry = deleted + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

export default function TrashPage() {
  const { data: notes, isLoading, isError, error } = useTrash();
  const restoreNote = useRestoreNote();
  const bulkRestore = useBulkRestoreNotes();
  const permanentDelete = usePermanentDeleteNote();
  const emptyTrash = useEmptyTrash();
  const confirm = useConfirmStore((s) => s.confirm);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!notes) return;
    setSelected(new Set(notes.map((n) => n.id)));
  }, [notes]);

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  function handleRestore(id: string) {
    restoreNote.mutate(id, {
      onSuccess: () => toast.success("Note restored"),
      onError: (err) => toast.error(err.message),
    });
  }

  function handleBulkRestore() {
    if (selected.size === 0) return;
    bulkRestore.mutate([...selected], {
      onSuccess: ({ count }) => {
        toast.success(`${count} note(s) restored`);
        exitSelection();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handlePermanentDelete(id: string, title: string) {
    confirm({
      title: "Delete permanently?",
      description: `"${title || "Untitled"}" will be permanently deleted. This cannot be undone.`,
      confirmText: "Delete permanently",
      onConfirm: async () => {
        try {
          await permanentDelete.mutateAsync(id);
          toast.success("Note permanently deleted");
        } catch (err) {
          toast.error((err as Error).message);
        }
      },
    });
  }

  function handleEmptyTrash() {
    confirm({
      title: "Empty trash?",
      description:
        "All notes in the trash will be permanently deleted. This cannot be undone.",
      confirmText: "Empty trash",
      onConfirm: async () => {
        try {
          const { count } = await emptyTrash.mutateAsync();
          toast.success(`${count} note(s) permanently deleted`);
          exitSelection();
        } catch (err) {
          toast.error((err as Error).message);
        }
      },
    });
  }

  function handleBulkPermanentDelete() {
    if (selected.size === 0) return;
    confirm({
      title: `Delete ${selected.size} note${selected.size === 1 ? "" : "s"} permanently?`,
      description:
        "These notes will be permanently deleted. This cannot be undone.",
      confirmText: "Delete permanently",
      onConfirm: async () => {
        try {
          let deleted = 0;
          for (const id of selected) {
            await permanentDelete.mutateAsync(id);
            deleted++;
          }
          toast.success(`${deleted} note(s) permanently deleted`);
          exitSelection();
        } catch (err) {
          toast.error((err as Error).message);
        }
      },
    });
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-12">
      {/* ─── Header ─── */}
      <header className="mb-8 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link
              href="/"
              className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">Trash</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {notes
              ? notes.length === 0
                ? "Trash is empty"
                : `${notes.length} note${notes.length === 1 ? "" : "s"} · auto-deleted after 30 days`
              : "…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {notes && notes.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  selecting ? exitSelection() : setSelecting(true)
                }
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
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEmptyTrash}
                disabled={emptyTrash.isPending}
              >
                <Trash2 className="size-4" />
                {emptyTrash.isPending ? "Emptying…" : "Empty trash"}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ─── Error state ─── */}
      {isError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Couldn't load trash: {error.message}</p>
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
          <Trash2 className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Trash is empty.</p>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" />
            Back to notes
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

      {/* ─── Trash list ─── */}
      {!isError && notes && notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((note) => {
            const isSelected = selected.has(note.id);
            const days = daysRemaining(note.deletedAt);

            return (
              <li key={note.id}>
                {selecting ? (
                  /* ── Selection mode ── */
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
                        <span className="truncate font-medium">
                          {note.title || "Untitled"}
                        </span>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Deleted {formatDate(note.deletedAt)}</span>
                          <Badge
                            variant={days <= 5 ? "destructive" : "outline"}
                            className="gap-1 text-[10px]"
                          >
                            <Clock className="size-2.5" />
                            {days}d left
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </button>
                ) : (
                  /* ── Normal mode ── */
                  <Card className="flex flex-row items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <span className="truncate font-medium">
                        {note.title || "Untitled"}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Deleted {formatDate(note.deletedAt)}</span>
                        <Badge
                          variant={days <= 5 ? "destructive" : "outline"}
                          className="gap-1 text-[10px]"
                        >
                          <Clock className="size-2.5" />
                          {days}d left
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(note.id)}
                        disabled={restoreNote.isPending}
                      >
                        <RotateCcw className="size-3.5" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          handlePermanentDelete(note.id, note.title)
                        }
                        disabled={permanentDelete.isPending}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </Card>
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
                variant="outline"
                size="sm"
                onClick={handleBulkRestore}
                disabled={bulkRestore.isPending}
              >
                <RotateCcw className="size-4" />
                {bulkRestore.isPending
                  ? "Restoring…"
                  : `Restore (${selected.size})`}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkPermanentDelete}
                disabled={permanentDelete.isPending}
              >
                <Trash2 className="size-4" />
                {permanentDelete.isPending
                  ? "Deleting…"
                  : `Delete (${selected.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
