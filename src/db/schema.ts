import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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

// Customers and Suppliers share one shape (SPEC §4.1, §4.2); only a
// Supplier's WhatsApp number is required.
function partyColumns({ whatsappRequired }: { whatsappRequired: boolean }) {
  const whatsapp = text("whatsapp");
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone").notNull(),
    whatsapp: whatsappRequired ? whatsapp.notNull() : whatsapp,
    email: text("email"),
    address: text("address").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id),
    updatedBy: uuid("updated_by").references(() => profiles.id),
    ...timestamps,
  };
}

export const customers = pgTable(
  "customers",
  partyColumns({ whatsappRequired: false }),
).enableRLS();

export const suppliers = pgTable(
  "suppliers",
  partyColumns({ whatsappRequired: true }),
).enableRLS();

// A Product belongs to one Customer and is made by one Supplier; prices are
// per piece (SPEC §4.3). No ON DELETE CASCADE: a Customer or Supplier with
// Products can't be deleted.
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    name: text("name").notNull(),
    size: text("size"),
    thickness: text("thickness"),
    colour: text("colour"),
    printDetails: text("print_details"),
    description: text("description"),
    sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull(),
    buyPrice: numeric("buy_price", { precision: 12, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id),
    updatedBy: uuid("updated_by").references(() => profiles.id),
    ...timestamps,
  },
  (t) => [
    index("products_customer_id_idx").on(t.customerId),
    index("products_supplier_id_idx").on(t.supplierId),
    check("products_sell_price_positive", sql`${t.sellPrice} > 0`),
    check("products_buy_price_positive", sql`${t.buyPrice} > 0`),
  ],
).enableRLS();

// Master data codes (C-0001, S-0001, P-0001), one global counter per prefix.
// Not logged: the record that takes the code is.
export const codeSequences = pgTable("code_sequences", {
  prefix: text("prefix").primaryKey(),
  lastValue: integer("last_value").notNull(),
}).enableRLS();

// Order numbers (ORD-2026-0012), one counter per year (SPEC §7). Not logged:
// the Order that takes the number is.
export const numberSequences = pgTable("number_sequences", {
  year: integer("year").primaryKey(),
  lastValue: integer("last_value").notNull(),
}).enableRLS();

// SPEC §5.1, §14. Customer details are copied on so old documents never
// change; updated_at is the optimistic-lock token (SPEC §5.5). Never deleted,
// so nothing cascades from here.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),
    orderNo: text("order_no").notNull().unique(),
    challanNo: text("challan_no").notNull().unique(),
    invoiceNo: text("invoice_no").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerAddress: text("customer_address").notNull(),
    deliveryAddress: text("delivery_address").notNull(),
    orderDate: date("order_date").notNull(),
    deliveryDate: date("delivery_date"),
    customerRef: text("customer_ref"),
    notes: text("notes"),
    invoiceNote: text("invoice_note"),
    status: orderStatus("status").notNull().default("created"),
    statusBeforeCancel: orderStatus("status_before_cancel"),
    cancelReason: text("cancel_reason"),
    isLocked: boolean("is_locked").notNull().default(false),
    challanDate: date("challan_date"),
    invoiceDate: date("invoice_date"),
    challanDownloadedAt: timestamp("challan_downloaded_at", {
      withTimezone: true,
    }),
    invoiceDownloadedAt: timestamp("invoice_downloaded_at", {
      withTimezone: true,
    }),
    challanNeedsResend: boolean("challan_needs_resend")
      .notNull()
      .default(false),
    // Work Order letters handed out so far (A = 1), deleted ones included,
    // so a letter is never reused (SPEC §7).
    woLettersUsed: integer("wo_letters_used").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id),
    updatedBy: uuid("updated_by").references(() => profiles.id),
    ...timestamps,
  },
  (t) => [
    unique("orders_year_seq_unique").on(t.year, t.seq),
    index("orders_status_idx").on(t.status),
    index("orders_customer_id_idx").on(t.customerId),
    index("orders_order_date_idx").on(t.orderDate),
  ],
).enableRLS();

// One per Supplier per Order (SPEC §5.4, §6.2), Supplier details copied on.
// A cancelled WO keeps its letter, and a new one for the same Supplier may
// follow it.
export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    letter: char("letter", { length: 1 }).notNull(),
    woNo: text("wo_no").notNull().unique(),
    supplierName: text("supplier_name").notNull(),
    supplierPhone: text("supplier_phone").notNull(),
    supplierAddress: text("supplier_address").notNull(),
    status: woStatus("status").notNull().default("pending"),
    needsResend: boolean("needs_resend").notNull().default(false),
    woDate: date("wo_date"),
    note: text("note"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelAcknowledgedAt: timestamp("cancel_acknowledged_at", {
      withTimezone: true,
    }),
    cancelAcknowledgedBy: uuid("cancel_acknowledged_by").references(
      () => profiles.id,
    ),
    ...timestamps,
  },
  (t) => [
    unique("work_orders_order_id_letter_unique").on(t.orderId, t.letter),
    uniqueIndex("work_orders_order_id_supplier_id_open_unique")
      .on(t.orderId, t.supplierId)
      .where(sql`${t.status} <> 'cancelled'`),
    index("work_orders_order_id_idx").on(t.orderId),
  ],
).enableRLS();

// One line of an Order (SPEC §5.3): its Supplier, name, spec and prices are
// copied from the Product when added, so later Product changes never reach it.
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    productName: text("product_name").notNull(),
    specText: text("spec_text").notNull(),
    quantity: integer("quantity").notNull(),
    sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull(),
    buyPrice: numeric("buy_price", { precision: 12, scale: 2 }).notNull(),
    sellTotal: numeric("sell_total", {
      precision: 14,
      scale: 2,
    }).generatedAlwaysAs(sql`quantity * sell_price`),
    buyTotal: numeric("buy_total", {
      precision: 14,
      scale: 2,
    }).generatedAlwaysAs(sql`quantity * buy_price`),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("order_items_order_id_product_id_unique").on(t.orderId, t.productId),
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_supplier_id_idx").on(t.supplierId),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check("order_items_sell_price_positive", sql`${t.sellPrice} > 0`),
    check("order_items_buy_price_positive", sql`${t.buyPrice} > 0`),
  ],
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
