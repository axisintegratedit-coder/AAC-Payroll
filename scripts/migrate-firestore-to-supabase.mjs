/**
 * One-time migration: AAC Firestore  →  Supabase (JSONB mirror).
 *
 * Reads everything under /organizations/{DEFAULT_ORG}/ in the AAC Firebase
 * project and writes it into the Supabase `config` / `data_arrays` / `collections`
 * tables in the same shape the app's supabase-impl expects.
 *
 * Also migrates the top-level `authorizedUsers` collection into
 * collections(collection='authorizedUsers') keyed by the doc id (the Firebase uid).
 *
 * Prerequisites:
 *   1. Download the AAC service-account key from Firebase console
 *      (Project settings → Service accounts → Generate new private key)
 *      and save it as:  aac-service-account.json  (gitignored)
 *   2. Set env vars (or rely on .env.aac for the Supabase URL):
 *        SUPABASE_URL          (defaults to .env.aac NEXT_PUBLIC_SUPABASE_URL)
 *        SUPABASE_SERVICE_KEY  (Supabase service_role key — bypasses RLS for the load)
 *
 * Run:
 *   SUPABASE_SERVICE_KEY=eyJ... node scripts/migrate-firestore-to-supabase.mjs
 *   add --dry-run to preview counts without writing.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

// The Supabase URL lives in the custom .env.aac (not auto-loaded by Next). Parse it.
function readEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}
const aacEnv = readEnvFile(".env.aac");

const DRY_RUN = process.argv.includes("--dry-run");
const ORG = "default-org";

// Firestore document tree the app uses (see lib/data/firebase-impl.ts):
//   organizations/{org}/settings/{key}   → config
//   organizations/{org}/data/{key}        → data_arrays (doc has { items: [...] })
//   organizations/{org}/{collection}/{id} → collections
// resolveCollectionName aliases (homeAnnouncements→announcements, etc.) are already
// applied in Firestore (data is stored under the resolved name), so we copy verbatim.
const KNOWN_COLLECTIONS = [
  "employees",
  "payrollRecords",
  "payrollRunApprovals",
  "auditTrail",
  "announcements",
  "holidays",
  "departments",
];

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || aacEnv.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. See header of this script.");
  process.exit(1);
}

// ── init Firebase Admin (reads everything, ignores security rules) ────────────
const serviceAccount = JSON.parse(readFileSync("aac-service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const fs = admin.firestore();

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

let totalConfig = 0, totalArrays = 0, totalItems = 0;

async function upsertRows(table, rows) {
  if (DRY_RUN || !rows.length) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const onConflict =
      table === "config" || table === "data_arrays" ? "org_id,key" : "org_id,collection,id";
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function migrateConfig() {
  const snap = await fs.collection(`organizations/${ORG}/settings`).get();
  const rows = snap.docs.map((d) => ({ org_id: ORG, key: d.id, data: d.data() }));
  totalConfig = rows.length;
  await upsertRows("config", rows);
  console.log(`config:       ${rows.length} docs`);
}

async function migrateDataArrays() {
  const snap = await fs.collection(`organizations/${ORG}/data`).get();
  const rows = snap.docs.map((d) => {
    const raw = d.data();
    // firebase-impl stores { items: T[] }; supabase-impl stores the array directly
    const arr = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    return { org_id: ORG, key: d.id, data: arr };
  });
  totalArrays = rows.length;
  await upsertRows("data_arrays", rows);
  console.log(`data_arrays:  ${rows.length} docs`);
}

async function migrateCollection(name) {
  const snap = await fs.collection(`organizations/${ORG}/${name}`).get();
  if (snap.empty) return 0;
  const rows = snap.docs.map((d) => ({ org_id: ORG, collection: name, id: d.id, data: d.data() }));
  await upsertRows("collections", rows);
  totalItems += rows.length;
  console.log(`collections/${name}: ${rows.length} items`);
  return rows.length;
}

async function migrateAuthorizedUsers() {
  const snap = await fs.collection("authorizedUsers").get();
  if (snap.empty) {
    console.log("authorizedUsers: 0 (none found)");
    return;
  }
  const rows = snap.docs.map((d) => ({
    org_id: ORG,
    collection: "authorizedUsers",
    id: d.id,
    data: d.data(),
  }));
  await upsertRows("collections", rows);
  totalItems += rows.length;
  console.log(`collections/authorizedUsers: ${rows.length} users`);
  console.log(
    "  → emails:",
    rows.map((r) => r.data.email).filter(Boolean).join(", ")
  );
}

async function main() {
  console.log(`\nMigrating AAC Firestore → Supabase  ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`  org: ${ORG}\n`);

  await migrateConfig();
  await migrateDataArrays();
  for (const c of KNOWN_COLLECTIONS) await migrateCollection(c);
  await migrateAuthorizedUsers();

  console.log(
    `\n${DRY_RUN ? "Would migrate" : "Migrated"}: ${totalConfig} config, ${totalArrays} arrays, ${totalItems} collection items.`
  );
  console.log(
    "\nNOTE: passwords are NOT migrated. Recreate AAC users in Supabase Auth; everyone resets password on first login."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
