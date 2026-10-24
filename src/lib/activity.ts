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
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "password_reset";

export type ActivityEvent = {
  action: EventAction;
  // null for a failed login or the system.
  user: Actor | null;
  details?: Record<string, unknown>;
};

// Auth events are recorded against the user's own profile. Pass the write's
// transaction so the event commits or rolls back with it.
export async function logEvent(
  { action, user, details }: ActivityEvent,
  executor: Db | Tx = db,
): Promise<void> {
  await executor.insert(activityLog).values({
    kind: "event",
    action,
    userId: user?.id,
    userName: user?.name,
    entityType: user ? "profiles" : undefined,
    entityId: user?.id,
    entityLabel: user?.name,
    details,
  });
}
