import { z } from "zod";
import { optional, required } from "@/lib/fields";

// Customers and Suppliers (SPEC §4.1, §4.2): same fields, same screens. These
// schemas validate the forms and, again, the service on the server.

export const PARTY_KINDS = ["customer", "supplier"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

const fields = {
  name: required("Enter a name."),
  contactPerson: optional,
  phone: required("Enter a phone number."),
  whatsapp: optional,
  email: optional.pipe(z.email("Enter a valid email address.").nullable()),
  address: required("Enter an address."),
  notes: optional,
};

export const customerSchema = z.object(fields);

export const supplierSchema = z.object({
  ...fields,
  whatsapp: required("Enter a WhatsApp number."),
});

// What a form sends; blank optional fields may be "" or left out.
export type PartyInput = z.input<typeof customerSchema>;

export const PARTY = {
  customer: {
    label: "Customer",
    plural: "Customers",
    prefix: "C",
    path: "/customers",
    schema: customerSchema,
    whatsappRequired: false,
  },
  supplier: {
    label: "Supplier",
    plural: "Suppliers",
    prefix: "S",
    path: "/suppliers",
    schema: supplierSchema,
    whatsappRequired: true,
  },
} as const satisfies Record<PartyKind, unknown>;

// List filter by active flag; lists show active records unless asked.
export const PARTY_STATUSES = ["active", "inactive", "all"] as const;
export type PartyStatus = (typeof PARTY_STATUSES)[number];
