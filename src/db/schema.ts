import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// SPEC §14. Every table has RLS on with no anon/authenticated policies
// (SPEC §13.1): the app connects with a server role that bypasses RLS.

export const userRole = pgEnum("user_role", ["admin", "manager", "staff"]);
export const orderStatus = pgEnum("order_status", [
  "created",
  "wo_sent",
  "delivered",
  "invoiced",
  "completed",
  "cancelled",
]);
export const woStatus = pgEnum("wo_status", ["pending", "sent", "cancelled"]);
export const statusSource = pgEnum("status_source", ["auto", "manual"]);
export const documentType = pgEnum("document_type", [
  "work_order",
  "challan",
  "invoice",
]);
export const activityKind = pgEnum("activity_kind", ["data", "event"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
};

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: userRole("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}).enableRLS();

// Single row, enforced by the unique index on a constant.
export const companySettings = pgTable(
  "company_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    logoPath: text("logo_path"),
    signaturePath: text("signature_path"),
    paymentInstructions: text("payment_instructions"),
    defaultWoNote: text("default_wo_note"),
    ...timestamps,
  },
  () => [uniqueIndex("company_settings_singleton").using("btree", sql`(true)`)],
).enableRLS();

// Append-only (SPEC §11.3, ADR 0001). Data rows come from log_row_change();
// event rows are written by the app.
export const activityLog = pgTable(
  "activity_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    txId: bigint("tx_id", { mode: "number" })
      .notNull()
      .default(sql`txid_current()`),
    kind: activityKind("kind").notNull(),
    action: text("action").notNull(),
    userId: uuid("user_id").references(() => profiles.id),
    userName: text("user_name"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    entityLabel: text("entity_label"),
    orderId: uuid("order_id"),
    changes: jsonb("changes"),
    details: jsonb("details"),
  },
  (t) => [
    index("activity_log_occurred_at_idx").on(t.occurredAt.desc()),
    index("activity_log_user_id_occurred_at_idx").on(
      t.userId,
      t.occurredAt.desc(),
    ),
    index("activity_log_entity_idx").on(t.entityType, t.entityId),
    index("activity_log_order_id_idx").on(t.orderId),
    index("activity_log_tx_id_idx").on(t.txId),
  ],
).enableRLS();
