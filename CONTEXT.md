# 📝 Note-Taker — Project Context & Handoff

> A single source of truth for understanding this project: what it is, how it's
> built, what's been verified, what's known-broken, and what to improve next.
> Last updated: 2026-06-25.

---

## 1. What this is

A **Notion-style mini note-taker** with one distinguishing feature: notes can be
**permanently locked** into a read-only state. No authentication — open the app
and write.

Requirements it implements:
1. **Landing page** — auto-loads all notes with date + locked/unlocked status.
   "New" opens an empty editor. Unlocked notes show **Edit**; locked notes show
   a read-only **View**.
2. **Editor (new / unlocked)** — WYSIWYG body + title field, with **Save**,
   **Cancel**, and **Save & Lock** (locks permanently).
3. **Editor (locked)** — read-only title + body, only a **Back** button.

---

## 2. Tech stack (actual installed versions)

| Layer    | Tech | Version |
|----------|------|---------|
| Frontend | Next.js (App Router, Turbopack) | 16.2.9 |
|          | React | 19.2.4 |
|          | BlockNote (WYSIWYG) | 0.51.4 |
|          | shadcn/ui (**Base UI** "Nova" preset, **not** Radix) | — |
|          | Tailwind CSS | v4 (CSS-config, no `tailwind.config.js`) |
|          | TanStack Query | 5.x |
|          | axios · zod · zustand | 1.x · 4.x · 5.x |
| Backend  | NestJS | 11 |
|          | Prisma ORM (`prisma-client` generator) | 7.8.0 |
|          | `@prisma/adapter-neon` | 7.8.0 |
| Database | Neon Postgres (serverless) | — |
| Runtime  | Node | v25 (works; Next officially supports v20.19+/v22.12+/v24+) |

---

## 3. Folder layout

```
note-taker/
├── backend/                      NestJS API — port 3001, routes under /api
│   ├── prisma/
│   │   ├── schema.prisma         Note model + prisma-client generator
│   │   └── migrations/           init migration (already applied to Neon)
│   ├── prisma.config.ts          Prisma 7 CLI config → reads DATABASE_URL
│   ├── src/
│   │   ├── main.ts               bootstrap: CORS, ValidationPipe, /api prefix
│   │   ├── app.module.ts
│   │   ├── prisma/               PrismaService (extends PrismaClient + Neon adapter)
│   │   ├── notes/                controller · service · module · dto/
│   │   └── generated/prisma/     ⚙️ generated Prisma client (gitignored)
│   └── .env                      DATABASE_URL (Neon), PORT, FRONTEND_URL
└── frontend/                     Next.js app — port 3000
    ├── app/
    │   ├── layout.tsx            wraps app in <Providers>
    │   ├── providers.tsx         QueryClientProvider + ConfirmDialog + Toaster
    │   ├── page.tsx              landing (useNotes) + bulk select + delete
    │   ├── trash/page.tsx        trash bin — restore, permanent delete, empty
    │   ├── editor/new/page.tsx
    │   └── editor/[id]/page.tsx  keyed by id; async params
    ├── components/
    │   ├── editor-screen.tsx     loads note, owns title/content state, save logic
    │   ├── note-editor.tsx       BlockNote wrapper (client-only, dynamic ssr:false)
    │   ├── confirm-dialog.tsx    global confirm dialog (driven by zustand)
    │   └── ui/                   shadcn components
    ├── lib/
    │   ├── api.ts                axios client + zod schemas + notesApi (incl. trash)
    │   └── notes.ts              TanStack Query hooks (active + trash mutations)
    ├── stores/confirm-store.ts   zustand store for the confirm dialog
    └── .env.local               NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 4. Data model

```prisma
model Note {
  id        String   @id @default(cuid())
  title     String   @default("Untitled")
  content   Json      // BlockNote document = array of block objects (jsonb)
  locked    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([updatedAt])
}
```

- **Content is stored as JSON** (the BlockNote document), not HTML — safe from
  XSS, round-trips perfectly into the editor, queryable later.
- `content` has no DB default; the service defaults it to `[]` on create.

---

## 5. API contract (base: `http://localhost:3001/api`)

| Method | Route             | Body | Behaviour |
|--------|-------------------|------|-----------|
| `GET`  | `/notes`          | —    | List (id, title, locked, dates — **no body**) |
| `GET`  | `/notes/trash`    | —    | List trashed notes (same fields + `deletedAt`) |
| `GET`  | `/notes/:id`      | —    | Full note incl. `content` |
| `POST` | `/notes`          | `{ title?, content?, locked? }` | Create. `locked:true` = new-note **Save & Lock** in one call |
| `PATCH`| `/notes/:id`      | `{ title?, content? }` | Save edits. **`409 Conflict` if the note is locked** |
| `POST` | `/notes/:id/lock` | `{ title?, content? }` | Save (optional) then permanently lock |
| `DELETE`| `/notes/:id`     | —    | **Soft-delete** (move to trash) |
| `POST` | `/notes/bulk-delete`  | `{ ids }` | Bulk soft-delete |
| `POST` | `/notes/:id/restore`  | —    | Restore from trash |
| `POST` | `/notes/bulk-restore` | `{ ids }` | Bulk restore |
| `DELETE`| `/notes/:id/permanent`| —    | Permanently delete (from trash only) |
| `DELETE`| `/notes/trash/empty`  | —    | Permanently delete all trashed notes |

### Key invariant — lock is enforced server-side
Hiding the "Edit" button is only UX. `NotesService.update()` re-reads the note
and throws `ConflictException` (409) if `locked` is true, so a locked note can
**never** be modified — even via a direct API call. Verified with curl.

### Soft-delete / Trash bin
Notes are **soft-deleted** via a `deletedAt` timestamp. All active-note queries
filter by `deletedAt: null`, so trashed notes are invisible to normal CRUD.
Trashed notes are **auto-purged after 30 days** by a `setInterval` job that runs
every hour in `NotesService.onModuleInit()`. The frontend shows a "days remaining"
countdown on each trashed note. Both individual and bulk delete/restore are supported.

---

## 6. Frontend data flow

- **Server state** lives in **TanStack Query** (`lib/notes.ts`): `useNotes`,
  `useNote(id)`, and `useCreateNote / useUpdateNote / useLockNote` mutations that
  invalidate the relevant query keys on success.
- **HTTP** goes through an **axios** instance (`lib/api.ts`) whose response
  interceptor normalises NestJS error bodies (`{ message }`) into clean `Error`s
  with a `.status`. Responses are validated with **zod** schemas.
- **Editor state** (title + in-progress content) is **local** to
  `editor-screen.tsx`. Content is held in a `useRef` and updated via BlockNote's
  `onChange` (no re-render per keystroke). It is initialised from the server
  **exactly once** (guarded by `initializedRef`) so a background refetch can't
  wipe in-progress typing; `<EditorScreen key={id}>` gives each note fresh state.
- **Confirm dialog** for "Save & Lock" is a single app-wide shadcn `Dialog`
  driven by a **zustand** store (`stores/confirm-store.ts`) — any component can
  call `confirm({...})`.
- **Toasts** via sonner on save/error.

---

## 7. Important design decisions (and why)

- **Prisma 7 `prisma-client` generator** (not the deprecated `prisma-client-js`).
  Configured for NestJS's CommonJS build: `moduleFormat="cjs"`,
  `runtime="nodejs"`, `importFileExtension=""`, output to `src/generated/prisma`,
  imported from the generated path (**not** `@prisma/client`).
- **Single `DATABASE_URL`.** Prisma 7 has no `directUrl` in the schema; the CLI
  reads one `url` from `prisma.config.ts`. The pooled Neon string works for both
  the app (via `@prisma/adapter-neon`) and `prisma migrate` — verified.
- **`prisma.config.ts` excluded from the Nest build** (`tsconfig.build.json`) so
  the compiler root stays `src/` and output lands at `dist/main.js`.
- **shadcn Nova preset uses Base UI**, so `<Button asChild>` does **not** exist —
  link-styled buttons use `buttonVariants()` on a `<Link>`, and composition uses
  Base UI's `render` prop, not Radix's `asChild`.
- **No autosave** — there is an explicit Cancel, so edits persist only on
  Save / Save & Lock (per the requirements).

---

## 8. Status — what's verified ✅

Verified **end-to-end against the live Neon database**:
- Migration applied; table created.
- Create → List → Get.
- Edit an unlocked note (persists; `updatedAt` advances).
- **Save & Lock** (`locked:true`).
- Editing a locked note → **`409`** (server-side enforcement).
- **In-browser round-trip**: typed a title + rich-text body, saved to Postgres
  `jsonb`, reopened the note, and the content **rehydrated** correctly.
- Locked note renders read-only (only a Back button).
- Both apps install, type-check, and `build` cleanly.

---

## 9. Known issues / caveats ⚠️

1. **`lib/api.ts`** — the `console.log(baseURL)` was removed and a fallback
   `?? "http://localhost:3001/api"` is now in place.
2. **"Auto-saves and exits while typing"** — *not reproduced.* There is no
   autosave/save-on-blur/save-on-keystroke anywhere; dozens of simulated
   keystrokes never saved or navigated. Returning to the list **after clicking
   Save** is intended. If a genuine unexpected navigation persists, capture exact
   repro steps (every keystroke? after a pause? new vs existing note? Enter
   pressed?) to pin the cause.
3. **BlockNote placeholder** previously read "Enter text or type '/' for
   commands" and looked like auto-typed text — **fixed** to "Start writing…".
4. **No auth** — by design.
6. **Dev StrictMode** double-mounts components in `next dev`; harmless here but
   can make BlockNote log once on mount. Production build is unaffected.
7. **Migrating over the Neon pooled host** works for this simple schema; for
   heavier migrations Neon recommends the direct (non-`-pooler`) host. Swap the
   `DATABASE_URL` host if a migration ever hangs.
8. **Accessibility nit**: the title `<input>` has no `id`/`name` (browser console
   logs a minor warning). Add them for cleanliness/forms.

---

## 10. Improvement backlog 🔭

**Robustness / UX**
- Optimistic updates on mutations (snappier save).
- A React error boundary + a not-found UI for `/editor/[id]`.
- A short "unsaved changes?" guard on Cancel/Back if the note is dirty.
- Draft autosave to `localStorage` (without server autosave) to survive refresh.
- Content **preview snippet** + relative time on landing cards.
- Search / filter on the landing page.

**Product**
- ~~Soft-delete / trash + restore~~ — **done** (30-day trash bin with auto-purge).
- Note duplication; "unlock" via an explicit confirm (if ever desired).
- Dark mode toggle (tokens already exist via the `.dark` class).

**Quality / ops**
- Tests: e2e (Playwright) for create→lock→409; unit tests for `NotesService`.
- Remove the `console.log` and restore the API base-URL fallback.
- Add `@nestjs/swagger` for an OpenAPI doc of the contract.
- Deploy: frontend on Vercel, backend on a Node host; set `FRONTEND_URL` and
  `NEXT_PUBLIC_API_URL` for the deployed origins; add `prisma generate` to the
  backend `postinstall` (already present).

---

## 11. Run it

```bash
# Backend (migration already applied; only needed again if the schema changes)
cd backend
npm install
npm run start:dev          # http://localhost:3001/api

# Frontend
cd ../frontend
npm install
npm run dev                # http://localhost:3000
```

`backend/.env` needs one `DATABASE_URL` (Neon pooled string).
`frontend/.env.local` needs `NEXT_PUBLIC_API_URL=http://localhost:3001/api`.
