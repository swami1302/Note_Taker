import axios from "axios";
import { z } from "zod";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export const http = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// Surface NestJS error messages (`{ message, statusCode }`) as clean Errors.
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    let message: string = error?.message ?? "Request failed";
    if (data?.message) {
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message;
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = error?.response?.status;
    return Promise.reject(err);
  },
);

// ---------- Schemas (zod) ----------
export const noteSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  locked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const noteSchema = noteSummarySchema.extend({
  content: z.array(z.unknown()).default([]),
});

export const trashNoteSummarySchema = noteSummarySchema.extend({
  deletedAt: z.string(),
});

export const bulkResultSchema = z.object({
  count: z.number(),
});

export type NoteSummary = z.infer<typeof noteSummarySchema>;
export type Note = z.infer<typeof noteSchema>;
export type TrashNoteSummary = z.infer<typeof trashNoteSummarySchema>;
export type NoteBlock = Record<string, unknown>;
export type NoteInput = { title: string; content: NoteBlock[] };

// ---------- API ----------
export const notesApi = {
  // ── Active notes ──
  list: async (): Promise<NoteSummary[]> => {
    const { data } = await http.get("/notes");
    return noteSummarySchema.array().parse(data);
  },
  get: async (id: string): Promise<Note> => {
    const { data } = await http.get(`/notes/${id}`);
    return noteSchema.parse(data);
  },
  create: async (input: NoteInput & { locked?: boolean }): Promise<Note> => {
    const { data } = await http.post("/notes", input);
    return noteSchema.parse(data);
  },
  update: async (id: string, input: NoteInput): Promise<Note> => {
    const { data } = await http.patch(`/notes/${id}`, input);
    return noteSchema.parse(data);
  },
  lock: async (id: string, input: NoteInput): Promise<Note> => {
    const { data } = await http.post(`/notes/${id}/lock`, input);
    return noteSchema.parse(data);
  },

  // ── Trash / soft-delete ──
  softDelete: async (id: string): Promise<Note> => {
    const { data } = await http.delete(`/notes/${id}`);
    return noteSchema.parse(data);
  },
  bulkDelete: async (ids: string[]): Promise<{ count: number }> => {
    const { data } = await http.post("/notes/bulk-delete", { ids });
    return bulkResultSchema.parse(data);
  },
  listTrash: async (): Promise<TrashNoteSummary[]> => {
    const { data } = await http.get("/notes/trash");
    return trashNoteSummarySchema.array().parse(data);
  },
  restore: async (id: string): Promise<Note> => {
    const { data } = await http.post(`/notes/${id}/restore`);
    return noteSchema.parse(data);
  },
  bulkRestore: async (ids: string[]): Promise<{ count: number }> => {
    const { data } = await http.post("/notes/bulk-restore", { ids });
    return bulkResultSchema.parse(data);
  },
  permanentDelete: async (id: string): Promise<{ deleted: boolean }> => {
    const { data } = await http.delete(`/notes/${id}/permanent`);
    return z.object({ deleted: z.boolean() }).parse(data);
  },
  emptyTrash: async (): Promise<{ count: number }> => {
    const { data } = await http.delete("/notes/trash/empty");
    return bulkResultSchema.parse(data);
  },
};
