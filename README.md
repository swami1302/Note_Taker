# 📝 Mini Note-Taker (Notion-style)

A minimal Notion-style note taker with a **lock** feature — notes can be saved
and then *permanently* locked into a read-only state.

| Layer    | Stack |
|----------|-------|
| Frontend | Next.js 16 (App Router) · BlockNote (WYSIWYG) · shadcn/ui · Tailwind v4 · TanStack Query · axios · zod · zustand |
| Backend  | NestJS 11 · Prisma 7 (new `prisma-client` generator) |
| Database | Neon Postgres (via the `@prisma/adapter-neon` driver adapter) |

No authentication — open the app and start writing.

```
note-taker/
├── backend/    NestJS API  (port 3001, routes under /api)
└── frontend/   Next.js app (port 3000)
```

---

## 1. Backend setup

```bash
cd backend
npm install            # also runs `prisma generate`
```

### Add your Neon connection string

Edit `backend/.env` and set **one** Neon string (Neon Console → **Connect**).
In Prisma 7 the CLI and the app share a single `DATABASE_URL` — no `DIRECT_URL`
needed. The pooled string (host contains `-pooler`) works for both:

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
```

### Create the table & run

```bash
npm run prisma:migrate   # creates the `Note` table on Neon
npm run start:dev        # API on http://localhost:3001/api
```

(Optional) `npm run prisma:studio` to browse the data.

---

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev              # app on http://localhost:3000
```

`frontend/.env.local` already points at the backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Open **http://localhost:3000** 🎉

---

## API contract

| Method | Route             | Purpose |
|--------|-------------------|---------|
| `GET`  | `/api/notes`      | List notes (id, title, locked, dates — no body) |
| `GET`  | `/api/notes/:id`  | Full note incl. content |
| `POST` | `/api/notes`      | Create. Accepts `{ title, content, locked? }` — `locked:true` does new-note **Save & Lock** in one call |
| `PATCH`| `/api/notes/:id`  | Save edits. **Rejected with `409` if the note is locked** |
| `POST` | `/api/notes/:id/lock` | Save (optional) + permanently lock |

The note body is stored as **JSON** (the BlockNote document) in a Postgres
`jsonb` column.

### Why lock is enforced on the server

Hiding the "Edit" button is only UX. The **backend** is the source of truth:
any `PATCH` to a locked note returns `409 Conflict`, so a locked note can never
be modified — even via a direct API call.

---

## Screens

1. **Landing** (`/`) — auto-loads all notes with date + lock status. "New note"
   opens an empty editor. Unlocked notes show **Edit**, locked notes show
   **View** (read-only).
2. **Editor — new / unlocked** (`/editor/new`, `/editor/:id`) — title field +
   WYSIWYG body, with **Save**, **Cancel**, and **Save & Lock** (confirms first).
3. **Editor — locked** (`/editor/:id`) — read-only title + body and a **Back**
   button only.

---

## Notes for reviewers

Verified end-to-end against a live Neon database: migration applied; create →
list → get → edit → **Save & Lock** all persist; editing a locked note is
rejected with `409`; and in the browser a note's rich-text body round-trips
(saved to Postgres `jsonb` and rehydrated back into the editor on reopen).
