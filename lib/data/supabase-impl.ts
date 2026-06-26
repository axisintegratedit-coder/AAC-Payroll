/**
 * Supabase data service — JSONB-mirror implementation of the data layer.
 *
 * Mirrors the public API of lib/data/firebase-impl.ts exactly so the dispatcher
 * (lib/firestore.ts) can swap backends by NEXT_PUBLIC_BACKEND with no page changes.
 *
 * Firestore tree /organizations/{oid}/... maps onto three generic Postgres tables:
 *   config        — single-object settings docs   (settings/{key})
 *   data_arrays   — { items: T[] } single docs     (data/{key}); stored as a JSON array
 *   collections   — one row per collection item    ({collection}/{id})
 */

import { supabase } from "../supabase";
import { getSupabaseUserId } from "../authClient";

// ─── Organization ID resolution ───────────────────────────────────────────────

export const DEFAULT_ORGANIZATION_ID = "default-org";

export function getOrganizationId(): string {
  return DEFAULT_ORGANIZATION_ID;
}

export function getCompanyId(): string {
  return getOrganizationId();
}

// ─── Key mapping (parity with firebase-impl COLLECTION_KEY_MAP) ───────────────

const COLLECTION_KEY_MAP: Record<string, string> = {
  homeAnnouncements: "announcements",
  homeCalendarEvents: "holidays",
  auditLogs: "auditTrail",
};

const COLLECTION_BACKED_ARRAY_KEYS = new Set([
  "homeAnnouncements",
  "homeCalendarEvents",
  "departments",
]);

const COLLECTION_BACKED_CONFIG_KEYS = new Set(["payrollRunApprovals"]);

function resolveCollectionName(name: string) {
  return COLLECTION_KEY_MAP[name] ?? name;
}

// ─── id resolution (parity with firebase-impl getItemId/toFirestoreItem) ──────

function getItemId(item: unknown, fallback: string): string {
  if (item && typeof item === "object") {
    const value = item as Record<string, unknown>;
    const id =
      value.id ??
      value.employeeNo ??
      value.approvalId ??
      value.payrollRecordId ??
      value.date ??
      value.name ??
      value.title;
    if (typeof id === "string" && id.trim()) return id.trim();
    if (typeof id === "number") return String(id);
  }
  if (typeof item === "string" && item.trim()) return item.trim();
  return fallback;
}

function toRow<T>(item: T, fallbackId: string): { id: string; data: Record<string, unknown> } {
  const id = getItemId(item, fallbackId);
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const { id: _id, ...data } = item as Record<string, unknown>;
    return { id, data };
  }
  return { id, data: { value: item } };
}

// ─── Dispatch helper (maintains existing reactivity pattern) ──────────────────

function dispatch(key: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(`${key}-updated`));
  }
}

// ─── Low-level collection helpers ─────────────────────────────────────────────

async function readCollection(collectionName: string): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const oid = getOrganizationId();
  const name = resolveCollectionName(collectionName);
  const { data, error } = await supabase
    .from("collections")
    .select("id, data, created_at")
    .eq("org_id", oid)
    .eq("collection", name)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, data: (r.data ?? {}) as Record<string, unknown> }));
}

/** Replace an entire collection with a new array (delete-all then insert). */
async function replaceCollection<T>(collectionName: string, items: T[]): Promise<void> {
  const oid = getOrganizationId();
  const name = resolveCollectionName(collectionName);

  await supabase.from("collections").delete().eq("org_id", oid).eq("collection", name);

  const rows = items.map((item, index) => {
    const { id, data } = toRow(item, `item-${index}`);
    return { org_id: oid, collection: name, id, data };
  });
  // de-dup by id (last wins) to avoid upsert conflicts within one batch
  const byId = new Map(rows.map((r) => [r.id, r]));
  const deduped = [...byId.values()];

  const CHUNK = 500;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    if (chunk.length) {
      await supabase.from("collections").upsert(chunk, { onConflict: "org_id,collection,id" });
    }
  }
  dispatch(collectionName);
}

// ─── COLLECTION_BACKED config (payrollRunApprovals) ───────────────────────────

async function getCollectionBackedConfig<T>(key: string, fallback: T): Promise<T> {
  if (key !== "payrollRunApprovals") return fallback;
  const rows = await readCollection(key);
  if (!rows.length) return fallback;
  return rows.reduce<Record<string, unknown>>((acc, row) => {
    if (row.id) acc[row.id] = row.data;
    return acc;
  }, {}) as T;
}

async function setCollectionBackedConfig<T extends object>(key: string, value: T): Promise<void> {
  if (key !== "payrollRunApprovals") return;
  const items = Object.entries(value as Record<string, unknown>).map(([id, data]) => {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return { id, ...(data as Record<string, unknown>) };
    }
    return { id, value: data };
  });
  await replaceCollection(key, items);
}

// ─── Config docs — single objects ────────────────────────────────────────────

export async function getConfigItem<T>(key: string, fallback: T): Promise<T> {
  if (COLLECTION_BACKED_CONFIG_KEYS.has(key)) {
    return getCollectionBackedConfig(key, fallback);
  }
  const oid = getOrganizationId();
  const { data, error } = await supabase
    .from("config")
    .select("data")
    .eq("org_id", oid)
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return data.data as T;
}

export async function setConfigItem<T extends object>(key: string, value: T): Promise<void> {
  if (COLLECTION_BACKED_CONFIG_KEYS.has(key)) {
    await setCollectionBackedConfig(key, value);
    dispatch(key);
    return;
  }
  const oid = getOrganizationId();
  await supabase.from("config").upsert({ org_id: oid, key, data: value }, { onConflict: "org_id,key" });
  dispatch(key);
}

export async function removeConfigItem(key: string): Promise<void> {
  const oid = getOrganizationId();
  await supabase.from("config").delete().eq("org_id", oid).eq("key", key);
  dispatch(key);
}

// ─── Data arrays — stored as a JSON array in data_arrays.data ─────────────────

export async function getDataArray<T>(key: string, fallback: T[]): Promise<T[]> {
  if (COLLECTION_BACKED_ARRAY_KEYS.has(key)) {
    const rows = await readCollection(key);
    if (!rows.length) return fallback;
    return rows.map((row) => {
      const d = row.data as Record<string, unknown>;
      if (d && typeof d === "object" && "value" in d) return d.value as T;
      return { id: row.id, ...d } as T;
    });
  }
  const oid = getOrganizationId();
  const { data, error } = await supabase
    .from("data_arrays")
    .select("data")
    .eq("org_id", oid)
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return (data.data ?? fallback) as T[];
}

export async function setDataArray<T>(key: string, items: T[]): Promise<void> {
  if (COLLECTION_BACKED_ARRAY_KEYS.has(key)) {
    await replaceCollection(key, items);
    return;
  }
  const oid = getOrganizationId();
  await supabase.from("data_arrays").upsert({ org_id: oid, key, data: items }, { onConflict: "org_id,key" });
  dispatch(key);
}

// ─── Collections — one row per item ──────────────────────────────────────────

export async function getCollectionItems<T>(collectionName: string): Promise<T[]> {
  const rows = await readCollection(collectionName);
  return rows.map((r) => ({ id: r.id, ...r.data } as T));
}

export async function setCollectionItems<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  await replaceCollection(collectionName, items);
}

export async function upsertCollectionItem<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  const oid = getOrganizationId();
  const name = resolveCollectionName(collectionName);
  const { id, ...data } = item;
  await supabase
    .from("collections")
    .upsert({ org_id: oid, collection: name, id, data }, { onConflict: "org_id,collection,id" });
  dispatch(collectionName);
}

export async function deleteCollectionItem(collectionName: string, id: string): Promise<void> {
  const oid = getOrganizationId();
  const name = resolveCollectionName(collectionName);
  await supabase
    .from("collections")
    .delete()
    .eq("org_id", oid)
    .eq("collection", name)
    .eq("id", id);
  dispatch(collectionName);
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export type AuditAction =
  | "CREATED"
  | "EDITED"
  | "ARCHIVED"
  | "DELETED"
  | "UNARCHIVED"
  | "EXPORTED"
  | "PRINTED"
  | "SAVED"
  | "RESTORED"
  | "SUBMITTED"
  | "CHECKED"
  | "APPROVED"
  | "RETURNED"
  | "DOWNLOADED";

export type AuditEntry = {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityName: string;
  performedBy: string;
  details?: string;
};

export async function logAudit(
  entry: Omit<AuditEntry, "id" | "timestamp" | "performedBy"> & { performedBy?: string }
): Promise<void> {
  const oid = getOrganizationId();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `audit-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const performedBy = entry.performedBy ?? getSupabaseUserId() ?? "unknown";
  const data = {
    timestamp: new Date().toISOString(),
    performedBy,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityName: entry.entityName,
    ...(entry.details !== undefined ? { details: entry.details } : {}),
  };
  try {
    await supabase
      .from("collections")
      .upsert({ org_id: oid, collection: "auditTrail", id, data }, { onConflict: "org_id,collection,id" });
  } catch {
    // audit logging must never break the main flow
  }
}

export async function getAllAudits(maxEntries = 5000): Promise<AuditEntry[]> {
  const oid = getOrganizationId();
  const { data, error } = await supabase
    .from("collections")
    .select("id, data")
    .eq("org_id", oid)
    .eq("collection", "auditTrail")
    .order("created_at", { ascending: false })
    .limit(maxEntries);
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, ...(r.data as object) } as AuditEntry));
}

export async function updateAuditDetails(id: string, details: string): Promise<void> {
  const oid = getOrganizationId();
  try {
    const { data } = await supabase
      .from("collections")
      .select("data")
      .eq("org_id", oid)
      .eq("collection", "auditTrail")
      .eq("id", id)
      .maybeSingle();
    const merged = { ...((data?.data as object) ?? {}), details: details.trim() || null };
    await supabase
      .from("collections")
      .upsert(
        { org_id: oid, collection: "auditTrail", id, data: merged },
        { onConflict: "org_id,collection,id" }
      );
  } catch {
    // ignore
  }
}

export async function getAuditsByEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
  const all = await getAllAudits();
  return all.filter((e) => e.entityType === entityType && e.entityId === entityId);
}

// ─── Banner image (Supabase Storage) ──────────────────────────────────────────

const BANNER_BUCKET = "theme";

export async function uploadBannerImage(
  storagePath: "admin-banner" | "client-banner",
  dataUrl: string
): Promise<string> {
  const oid = getOrganizationId();
  const path = `organizations/${oid}/theme/${storagePath}`;
  const blob = dataUrlToBlob(dataUrl);
  await supabase.storage.from(BANNER_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || "image/png",
  });
  const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);
  // cache-bust so the freshly uploaded image is shown immediately
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function deleteBannerImage(
  storagePath: "admin-banner" | "client-banner"
): Promise<void> {
  const oid = getOrganizationId();
  const path = `organizations/${oid}/theme/${storagePath}`;
  await supabase.storage.from(BANNER_BUCKET).remove([path]).catch(() => {});
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(header);
  const mime = mimeMatch?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
