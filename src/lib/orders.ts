import { z } from "zod";
import { optional, param, type SearchParams } from "@/lib/fields";
import { can, type Role } from "@/lib/permissions";
import { priceSchema } from "@/lib/products";

// Orders (SPEC §5): pure rules shared by the order form and the service.

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Money is worked in paisa so sums of numeric(12,2) strings don't drift.
const paisa = (amount: string) => Math.round(Number(amount) * 100);
const taka = (value: number) => (value / 100).toFixed(2);

// One Work Order per Supplier (SPEC §5.4), lettered A, B, C… in the order
// each Supplier first appears among the lines (SPEC §7).
export function splitWorkOrders<L extends { supplierId: string }>(
  lines: readonly L[],
): { letter: string; supplierId: string; lines: L[] }[] {
  const groups = new Map<string, L[]>();
  for (const line of lines) {
    const group = groups.get(line.supplierId);
    if (group) group.push(line);
    else groups.set(line.supplierId, [line]);
  }
  return [...groups].map(([supplierId, lines], index) => ({
    letter: LETTERS[index]!,
    supplierId,
    lines,
  }));
}

// Quantity × price per piece.
export function lineTotal(price: string, quantity: number): string {
  return taka(paisa(price) * quantity);
}

// Sum of money amounts, worked in paisa.
export function sumAmounts(amounts: readonly string[]): string {
  return taka(amounts.reduce((sum, amount) => sum + paisa(amount), 0));
}

export type OrderTotals = {
  sell: string;
  buy: string;
  margin: string;
  marginPercent: number;
};

// Sell and Buy totals, Margin and Margin % to one decimal (GLOSSARY).
export function orderTotals(
  lines: readonly { sellTotal: string; buyTotal: string }[],
): OrderTotals {
  const sell = lines.reduce((sum, line) => sum + paisa(line.sellTotal), 0);
  const buy = lines.reduce((sum, line) => sum + paisa(line.buyTotal), 0);
  return {
    sell: taka(sell),
    buy: taka(buy),
    margin: taka(sell - buy),
    marginPercent: sell ? Math.round(((sell - buy) * 1000) / sell) / 10 : 0,
  };
}

// The specification documents print (SPEC §8.1): size / thickness / colour /
// print, blanks left out.
export function specText(product: {
  size: string | null;
  thickness: string | null;
  colour: string | null;
  printDetails: string | null;
}): string {
  return [product.size, product.thickness, product.colour, product.printDetails]
    .filter(Boolean)
    .join(" / ");
}

// Whole pieces, more than 0 (SPEC §5.2).
export const quantitySchema = z
  .number("Enter a quantity in pieces.")
  .int("Quantity must be whole pieces.")
  .positive("Quantity must be more than 0.")
  .max(9_999_999, "Quantity is too large.");

const optionalDate = z
  .union([z.iso.date("Enter a valid delivery date."), z.literal("")])
  .optional()
  .transform((value) => value || null);

const lineSchema = z.object({
  productId: z.uuid(),
  quantity: quantitySchema,
  sellPrice: priceSchema.optional(),
  buyPrice: priceSchema.optional(),
});

// An Order's lines: at least one, each Product once (SPEC §5.2).
const linesSchema = <L extends typeof lineSchema>(line: L) =>
  z
    .array(line)
    .min(1, "Add at least one product.")
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "A Product can only be on an Order once.",
    );

// What the order form saves. Names and Suppliers are not sent: the service
// copies them from each Product (SPEC §5.3), prices too unless a line
// overrides them (Admin/Manager only).
export const orderSchema = z.object({
  customerId: z.uuid("Pick a Customer."),
  orderDate: z.iso.date("Enter the order date."),
  deliveryDate: optionalDate,
  customerRef: optional,
  // Blank means the Customer's address.
  deliveryAddress: optional,
  notes: optional,
  invoiceNote: optional,
  items: linesSchema(lineSchema),
});

export type OrderInput = z.input<typeof orderSchema>;

// What the edit form saves (SPEC §5.5). The Customer stays. A line sent with
// its itemId keeps its snapshot, so its prices are sent only when changed;
// one without is new and copied from its Product, even if the same Product
// was removed in this edit (SPEC §5.3). `updatedAt` is the Order's as the
// form loaded it, null if never edited.
export const orderEditSchema = orderSchema.omit({ customerId: true }).extend({
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  items: linesSchema(lineSchema.extend({ itemId: z.uuid().optional() })),
});

export type OrderEditInput = z.input<typeof orderEditSchema>;

// SPEC §6.1, in flow order; mirrors the order_status enum (SPEC §14).
export const ORDER_STATUSES = [
  "created",
  "wo_sent",
  "delivered",
  "invoiced",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// SPEC §6.1 labels.
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  created: "Created",
  wo_sent: "WO Sent",
  delivered: "Delivered",
  invoiced: "Invoiced",
  completed: "Completed",
  cancelled: "Cancelled",
};

// SPEC §6.2.
export const WO_STATUS_LABEL: Record<"pending" | "sent" | "cancelled", string> =
  { pending: "Not sent", sent: "Sent", cancelled: "Cancelled" };

// What the Change status control offers (SPEC §3, §6.4): Staff only later
// steps short of Completed, Admins and Managers any other step. Cancelling
// takes a reason and a cancelled Order is restored instead, so neither is
// offered here.
export function statusTargets(role: Role, from: OrderStatus): OrderStatus[] {
  if (from === "cancelled") return [];
  const rank = ORDER_STATUSES.indexOf(from);
  return ORDER_STATUSES.filter((to, index) => {
    if (to === from || to === "cancelled") return false;
    if (index < rank) return can(role, "changeStatusBackward");
    return to !== "completed" || can(role, "completeOrCancel");
  });
}

// The Order list's search and filters (SPEC §9 /orders). They live in the
// URL so dashboard tiles can link to a filtered list.
export type OrderListFilters = {
  query: string;
  status?: OrderStatus;
  customerId?: string;
  supplierId?: string;
  // Order date, both ends included (YYYY-MM-DD).
  from?: string;
  to?: string;
  page: number;
};

// Reads the list's URL; anything it can't read is left out.
export function orderListFilters(params: SearchParams): OrderListFilters {
  const filters: OrderListFilters = {
    query: typeof params.q === "string" ? params.q.trim() : "",
    status: param(z.enum(ORDER_STATUSES), params.status),
    customerId: param(z.uuid(), params.customer),
    supplierId: param(z.uuid(), params.supplier),
    from: param(z.iso.date(), params.from),
    to: param(z.iso.date(), params.to),
    page: param(z.coerce.number().int().positive(), params.page) ?? 1,
  };
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as OrderListFilters;
}

// The URL for a filtered list; the inverse of orderListFilters.
export function orderListHref(filters: OrderListFilters): string {
  const params = new URLSearchParams({
    ...(filters.query && { q: filters.query }),
    ...(filters.status && { status: filters.status }),
    ...(filters.customerId && { customer: filters.customerId }),
    ...(filters.supplierId && { supplier: filters.supplierId }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    ...(filters.page > 1 && { page: String(filters.page) }),
  });
  return params.size ? `/orders?${params}` : "/orders";
}

// The WO x/y badge, shown while some but not all of an Order's Work Orders
// are sent (SPEC §6.1). `total` leaves out cancelled ones.
export function woProgress({
  sent,
  total,
}: {
  sent: number;
  total: number;
}): string | null {
  return sent > 0 && sent < total ? `WO ${sent}/${total}` : null;
}

// Why an Order can't be edited, or null if it can (SPEC §5.5). Sent
// documents don't stop an edit: editEffects says what it makes stale. A
// locked Order (Invoice sent) keeps its header and document dates too.
export function editBlock(order: {
  status: OrderStatus;
  isLocked: boolean;
}): string | null {
  if (order.status === "cancelled") return "This order is cancelled.";
  if (order.isLocked) return "This order is locked.";
  return null;
}

// What the Work Orders and the Challan print of an Order (SPEC §8.1): the
// rest of a document never changes with an edit.
export type PrintedLine = {
  supplierId: string;
  productName: string;
  specText: string;
  quantity: number;
  buyPrice: string;
};

export type PrintedOrder = {
  deliveryDate: string | null;
  customerRef: string | null;
  deliveryAddress: string;
  lines: readonly PrintedLine[];
};

// SPEC §6.2; mirrors the wo_status enum (SPEC §14).
export type WorkOrderStatus = "pending" | "sent" | "cancelled";

type EditedWorkOrder = { supplierId: string; status: WorkOrderStatus };

export type EditEffects<W> = {
  // Sent Work Orders that no longer match: Needs re-send.
  resend: W[];
  // Sent Work Orders whose Supplier has no lines left (SPEC §6.2).
  cancelled: W[];
  // Pending ones in the same spot, simply deleted.
  deleted: W[];
  // The Challan was sent and no longer matches.
  challan: boolean;
};

// What an edit does to the documents already made (SPEC §5.5, §6.2). A
// Work Order prints its Supplier's lines with Buy prices and the required-by
// date; the Challan prints every line without prices, the reference and the
// delivery address. The Invoice is never sent before the Order locks.
export function editEffects<W extends EditedWorkOrder>({
  before,
  after,
  workOrders,
  challanSent,
}: {
  before: PrintedOrder;
  after: PrintedOrder;
  workOrders: readonly W[];
  challanSent: boolean;
}): EditEffects<W> {
  const workOrderPrint = (order: PrintedOrder, supplierId: string) =>
    JSON.stringify([
      order.deliveryDate || null,
      order.lines
        .filter((line) => line.supplierId === supplierId)
        .map((line) => [
          line.productName,
          line.specText,
          line.quantity,
          paisa(line.buyPrice),
        ]),
    ]);
  const challanPrint = (order: PrintedOrder) =>
    JSON.stringify([
      order.customerRef || null,
      order.deliveryAddress,
      order.lines.map((line) => [
        line.productName,
        line.specText,
        line.quantity,
      ]),
    ]);
  const supplied = new Set(after.lines.map((line) => line.supplierId));
  const effects: EditEffects<W> = {
    resend: [],
    cancelled: [],
    deleted: [],
    challan: challanSent && challanPrint(before) !== challanPrint(after),
  };
  for (const wo of workOrders) {
    if (wo.status === "cancelled") continue;
    if (!supplied.has(wo.supplierId))
      (wo.status === "sent" ? effects.cancelled : effects.deleted).push(wo);
    else if (
      wo.status === "sent" &&
      workOrderPrint(before, wo.supplierId) !==
        workOrderPrint(after, wo.supplierId)
    )
      effects.resend.push(wo);
  }
  return effects;
}

// The warning shown before saving (SPEC §5.5): every sent document the
// edit makes stale. Deleting a pending Work Order needs no warning.
export function editWarnings(
  effects: EditEffects<{ woNo: string; supplierName: string }>,
): string[] {
  return [
    ...effects.resend.map(
      (wo) =>
        `${wo.woNo} to ${wo.supplierName} no longer matches and will need re-sending.`,
    ),
    ...effects.cancelled.map(
      (wo) =>
        `${wo.woNo} to ${wo.supplierName} will be cancelled: ${wo.supplierName} has no items left.`,
    ),
    ...(effects.challan
      ? ["The Challan no longer matches and will need re-sending."]
      : []),
  ];
}
