// PROTOTYPE ONLY: in-memory sample data for the order form variants.

export type Supplier = { id: string; name: string };
export type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
};
export type Product = {
  id: string;
  code: string;
  customerId: string;
  supplierId: string;
  name: string;
  spec: string;
  sell: number;
  buy: number;
};
// Snapshot of the Product at the time the line was added (SPEC §5.3).
export type Line = {
  productId: string;
  name: string;
  spec: string;
  supplierId: string;
  sell: number;
  buy: number;
  qty: number;
};

export const lineFrom = (p: Product, qty = 0): Line => ({
  productId: p.id,
  name: p.name,
  spec: p.spec,
  supplierId: p.supplierId,
  sell: p.sell,
  buy: p.buy,
  qty,
});

export const SUPPLIERS: Supplier[] = [
  { id: "s1", name: "Suzinas Poly Industries" },
  { id: "s2", name: "Rahim Plastics" },
  { id: "s3", name: "Dhaka Box & Carton" },
];

export const CUSTOMERS: Customer[] = [
  {
    id: "c1",
    code: "C-0001",
    name: "Highway Sweets",
    phone: "01711-245 880",
    address: "House 12, Road 4, Dhanmondi, Dhaka",
  },
  {
    id: "c2",
    code: "C-0002",
    name: "Bonoful Confectionery",
    phone: "01819-334 120",
    address: "88 Motijheel C/A, Dhaka",
  },
  {
    id: "c3",
    code: "C-0003",
    name: "Mithai Ghor",
    phone: "01552-901 447",
    address: "Station Road, Narayanganj",
  },
  {
    id: "c4",
    code: "C-0004",
    name: "Fresh Bake Ltd",
    phone: "01913-678 002",
    address: "Plot 7, Tejgaon I/A, Dhaka",
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    code: "P-0001",
    customerId: "c1",
    supplierId: "s1",
    name: "Bread poly packet",
    spec: "10 × 14 in · 40 mic · 2-colour print",
    sell: 2.4,
    buy: 1.85,
  },
  {
    id: "p2",
    code: "P-0002",
    customerId: "c1",
    supplierId: "s3",
    name: "Sweet box 1 kg",
    spec: "Duplex board · window lid · gold foil",
    sell: 18.5,
    buy: 14.2,
  },
  {
    id: "p3",
    code: "P-0003",
    customerId: "c1",
    supplierId: "s3",
    name: "Sweet box 500 g",
    spec: "Duplex board · 4-colour print",
    sell: 12,
    buy: 9.1,
  },
  {
    id: "p4",
    code: "P-0004",
    customerId: "c1",
    supplierId: "s2",
    name: "Carry bag large",
    spec: "16 × 20 in · 60 mic · white",
    sell: 6.75,
    buy: 5.3,
  },
  {
    id: "p5",
    code: "P-0005",
    customerId: "c1",
    supplierId: "s2",
    name: "Carry bag small",
    spec: "10 × 14 in · 50 mic · white",
    sell: 3.9,
    buy: 3.05,
  },
  {
    id: "p6",
    code: "P-0006",
    customerId: "c1",
    supplierId: "s1",
    name: "Rusk packet",
    spec: "8 × 12 in · 35 mic · clear",
    sell: 1.6,
    buy: 1.2,
  },
  {
    id: "p7",
    code: "P-0007",
    customerId: "c2",
    supplierId: "s1",
    name: "Cake poly packet",
    spec: "12 × 16 in · 45 mic · 3-colour",
    sell: 3.2,
    buy: 2.45,
  },
  {
    id: "p8",
    code: "P-0008",
    customerId: "c2",
    supplierId: "s3",
    name: "Cake box 2 lb",
    spec: "Kraft board · handle",
    sell: 24,
    buy: 18.75,
  },
  {
    id: "p9",
    code: "P-0009",
    customerId: "c3",
    supplierId: "s3",
    name: "Mishti box 1 kg",
    spec: "White board · red print",
    sell: 16,
    buy: 12.4,
  },
  {
    id: "p10",
    code: "P-0010",
    customerId: "c3",
    supplierId: "s2",
    name: "Carry bag medium",
    spec: "12 × 16 in · 55 mic",
    sell: 4.8,
    buy: 3.7,
  },
  {
    id: "p11",
    code: "P-0011",
    customerId: "c4",
    supplierId: "s1",
    name: "Toast bag",
    spec: "9 × 18 in · 40 mic · gusset",
    sell: 2.95,
    buy: 2.2,
  },
];

export const supplierName = (id: string) =>
  SUPPLIERS.find((s) => s.id === id)?.name ?? "";
export const customerById = (id: string) => CUSTOMERS.find((c) => c.id === id);

const tk = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const count = new Intl.NumberFormat("en-IN");

export const money = (n: number) => `Tk ${tk.format(n)}`;
export const pcs = (n: number) => `${count.format(n)} pcs`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function totals(lines: Line[]) {
  let sell = 0;
  let buy = 0;
  for (const l of lines) {
    sell += l.sell * l.qty;
    buy += l.buy * l.qty;
  }
  const margin = sell - buy;
  return { sell, buy, margin, marginPct: sell ? margin / sell : 0 };
}

// One WO per distinct supplier, lettered in order of first appearance.
export function workOrders(lines: Line[]) {
  const groups: { supplierId: string; letter: string; lines: Line[] }[] = [];
  for (const l of lines.filter((l) => l.qty > 0)) {
    const sid = l.supplierId;
    let g = groups.find((x) => x.supplierId === sid);
    if (!g) {
      g = {
        supplierId: sid,
        letter: String.fromCharCode(65 + groups.length),
        lines: [],
      };
      groups.push(g);
    }
    g.lines.push(l);
  }
  return groups;
}

export const TODAY = "2026-10-23";
