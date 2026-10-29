import type { DocumentRef } from "@/lib/documents";
import type { OrderStatus } from "@/lib/orders";

// Sending a document (SPEC §6.3, §8.0, §8.4): pure rules shared by the
// documents panel and the service. Kept apart from @/lib/documents so the
// browser doesn't load the PDF data shapes.

export type SendVia = "download" | "share";

// Flow order (SPEC §6.1). Cancelled is off the flow: nothing moves it.
const RANK: Record<Exclude<OrderStatus, "cancelled">, number> = {
  created: 0,
  wo_sent: 1,
  delivered: 2,
  invoiced: 3,
  completed: 4,
};

// A send only ever moves status forward (SPEC §6.3): re-sending an older
// document never moves it back.
export function forward(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (from === "cancelled" || to === "cancelled") return from;
  return RANK[to] > RANK[from] ? to : from;
}

// What the Share / Download dialog warns about (SPEC §6.3, §8.0). Never
// blocking: the User may continue.
export function sendWarnings({
  ref,
  pendingWorkOrders,
  challanSent,
  locked,
  orderDate,
  today,
  date,
}: {
  ref: DocumentRef;
  pendingWorkOrders: number;
  challanSent: boolean;
  locked: boolean;
  orderDate: string;
  today: string;
  date: string;
}): string[] {
  const warnings: string[] = [];
  if (ref.type === "challan" && pendingWorkOrders > 0)
    warnings.push(
      `${pendingWorkOrders} Work ${pendingWorkOrders === 1 ? "Order" : "Orders"} not sent yet. Continue?`,
    );
  if (ref.type === "invoice" && !challanSent)
    warnings.push("The Challan has not been sent yet. Continue?");
  if (ref.type === "invoice" && !locked)
    warnings.push("Sending the Invoice locks this order.");
  if (date && date < orderDate) warnings.push("Date is before the order date.");
  if (date && date > today) warnings.push("Date is in the future.");
  return warnings;
}

// "Open WhatsApp chat" (SPEC §8.4): text only, a file can't go this way.
// Bangladeshi numbers are stored local (017…); wa.me wants 88017….
export function whatsappLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const number = digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
