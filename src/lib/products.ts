import { z } from "zod";
import { optional, required } from "@/lib/fields";

// Products (SPEC §4.3, §4.4). These schemas validate the forms and, again,
// the service on the server.

// BDT per piece, > 0, at most 2 decimals; stored as numeric(12,2), so the
// parsed value is the string Postgres would hand back ("2.50").
export const priceSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter a price in taka, e.g. 2.50.")
  .regex(/^\d+(\.\d{1,2})?$/, "Use at most 2 decimal places.")
  .refine((value) => Number(value) > 0, "Price must be more than 0.")
  .refine((value) => Number(value) < 1e10, "Price is too large.")
  .transform((value) => Number(value).toFixed(2));

const prices = {
  sellPrice: priceSchema,
  buyPrice: priceSchema,
};

// What a Product's specs and prices are; its Customer is set once, at create.
export const productEditSchema = z.object({
  supplierId: z.uuid("Pick a Supplier."),
  name: required("Enter a name."),
  size: optional,
  thickness: optional,
  colour: optional,
  printDetails: optional,
  description: optional,
  ...prices,
});

export const productSchema = productEditSchema.extend({
  customerId: z.uuid("Pick a Customer."),
});

// Duplicate for another customer: same specs and Supplier, new Customer and
// Sell price; Buy price comes pre-filled but may change.
export const duplicateSchema = z.object({
  customerId: z.uuid("Pick a Customer."),
  ...prices,
});

// What a form sends; blank optional fields may be "" or left out.
export type ProductInput = z.input<typeof productSchema>;
export type ProductEditInput = z.input<typeof productEditSchema>;
export type DuplicateInput = z.input<typeof duplicateSchema>;

export type Margin = { perPiece: string; percent: number };

// Margin per piece and Margin % (GLOSSARY): sell − buy, and its share of sell
// to one decimal. Worked in paisa so 2.10 and 3.00 don't drift.
export function margin(sellPrice: string, buyPrice: string): Margin {
  const sell = Math.round(Number(sellPrice) * 100);
  const paisa = sell - Math.round(Number(buyPrice) * 100);
  return {
    perPiece: (paisa / 100).toFixed(2),
    percent: Math.round((paisa * 1000) / sell) / 10,
  };
}
