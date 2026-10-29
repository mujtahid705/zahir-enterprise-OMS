import { db, type Db, type Tx } from "@/db/client";
import { activityLog } from "@/db/schema";
import type { Actor } from "@/db/with-user";

// App events: what happens that isn't a table write (SPEC §11.1, ADR 0001).
// Table writes are logged by the log_row_change() trigger instead.
export type EventAction =
  | "status_change"
  | "document_download"
  | "document_share"
  | "document_date_change"
  | "lock"
  | "unlock"
  | "cancel"
  | "restore"
  // A cancelled Work Order's Supplier was told (SPEC §6.2).
  | "cancel_acknowledged"
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "password_reset";

export type ActivityEvent = {
  action: EventAction;
  // null for a failed login or the system.
  user: Actor | null;
  // The record the event is about; defaults to the acting User's profile.
  entity?: { type: string; id: string; label: string };
  // Set for an Order's events, so they show in its history (SPEC §6.4).
  orderId?: string;
  details?: Record<string, unknown>;
};

// Pass the write's transaction so the event commits or rolls back with it.
export async function logEvent(
  { action, user, details, entity, orderId }: ActivityEvent,
  executor: Db | Tx = db,
): Promise<void> {
  const target =
    entity ?? (user && { type: "profiles", id: user.id, label: user.name });
  await executor.insert(activityLog).values({
    kind: "event",
    action,
    userId: user?.id,
    userName: user?.name,
    entityType: target?.type,
    entityId: target?.id,
    entityLabel: target?.label,
    orderId,
    details,
  });
}
