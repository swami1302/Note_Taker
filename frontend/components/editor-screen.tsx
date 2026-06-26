"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Block } from "@blocknote/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteBlock } from "@/lib/api";
import { useCreateNote, useLockNote, useNote, useSoftDeleteNote, useUpdateNote } from "@/lib/notes";
import { useConfirmStore } from "@/stores/confirm-store";
import { ThemeToggle } from "@/components/theme-toggle";

// BlockNote is client-only.
const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

export default function EditorScreen({ noteId }: { noteId?: string }) {
  const router = useRouter();
  const isNew = !noteId;

  const { data: note, isLoading, isError, error } = useNote(noteId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote(noteId ?? "");
  const lockNote = useLockNote(noteId ?? "");
  const softDelete = useSoftDeleteNote();
  const confirm = useConfirmStore((s) => s.confirm);

  const [title, setTitle] = useState("");
  const [hydrated, setHydrated] = useState(isNew);
  const contentRef = useRef<NoteBlock[]>([]);
  const initializedRef = useRef(false);

  // Populate local state from the server EXACTLY ONCE. A later background
  // refetch must never overwrite what the user is currently typing.
  useEffect(() => {
    if (note && !initializedRef.current) {
      initializedRef.current = true;
      setTitle(note.title);
      contentRef.current = (note.content ?? []) as NoteBlock[];
      setHydrated(true);
    }
  }, [note]);

  const locked = note?.locked ?? false;
  const saving =
    createNote.isPending || updateNote.isPending || lockNote.isPending;

  const goHome = () => router.push("/");

  async function persist(lock: boolean) {
    const payload = {
      title: title.trim() || "Untitled",
      content: contentRef.current,
    };
    try {
      if (isNew) {
        await createNote.mutateAsync({ ...payload, locked: lock });
      } else if (lock) {
        await lockNote.mutateAsync(payload);
      } else {
        await updateNote.mutateAsync(payload);
      }
      toast.success(lock ? "Note saved & locked" : "Note saved");
      goHome();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleSaveAndLock() {
    confirm({
      title: "Lock this note?",
      description:
        "Saving & locking is permanent — the note can never be edited again.",
      confirmText: "Save & Lock",
      onConfirm: () => persist(true),
    });
  }

  function handleDelete() {
    if (isNew) return;
    confirm({
      title: "Move to trash?",
      description:
        "This note will be moved to trash. You can restore it within 30 days.",
      confirmText: "Move to trash",
      onConfirm: async () => {
        try {
          await softDelete.mutateAsync(noteId!);
          toast.success("Note moved to trash");
          goHome();
        } catch (err) {
          toast.error((err as Error).message);
        }
      },
    });
  }

  // ---- Loading / error states (existing notes) ----
  if (!isNew && isLoading) {
    return (
      <Shell>
        <Skeleton className="mb-6 h-9 w-40" />
        <Skeleton className="mb-3 h-12 w-2/3" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Shell>
    );
  }

  if (isError) {
    const notFound = (error as { status?: number })?.status === 404;
    return (
      <Shell className="items-center justify-center text-center">
        <p className="mb-4 text-muted-foreground">
          {notFound
            ? "This note doesn’t exist (it may have been removed)."
            : (error as Error).message}
        </p>
        <Button onClick={goHome} variant="outline">
          <ArrowLeft className="size-4" />
          Back to notes
        </Button>
      </Shell>
    );
  }

  // ---- Locked: read-only view ----
  if (locked) {
    return (
      <Shell>
        <div className="mb-6 flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            Locked · read-only
          </Badge>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              Trash
            </Button>
            <Button onClick={goHome} variant="ghost">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </div>

        <h1 className="note-title-static">{title || "Untitled"}</h1>

        <div className="note-body">
          {hydrated && (
            <NoteEditor
              initialContent={contentRef.current}
              editable={false}
            />
          )}
        </div>
      </Shell>
    );
  }

  // ---- New / unlocked: full editor ----
  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={goHome} variant="ghost" disabled={saving}>
            <ArrowLeft className="size-4" />
            Cancel
          </Button>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="size-4" />
              Trash
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={() => persist(false)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            onClick={handleSaveAndLock}
            disabled={saving}
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
          >
            <Lock className="size-4" />
            Save &amp; Lock
          </Button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="note-title-input"
        autoFocus={isNew}
      />

      <div className="note-body">
        {hydrated && (
          <NoteEditor
            initialContent={contentRef.current}
            editable
            onChange={(doc: Block[]) =>
              (contentRef.current = doc as unknown as NoteBlock[])
            }
          />
        )}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-10 ${className}`}
    >
      {children}
    </main>
  );
}
