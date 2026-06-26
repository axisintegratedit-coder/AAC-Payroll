# New Firebase Project Setup for AAC (fresh start, empty data)

The old AAC Firebase project (account closed) is gone. We're standing up a NEW Firebase
project under a working Google account. App stays Firebase-native (no Supabase needed) —
the existing dispatcher code defaults to Firebase, so nothing in the app changes except config.

10 employees will be re-entered by hand (no data migration).

---

## Step 1 — Create the project (Firebase console, YOU)
Log in with a **working** Google account at https://console.firebase.google.com

1. **Add project** → name e.g. `aac-payroll` → (Analytics optional) → Create.
2. **Firestore**: Build → Firestore Database → Create database → **production mode** → pick region (e.g. asia-southeast1) → Enable.
3. **Authentication**: Build → Authentication → Get started → Sign-in method →
   - Enable **Email/Password**
   - Enable **Google** (only if you use Google sign-in) — set a support email.
4. **Storage**: Build → Storage → Get started → (production mode) → Done.
5. **Register web app**: Project Overview → click the `</>` icon → register app
   (no need to set up hosting there) → copy the `firebaseConfig` object shown.

## Step 2 — Paste the config to me
Paste the whole `firebaseConfig` block. It looks like:
```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "aac-payroll-xxxxx.firebaseapp.com",
  projectId: "aac-payroll-xxxxx",
  storageBucket: "aac-payroll-xxxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```
I'll write these into `.env.aac` as the `NEXT_PUBLIC_FIREBASE_*` vars.

## Step 3 — Config files (ME)
- `.firebaserc` default project → new project id
- `firebase.json` hosting `site` → new hosting site id (you may need to create a Hosting
  site named to match, or we use the default site)
- add `storage.rules` + wire it in `firebase.json`

## Step 4 — Deploy rules (ME, needs you logged into firebase CLI)
`firebase login` (working account), then deploy Firestore + Storage rules to the new project.

## Step 5 — First admin user (so you can log in)
The app gates access via the `authorizedUsers` collection. On an empty project nobody can
log in yet. We will:
1. Authentication → Users → **Add user** → your admin email + a temp password.
2. Firestore → create collection `authorizedUsers` → add a doc:
   - `email`: your admin email
   - `role`: `"admin"`
   - `name`: your name
   - `status`: `"Approved"`
   (I'll give exact field values once I see your config / who the admin is.)

## Step 6 — Deploy + verify
- `./deploy.sh aac` → builds with the new `.env.aac`, deploys to the new project's Hosting.
- Log in, add one employee, confirm it saves and the audit trail records it.

## Notes
- `original` deployment is untouched.
- The Supabase code stays in the repo, dormant (defaults to Firebase). It's not used.
