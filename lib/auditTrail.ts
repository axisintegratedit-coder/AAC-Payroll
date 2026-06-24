export type {
  AuditAction,
  AuditEntry,
} from "./firestore";
import { auth } from "./firebase";

export {
  logAudit,
  getAllAudits,
  updateAuditDetails,
  getAuditsByEntity,
} from "./firestore";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Created",
  EDITED: "Edited",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  UNARCHIVED: "Unarchived",
  EXPORTED: "Exported",
  PRINTED: "Printed",
  SAVED: "Saved",
  RESTORED: "Restored",
  SUBMITTED: "Submitted for Review",
  CHECKED: "Marked as Checked",
  APPROVED: "Approved",
  RETURNED: "Returned for Revision",
  DOWNLOADED: "Downloaded",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function resolveAuditUser(performedById: string): string {
  if (performedById === "__client_portal__") return "Client Portal User";
  const user = auth.currentUser;
  if (user?.uid === performedById) return user.displayName || user.email || performedById;
  return performedById;
}

export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
