import type { DocumentOrder } from "@/lib/documents";

// SPEC §5.4's example Order: two Suzinas lines on WO A, one Rahim Plastics
// line on WO B.
export const highwaySweetsOrder: DocumentOrder = {
  orderNo: "ORD-2026-0012",
  challanNo: "CH-2026-0012",
  invoiceNo: "INV-2026-0012",
  customerName: "Highway Sweets",
  customerPhone: "01711000000",
  customerAddress: "12 Station Road, Dhaka",
  deliveryAddress: "Shop 3, New Market, Dhaka",
  deliveryDate: "2026-10-30",
  customerRef: "PO-77",
  invoiceNote: "Thank you for your business.",
  challanDate: null,
  invoiceDate: "2026-10-25",
  items: [
    {
      workOrderId: "wo-a",
      productName: "Bread poly packet",
      specText: "10×14 in / 40 micron",
      quantity: 5000,
      sellPrice: "2.50",
      buyPrice: "2.00",
    },
    {
      workOrderId: "wo-b",
      productName: "Carry bag large",
      specText: "",
      quantity: 2000,
      sellPrice: "4.00",
      buyPrice: "3.00",
    },
    {
      workOrderId: "wo-a",
      productName: "Sweet box 1 kg",
      specText: "",
      quantity: 1000,
      sellPrice: "8.00",
      buyPrice: "6.00",
    },
  ],
  workOrders: [
    {
      id: "wo-a",
      woNo: "WO-2026-0012-A",
      supplierName: "Suzinas",
      supplierPhone: "01811000000",
      supplierAddress: "Plot 4, Tongi BSCIC",
      woDate: "2026-10-21",
      note: "Deliver in cartons of 500.",
    },
    {
      id: "wo-b",
      woNo: "WO-2026-0012-B",
      supplierName: "Rahim Plastics",
      supplierPhone: "01811000001",
      supplierAddress: "Narayanganj",
      woDate: null,
      note: null,
    },
  ],
};
