/**
 * Firestore data service.
 *
 * All business data lives under /organizations/{organizationId}/.
 * DEFAULT_ORGANIZATION_ID is temporary until the app has an organization picker.
 *
 * Sub-paths:
 *   settings/{key}    — single-object settings docs
 *   data/{key}        — arrays stored as { items: T[] }
 *   employees/        — collection, one doc per employee
 *   payrollRecords/   — collection
 *   payrollRunApprovals/ — collection
 *   auditTrail/       — collection
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  addDoc,
  serverTimestamp,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";
import { auth } from "../firebase";

// ─── Organization ID resolution ───────────────────────────────────────────────

export const DEFAULT_ORGANIZATION_ID = "default-org";

export function getOrganizationId(): string {
  return DEFAULT_ORGANIZATION_ID;
}

export function getCompanyId(): string {
  return getOrganizationId();
}

// ─── Firestore path helpers ───────────────────────────────────────────────────

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

const COLLECTION_BACKED_CONFIG_KEYS = new Set([
  "payrollRunApprovals",
]);

function resolveCollectionName(name: string) {
  return COLLECTION_KEY_MAP[name] ?? name;
}

function configDoc(organizationId: string, key: string) {
  return doc(db, "organizations", organizationId, "settings", key);
}

function dataDoc(organizationId: string, key: string) {
  return doc(db, "organizations", organizationId, "data", key);
}

function coll(organizationId: string, name: string) {
  return collection(db, "organizations", organizationId, resolveCollectionName(name));
}

function collDoc(organizationId: string, collName: string, id: string) {
  return doc(db, "organizations", organizationId, resolveCollectionName(collName), id);
}

function getItemId(item: unknown, fallback: string) {
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

function toFirestoreItem<T>(item: T, fallbackId: string) {
  const id = getItemId(item, fallbackId);
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const { id: _id, ...data } = item as Record<string, unknown>;
    return { id, data };
  }
  return { id, data: { value: item } };
}

async function setCollectionItemsAny<T>(collectionName: string, items: T[]): Promise<void> {
  const oid = getOrganizationId();

  const existing = await getDocs(coll(oid, collectionName));
  const existingIds = existing.docs.map((d) => d.id);
  const CHUNK = 400;
  const ops: Array<{ type: "delete"; id: string } | { type: "set"; id: string; data: Record<string, unknown> }> = [
    ...existingIds.map((id) => ({ type: "delete" as const, id })),
    ...items.map((item, index) => {
      const converted = toFirestoreItem(item, `item-${index}`);
      return { type: "set" as const, id: converted.id, data: converted.data };
    }),
  ];

  for (let i = 0; i < ops.length; i += CHUNK) {
    const chunk = ops.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      if (op.type === "delete") {
        batch.delete(collDoc(oid, collectionName, op.id));
      } else {
        batch.set(collDoc(oid, collectionName, op.id), op.data);
      }
    });
    await batch.commit();
  }

  dispatch(collectionName);
}

async function getCollectionBackedConfig<T>(key: string, fallback: T): Promise<T> {
  if (key !== "payrollRunApprovals") return fallback;
  const rows = await getCollectionItems<Record<string, unknown>>(key);
  if (!rows.length) return fallback;
  return rows.reduce<Record<string, unknown>>((acc, row) => {
    const id = String(row.id ?? "");
    if (id) {
      const { id: _id, ...data } = row;
      acc[id] = data;
    }
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
  await setCollectionItemsAny(key, items);
}

// ─── Dispatch helper (maintains existing reactivity pattern) ──────────────────

function dispatch(key: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(`${key}-updated`));
  }
}

// ─── Config docs — single objects ────────────────────────────────────────────

export async function getConfigItem<T>(key: string, fallback: T): Promise<T> {
  if (COLLECTION_BACKED_CONFIG_KEYS.has(key)) {
    return getCollectionBackedConfig(key, fallback);
  }
  const oid = getOrganizationId();
  try {
    const snap = await getDoc(configDoc(oid, key));
    if (!snap.exists()) return fallback;
    return snap.data() as T;
  } catch {
    return fallback;
  }
}

export async function setConfigItem<T extends object>(key: string, value: T): Promise<void> {
  if (COLLECTION_BACKED_CONFIG_KEYS.has(key)) {
    await setCollectionBackedConfig(key, value);
    dispatch(key);
    return;
  }
  const oid = getOrganizationId();
  await setDoc(configDoc(oid, key), value);
  dispatch(key);
}

export async function removeConfigItem(key: string): Promise<void> {
  const oid = getOrganizationId();
  await deleteDoc(configDoc(oid, key));
  dispatch(key);
}

// ─── Data arrays — { items: T[] } in a single doc ────────────────────────────

export async function getDataArray<T>(key: string, fallback: T[]): Promise<T[]> {
  if (COLLECTION_BACKED_ARRAY_KEYS.has(key)) {
    const items = await getCollectionItems<T | { value: T }>(key);
    if (!items.length) return fallback;
    return items.map((item) => {
      if (item && typeof item === "object" && "value" in item) {
        return (item as { value: T }).value;
      }
      return item as T;
    });
  }
  const oid = getOrganizationId();
  try {
    const snap = await getDoc(dataDoc(oid, key));
    if (!snap.exists()) return fallback;
    return (snap.data()?.items ?? fallback) as T[];
  } catch {
    return fallback;
  }
}

export async function setDataArray<T>(key: string, items: T[]): Promise<void> {
  if (COLLECTION_BACKED_ARRAY_KEYS.has(key)) {
    await setCollectionItemsAny(key, items);
    return;
  }
  const oid = getOrganizationId();
  await setDoc(dataDoc(oid, key), { items });
  dispatch(key);
}

// ─── Collections — one Firestore doc per array item ──────────────────────────

/**
 * Read an entire collection as an array. Each doc's Firestore ID is placed
 * into the `id` field of the returned object.
 */
export async function getCollectionItems<T>(
  collectionName: string
): Promise<T[]> {
  const oid = getOrganizationId();
  try {
    const snap = await getDocs(coll(oid, collectionName));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  } catch {
    return [];
  }
}

/**
 * Replace an entire collection with a new array. Uses a batch write.
 * Handles batches > 500 by chunking.
 */
export async function setCollectionItems<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  const oid = getOrganizationId();

  // Read existing doc IDs for deletion
  const existing = await getDocs(coll(oid, collectionName));
  const existingIds = existing.docs.map((d) => d.id);

  // Chunk everything into batches of 400 (safe under 500 op limit)
  const CHUNK = 400;
  const ops: Array<{ type: "delete"; id: string } | { type: "set"; item: T }> = [
    ...existingIds.map((id) => ({ type: "delete" as const, id })),
    ...items.map((item) => ({ type: "set" as const, item })),
  ];

  for (let i = 0; i < ops.length; i += CHUNK) {
    const chunk = ops.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      if (op.type === "delete") {
        batch.delete(collDoc(oid, collectionName, op.id));
      } else {
        const { id, ...data } = op.item;
        batch.set(collDoc(oid, collectionName, id), data);
      }
    });
    await batch.commit();
  }

  dispatch(collectionName);
}

/** Add or overwrite a single item in a collection (uses item.id as doc ID). */
export async function upsertCollectionItem<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  const oid = getOrganizationId();
  const { id, ...data } = item;
  await setDoc(collDoc(oid, collectionName, id), data);
  dispatch(collectionName);
}

/** Delete a single item from a collection by its id. */
export async function deleteCollectionItem(
  collectionName: string,
  id: string
): Promise<void> {
  const oid = getOrganizationId();
  await deleteDoc(collDoc(oid, collectionName, id));
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

function readCurrentUserUid(): string {
  return auth.currentUser?.uid || "unknown";
}

export async function logAudit(
  entry: Omit<AuditEntry, "id" | "timestamp" | "performedBy"> & { performedBy?: string }
): Promise<void> {
  const oid = getOrganizationId();
  const logEntry: Omit<AuditEntry, "id"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    timestamp: new Date().toISOString(),
    performedBy: entry.performedBy ?? readCurrentUserUid(),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityName: entry.entityName,
    ...(entry.details !== undefined ? { details: entry.details } : {}),
    createdAt: serverTimestamp(),
  };
  try {
    await addDoc(coll(oid, "auditLogs"), logEntry);
  } catch {
    // audit logging must never break the main flow
  }
}

export async function getAllAudits(maxEntries = 5000): Promise<AuditEntry[]> {
  const oid = getOrganizationId();
  try {
    const q = query(coll(oid, "auditLogs"), orderBy("createdAt", "desc"), limit(maxEntries));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry));
  } catch {
    return [];
  }
}

export async function updateAuditDetails(id: string, details: string): Promise<void> {
  const oid = getOrganizationId();
  try {
    await setDoc(collDoc(oid, "auditLogs", id), { details: details.trim() || null }, { merge: true });
  } catch {
    // ignore
  }
}

export async function getAuditsByEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
  const all = await getAllAudits();
  return all.filter((e) => e.entityType === entityType && e.entityId === entityId);
}

// ─── Banner image (Firebase Storage) ─────────────────────────────────────────

/**
 * Uploads a base64 data URL to Firebase Storage and returns the download URL.
 * storagePath differentiates admin vs client-portal images.
 */
export async function uploadBannerImage(
  storagePath: "admin-banner" | "client-banner",
  dataUrl: string
): Promise<string> {
  const oid = getOrganizationId();
  const storageRef = ref(storage, `organizations/${oid}/theme/${storagePath}`);
  await uploadString(storageRef, dataUrl, "data_url");
  return getDownloadURL(storageRef);
}

export async function deleteBannerImage(
  storagePath: "admin-banner" | "client-banner"
): Promise<void> {
  const oid = getOrganizationId();
  const storageRef = ref(storage, `organizations/${oid}/theme/${storagePath}`);
  await deleteObject(storageRef).catch(() => {});
}
