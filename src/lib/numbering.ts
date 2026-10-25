// Record numbers and codes (SPEC §7, §4).

// Master data code: prefix and a four-digit, zero-padded counter (C-0001).
export function formatCode(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(4, "0")}`;
}

// YYYY-NNNN: the Order's year and its place in that year's sequence.
const yearSeq = (year: number, seq: number) =>
  `${year}-${String(seq).padStart(4, "0")}`;

// The Order, its Challan and its Invoice share one number (SPEC §7).
export function orderNumbers(year: number, seq: number) {
  const number = yearSeq(year, seq);
  return {
    orderNo: `ORD-${number}`,
    challanNo: `CH-${number}`,
    invoiceNo: `INV-${number}`,
  };
}

// One Work Order per Supplier, lettered A, B, C… within the Order.
export function workOrderNo(year: number, seq: number, letter: string) {
  return `WO-${yearSeq(year, seq)}-${letter}`;
}
