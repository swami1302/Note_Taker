"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notesApi, type NoteInput } from "./api";

export const noteKeys = {
  all: ["notes"] as const,
  detail: (id: string) => ["notes", id] as const,
  trash: ["notes", "trash"] as const,
};

// ─── Active notes ────────────────────────────────────────────────

export function useNotes() {
  return useQuery({
    queryKey: noteKeys.all,
    queryFn: notesApi.list,
  });
}

export function useNote(id?: string) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ""),
    queryFn: () => notesApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInput & { locked?: boolean }) =>
      notesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useUpdateNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInput) => notesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: noteKeys.detail(id) });
    },
  });
}

export function useLockNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInput) => notesApi.lock(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: noteKeys.detail(id) });
    },
  });
}

// ─── Trash / soft-delete ─────────────────────────────────────────

export function useTrash() {
  return useQuery({
    queryKey: noteKeys.trash,
    queryFn: notesApi.listTrash,
  });
}

export function useSoftDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.softDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: noteKeys.trash });
    },
  });
}

export function useBulkDeleteNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => notesApi.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: noteKeys.trash });
    },
  });
}

export function useRestoreNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: noteKeys.trash });
    },
  });
}

export function useBulkRestoreNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => notesApi.bulkRestore(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: noteKeys.trash });
    },
  });
}

export function usePermanentDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.permanentDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.trash });
    },
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notesApi.emptyTrash(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.trash });
    },
  });
}
