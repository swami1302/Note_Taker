# Note-Taker — agent quick context

Notion-style mini note-taker with a **permanent lock** feature. No auth.
Monorepo: `backend/` (NestJS API) + `frontend/` (Next.js app).

**📖 Full context, decisions, known issues & backlog: see [CONTEXT.md](./CONTEXT.md).**

## Must-knows before editing

- **Stack:** Next.js 16 + React 19 + BlockNote + shadcn (Base UI "Nova" preset) +
  Tailwind v4 + TanStack Query + axios + zod + zustand. Backend: NestJS 11 +
  Prisma 7 + Neon Postgres.
- **shadcn here is Base UI, NOT Radix** → no `<Button asChild>`. Use
  `buttonVariants()` on a `<Link>`, or Base UI's `render` prop.
- **Prisma 7** uses the `prisma-client` generator (output `src/generated/prisma`,
  `moduleFormat=cjs`). Import `PrismaClient` from the generated path, **not**
  `@prisma/client`. One `DATABASE_URL` (Neon pooled) serves both app + CLI;
  there is **no `DIRECT_URL`**. `prisma.config.ts` reads `DATABASE_URL`.
- **Lock is enforced server-side**: `PATCH /api/notes/:id` on a locked note → 409.
  Never weaken this to UI-only.
- **No autosave** by design — persists only on Save / Save & Lock. Editor state
  is local to `editor-screen.tsx`, initialised from the server once.
- Backend = port **3001** (routes under `/api`). Frontend = port **3000**, needs
  `NEXT_PUBLIC_API_URL=http://localhost:3001/api` in `.env.local`.

## Run

```bash
cd backend  && npm install && npm run start:dev   # http://localhost:3001/api
cd frontend && npm install && npm run dev          # http://localhost:3000
```
The Neon migration is already applied; only re-run `npm run prisma:migrate`
after a schema change.

## Conventions

- Validate API responses with the zod schemas in `lib/api.ts`; add new server
  state as TanStack Query hooks in `lib/notes.ts`.
- Keep scope to the four screens — no delete/trash/auth unless asked.
