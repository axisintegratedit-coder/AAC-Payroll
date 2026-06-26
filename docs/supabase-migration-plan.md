# AAC/Axis → Supabase Migration Plan

**Goal:** Move the **AAC/Axis** deployment entirely off Firebase (Database + Auth + Storage) onto **Supabase**, hosted on **Vercel**. The **`original`** deployment stays on Firebase, unchanged. The single codebase supports **both backends, selected at build time**.

**Status:** Plan — no code written yet. Review and approve before implementation.

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Scope | Replace Firebase **DB + Auth + Storage** for AAC |
| Targets | **AAC only**; `original` stays on Firebase |
| Data model | **JSONB mirror** of the Firestore document tree |
| Existing data | **Migrate** AAC Firestore data into Supabase (one-time script) |
| Supabase project | Already exists (URL + anon key available) |
| AAC hosting | **Move to Vercel** (off Firebase Hosting) |
| Passwords | Recreate users; **all AAC users reset password** on first login |
| Sequencing | Written plan first (this doc) |

---

## 2. Backend selection mechanism

Add `NEXT_PUBLIC_BACKEND` to the env files (`firebase` | `supabase`).
- `.env.original` → `NEXT_PUBLIC_BACKEND=firebase`
- `.env.aac` → `NEXT_PUBLIC_BACKEND=supabase` + Supabase URL/anon key

The app reads this var to pick the data/auth/storage implementation behind the **existing service-layer interface**. Page components do **not** change — they keep importing from `lib/firestore.ts` and the auth helpers.

> ⚠️ Project rule (`AGENTS.md`): this is a modified Next.js — read `node_modules/next/dist/docs/` before writing any code. Honor at implementation time.

---

## 3. Supabase schema (JSONB mirror)

Firestore tree `/organizations/{oid}/...` maps to generic tables:

```sql
-- single-object settings docs  (configDoc)
create table config (
  org_id text not null,
  key    text not null,
  data   jsonb not null,
  primary key (org_id, key)
);

-- { items: T[] } single-doc arrays  (dataDoc)
create table data_arrays (
  org_id text not null,
  key    text not null,
  data   jsonb not null,   -- the array itself
  primary key (org_id, key)
);

-- one row per collection item  (employees, payrollRecords, payrollRunApprovals, auditLogs, ...)
create table collections (
  org_id     text not null,
  collection text not null,
  id         text not null,
  data       jsonb not null,
  created_at timestamptz default now(),
  primary key (org_id, collection, id)
);
```

RLS: enable on all tables; policy = authenticated users only (tighten to org membership later). `auditLogs` ordering uses `created_at desc`.

This maps ~1:1 onto the existing functions, keeping the Supabase impl small.

---

## 4. Code changes

### Data layer
- **`lib/supabase.ts`** (new) — Supabase client init, mirrors `lib/firebase.ts`, with a `supabaseConfigured` guard.
- **`lib/data/firebase-impl.ts`** — current `firestore.ts` body moved here.
- **`lib/data/supabase-impl.ts`** (new) — same exported signatures, backed by the tables above.
- **`lib/firestore.ts`** — becomes a thin dispatcher selecting impl by `NEXT_PUBLIC_BACKEND`. **Same public API** so no page changes.

Functions to re-implement for Supabase (from current `firestore.ts`):
`getConfigItem`, `setConfigItem`, `removeConfigItem`, `getDataArray`, `setDataArray`, `getCollectionItems`, `setCollectionItems`, `upsertCollectionItem`, `deleteCollectionItem`, `logAudit`, `getAllAudits`, `updateAuditDetails`, `getAuditsByEntity`, `uploadBannerImage`, `deleteBannerImage`.
Preserve the `dispatch(key)` window-event reactivity pattern and the `COLLECTION_BACKED_*` key special-casing.

### Auth layer
Abstract these behind an auth interface with a Supabase Auth implementation:
- `lib/firebase.ts` (`auth`, `googleProvider`, `ensureSessionAuthPersistence`)
- `lib/adminAuth.ts`, `lib/authRoles.ts`
- `app/client-portal/lib/auth.ts`
- pages: `app/login/page.tsx`, `app/user-settings/page.tsx`, `app/client-portal/settings/page.tsx`, `app/components/SessionLifecycleManager.tsx`

Auth capabilities to cover: email+password sign-in, Google OAuth, password update, reauthenticate, `onAuthStateChanged` equivalent, `currentUser.uid/email/displayName`, session persistence, sign-out.

### Storage
`uploadBannerImage` / `deleteBannerImage` → Supabase Storage bucket `theme/organizations/{oid}/...`, returning public URL.

---

## 5. Data migration (one-time script)

Node script (run locally, not deployed):
1. Read all AAC Firestore docs under `/organizations/{oid}/` using existing Firebase creds.
2. Write into `config` / `data_arrays` / `collections` in the same shape via Supabase service-role key.
3. Verify counts per collection match.

Users: **not** migrated with passwords. Recreate AAC users in Supabase Auth (email only); all reset password on first login.

---

## 6. Hosting → Vercel

- New Vercel project pointing at this repo / `payroll-web-app-2`.
- Build: `next build`. **Note:** current `next.config.ts` sets `output: "export"` (static) for Firebase Hosting. Vercel can serve static export as-is, OR we drop `output: "export"` for the Vercel build to allow SSR. Decide at implementation — keep static export initially for minimal change.
- Env vars set in Vercel: `NEXT_PUBLIC_BACKEND=supabase`, Supabase URL/anon key (no Firebase vars).
- Custom domain re-pointed to Vercel (AAC users' URL).
- `original` continues via `deploy.sh original` → Firebase Hosting.

---

## 7. Risks & open items

- **Passwords**: accepted — all AAC users reset on first login.
- **Google OAuth**: must configure Google provider in Supabase Auth + authorized redirect URLs for the Vercel domain.
- **Static export vs SSR on Vercel**: confirm whether to keep `output: "export"`.
- **RLS**: start permissive (authenticated), tighten to org-scoped before production traffic.
- **`deploy.sh`**: AAC target no longer uses Firebase deploy; document the Vercel flow instead (keep `original` path intact).
- **Rollback**: keep Firebase AAC project intact until Supabase cutover is verified.

---

## 8. Suggested implementation order

1. ✅ **DONE** — Supabase schema + RLS in the existing project (`supabase/schema.sql`; project ref `pdqxxokcsyvuhwjlrcqa`, "Payroll System / Production").
2. ✅ **DONE (spike)** — `lib/supabase.ts` + `lib/data/supabase-impl.ts`; live round-trip ALL PASS across config / data_arrays / collections (write→read→delete→cleanup). `.env.aac` has `NEXT_PUBLIC_BACKEND=supabase` + Supabase URL/anon key. **Still TODO in this file:** the dispatcher in `lib/firestore.ts`, and stubbed functions (audit log, banner storage, `COLLECTION_BACKED_*` special-casing for `payrollRunApprovals`/`homeAnnouncements`/etc.).
3. Auth abstraction + Supabase Auth impl.
4. Storage impl.
5. Data migration script; run against AAC.
6. Vercel project + env + domain.
7. End-to-end test on Vercel preview; recreate users; cutover.
