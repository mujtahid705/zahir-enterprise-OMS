import { lineTotal, sumAmounts } from "@/lib/orders";

// The three documents of an Order (SPEC §8), as plain data the PDFs print.
// Each type carries only the fields its recipient may see: a Work Order has
// Buy prices and never the Customer, the Challan has no prices and no
// Supplier, the Invoice has Sell prices and never Buy prices or Suppliers.

export type DocumentOrder = {
  orderNo: string;
  challanNo: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryAddress: string;
  deliveryDate: string | null;
  customerRef: string | null;
  invoiceNote: string | null;
  challanDate: string | null;
  invoiceDate: string | null;
  items: {
    workOrderId: string;
    productName: string;
    specText: string;
    quantity: number;
    sellPrice: string;
    buyPrice: string;
  }[];
  workOrders: {
    id: string;
    woNo: string;
    supplierName: string;
    supplierPhone: string;
    supplierAddress: string;
    woDate: string | null;
    note: string | null;
  }[];
};

export type DocumentRef =
  | { type: "work_order"; workOrderId: string }
  | { type: "challan" }
  | { type: "invoice" };

export type Recipient = { name: string; address: string; phone: string };

export type DocumentLine = {
  productName: string;
  specText: string;
  quantity: number;
};

export type PricedLine = DocumentLine & { price: string; total: string };

export type WorkOrderDocument = {
  type: "work_order";
  number: string;
  date: string;
  requiredBy: string | null;
  to: Recipient;
  lines: PricedLine[];
  totalQuantity: number;
  total: string;
  note: string | null;
};

export type ChallanDocument = {
  type: "challan";
  number: string;
  date: string;
  orderNo: string;
  customerRef: string | null;
  to: Recipient;
  lines: DocumentLine[];
  totalQuantity: number;
};

export type InvoiceDocument = {
  type: "invoice";
  number: string;
  date: string;
  orderNo: string;
  challanNo: string;
  customerRef: string | null;
  to: Recipient;
  lines: PricedLine[];
  totalQuantity: number;
  total: string;
  note: string | null;
};

export type OrderDocument =
  WorkOrderDocument | ChallanDocument | InvoiceDocument;

// `date` is the one asked for (SPEC §13.2 `?date=`); without it the
// document's stored date applies, or `today` if it was never sent (§8.0).
export function buildDocument(
  order: DocumentOrder,
  ref: DocumentRef,
  { today, date }: { today: string; date?: string },
): { document: OrderDocument; fileName: string } | undefined {
  const { items } = order;
  const totalQuantity = (lines: readonly { quantity: number }[]) =>
    lines.reduce((sum, line) => sum + line.quantity, 0);
  const sumOf = (lines: readonly PricedLine[]) =>
    sumAmounts(lines.map((line) => line.total));
  const priced = (
    item: DocumentOrder["items"][number],
    price: string,
  ): PricedLine => ({
    ...plain(item),
    price,
    total: lineTotal(price, item.quantity),
  });
  const customer = (address: string): Recipient => ({
    name: order.customerName,
    address,
    phone: order.customerPhone,
  });

  if (ref.type === "work_order") {
    const wo = order.workOrders.find((wo) => wo.id === ref.workOrderId);
    if (!wo) return undefined;
    const lines = items
      .filter((item) => item.workOrderId === wo.id)
      .map((item) => priced(item, item.buyPrice));
    return {
      fileName: fileName(wo.woNo, wo.supplierName),
      document: {
        type: "work_order",
        number: wo.woNo,
        date: date ?? wo.woDate ?? today,
        requiredBy: order.deliveryDate,
        to: {
          name: wo.supplierName,
          address: wo.supplierAddress,
          phone: wo.supplierPhone,
        },
        lines,
        totalQuantity: totalQuantity(lines),
        total: sumOf(lines),
        note: wo.note,
      },
    };
  }

  if (ref.type === "challan") {
    const lines = items.map(plain);
    return {
      fileName: fileName(order.challanNo, order.customerName),
      document: {
        type: "challan",
        number: order.challanNo,
        date: date ?? order.challanDate ?? today,
        orderNo: order.orderNo,
        customerRef: order.customerRef,
        to: customer(order.deliveryAddress),
        lines,
        totalQuantity: totalQuantity(lines),
      },
    };
  }

  const lines = items.map((item) => priced(item, item.sellPrice));
  return {
    fileName: fileName(order.invoiceNo, order.customerName),
    document: {
      type: "invoice",
      number: order.invoiceNo,
      date: date ?? order.invoiceDate ?? today,
      orderNo: order.orderNo,
      challanNo: order.challanNo,
      customerRef: order.customerRef,
      to: customer(order.customerAddress),
      lines,
      totalQuantity: totalQuantity(lines),
      total: sumOf(lines),
      note: order.invoiceNote,
    },
  };
}

function plain({
  productName,
  specText,
  quantity,
}: DocumentOrder["items"][number]): DocumentLine {
  return { productName, specText, quantity };
}

// SPEC §8: "WO-2026-0012-A_Suzinas.pdf", "CH-2026-0012_Highway-Sweets.pdf".
export function fileName(number: string, recipient: string): string {
  const name = recipient
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-");
  return `${number}_${name}.pdf`;
}
