import { z } from "zod";
import { optional } from "@/lib/fields";

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

// What the order form saves. Prices, names and Suppliers are not sent: the
// service copies them from each Product (SPEC §5.3).
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
    .array(z.object({ productId: z.uuid(), quantity: quantitySchema }))
    .min(1, "Add at least one product.")
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "A Product can only be on an Order once.",
    ),
});

export type OrderInput = z.input<typeof orderSchema>;
