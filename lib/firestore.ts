/**
 * Data service dispatcher.
 *
 * The app calls these functions without knowing which backend is live.
 * The backend is selected at BUILD TIME by NEXT_PUBLIC_BACKEND:
 *   - "supabase" → lib/data/supabase-impl.ts  (AAC/Axis deployment)
 *   - anything else (default) → lib/data/firebase-impl.ts  (original deployment)
 *
 * Both impls export the same public surface, so pages stay backend-agnostic.
 * NEXT_PUBLIC_* vars are inlined at build time, so this branch is resolved
 * during `next build` and the unused backend is tree-shaken away.
 */

import * as firebaseImpl from "./data/firebase-impl";
import * as supabaseImpl from "./data/supabase-impl";

const impl =
  process.env.NEXT_PUBLIC_BACKEND === "supabase" ? supabaseImpl : firebaseImpl;

// ─── Types (identical across impls) ───────────────────────────────────────────

export type { AuditAction, AuditEntry } from "./data/firebase-impl";

// ─── Org / company ────────────────────────────────────────────────────────────

export const DEFAULT_ORGANIZATION_ID = impl.DEFAULT_ORGANIZATION_ID;
export const getOrganizationId = impl.getOrganizationId;
export const getCompanyId = impl.getCompanyId;

// ─── Config docs ──────────────────────────────────────────────────────────────

export const getConfigItem = impl.getConfigItem;
export const setConfigItem = impl.setConfigItem;
export const removeConfigItem = impl.removeConfigItem;

// ─── Data arrays ──────────────────────────────────────────────────────────────

export const getDataArray = impl.getDataArray;
export const setDataArray = impl.setDataArray;

// ─── Collections ──────────────────────────────────────────────────────────────

export const getCollectionItems = impl.getCollectionItems;
export const setCollectionItems = impl.setCollectionItems;
export const upsertCollectionItem = impl.upsertCollectionItem;
export const deleteCollectionItem = impl.deleteCollectionItem;

// ─── Audit log ────────────────────────────────────────────────────────────────

export const logAudit = impl.logAudit;
export const getAllAudits = impl.getAllAudits;
export const updateAuditDetails = impl.updateAuditDetails;
export const getAuditsByEntity = impl.getAuditsByEntity;

// ─── Storage ──────────────────────────────────────────────────────────────────

export const uploadBannerImage = impl.uploadBannerImage;
export const deleteBannerImage = impl.deleteBannerImage;
