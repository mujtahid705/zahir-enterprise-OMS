import { z } from "zod";
import { optional } from "@/lib/fields";
import { priceSchema } from "@/lib/products";

// Orders (SPEC §5): pure rules shared by the order form and the service.

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: quantitySchema,
        sellPrice: priceSchema.optional(),
        buyPrice: priceSchema.optional(),
      }),
    )
    .min(1, "Add at least one product.")
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "A Product can only be on an Order once.",
    ),
});

export type OrderInput = z.input<typeof orderSchema>;

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

type SearchParams = Record<string, string | string[] | undefined>;

const param = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
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
