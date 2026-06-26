# AAC → Supabase + Vercel — Cutover Runbook

The code migration is **complete and builds on both backends**. What remains are steps
that require your credentials / accounts. Do them in order.

## What's already done (in code)
- `lib/supabase.ts` — Supabase client
- `lib/data/supabase-impl.ts` — full data layer (config/data_arrays/collections, audit, storage, payrollRunApprovals special-casing)
- `lib/data/firebase-impl.ts` — the original Firestore code (moved, unchanged behavior)
- `lib/firestore.ts` — dispatcher, routes by `NEXT_PUBLIC_BACKEND`
- `lib/authClient.ts` — auth dispatcher (email, Google, password change, reset, session)
- All pages/libs updated to use `authClient` instead of `firebase/auth` directly
- `.env.aac` — has `NEXT_PUBLIC_BACKEND=supabase` + Supabase URL/anon key
- `supabase/schema.sql` — already run (tables live)
- `scripts/migrate-firestore-to-supabase.mjs` — ready to run
- `deploy.sh` — AAC target now deploys to Vercel; `original` stays on Firebase
- Verified: both `npm run build` variants succeed; Supabase URL+auth inlined into the AAC bundle.

---

## Step 1 — Create the Storage bucket (Supabase SQL editor)
Banner images need a public bucket named `theme`:

```sql
insert into storage.buckets (id, name, public)
values ('theme', 'theme', true)
on conflict (id) do nothing;

-- allow authenticated users to upload/replace; anyone to read (public bucket)
create policy "theme read"  on storage.objects for select to public        using (bucket_id = 'theme');
create policy "theme write" on storage.objects for all    to authenticated using (bucket_id = 'theme') with check (bucket_id = 'theme');
```

## Step 2 — Run the data migration
1. Firebase console → **aac-payroll-538f1** → Project settings → Service accounts →
   **Generate new private key**. Save the file as `aac-service-account.json` in
   `payroll-web-app-2/` (already gitignored).
2. Supabase dashboard → Project Settings → API → copy the **service_role** key.
3. Run a dry run, then the real migration:
   ```bash
   cd payroll-web-app-2
   SUPABASE_SERVICE_KEY=<service_role> node scripts/migrate-firestore-to-supabase.mjs --dry-run
   SUPABASE_SERVICE_KEY=<service_role> node scripts/migrate-firestore-to-supabase.mjs
   ```
4. The script prints the migrated `authorizedUsers` emails. **Passwords are NOT migrated.**

## Step 3 — Recreate users in Supabase Auth
For each authorized user email printed in Step 2:
- Supabase dashboard → Authentication → Users → **Add user** (or invite).
- Everyone resets their password on first login (use "Forgot password" → email reset).
- **Important:** the user's `id` (uid) in Supabase will differ from the old Firebase uid.
  The app gates access by **email** (see `getAuthorizedUserByEmail`), so this is fine —
  but audit-trail rows that stored the old Firebase uid in `performedBy` won't resolve to
  a name. Acceptable; new audits use the Supabase uid.

## Step 4 — Configure Google sign-in (if used)
- Supabase dashboard → Authentication → Providers → **Google** → enable, add Google OAuth
  client ID/secret.
- Add the Vercel domain to **Authorized redirect URLs** (and `…/login`).

## Step 5 — Deploy to Vercel
1. `npm i -g vercel` then `vercel login`.
2. From `payroll-web-app-2/`: `vercel link` (create/select the AAC project).
3. In the Vercel project **Settings → Environment Variables**, add (Production):
   - `NEXT_PUBLIC_BACKEND=supabase`
   - `NEXT_PUBLIC_SUPABASE_URL=https://pdqxxokcsyvuhwjlrcqa.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
   - the `NEXT_PUBLIC_OWNER_EMAIL` / `BACKUP_RECOVERY_EMAIL` / `SUPPORT_ADMIN_EMAIL` from `.env.aac`
4. Deploy: `./deploy.sh aac` (runs a local pre-flight build, then `vercel --prod`).
5. Point the AAC custom domain at Vercel (Vercel project → Domains).

## Step 6 — Verify, then retire Firebase for AAC
- Log in on the Vercel URL, confirm data loaded, create/edit an employee, check audit trail, upload a banner.
- Once verified, the AAC Firebase project can be left dormant (keep as rollback for a while).
- `original` is untouched: `./deploy.sh original` still builds Firebase and deploys to Firebase Hosting.

## Rollback
- `.env.aac` → set `NEXT_PUBLIC_BACKEND=firebase` (and keep Firebase vars) → rebuild/redeploy to fall back to Firestore.
