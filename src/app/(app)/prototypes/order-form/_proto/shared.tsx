"use client";

// PROTOTYPE ONLY: pieces shared by the order form variants.

import { useState, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  PRODUCTS,
  SUPPLIERS,
  TODAY,
  money,
  pcs,
  supplierName,
  totals,
  workOrders,
  type Customer,
  type Line,
  type Product,
} from "./data";

export type Role = "admin" | "manager" | "staff";
export type VariantProps = { role: Role };

export const canSeeMargin = (role: Role) => role !== "staff";
export const canAddProduct = (role: Role) => role !== "staff";

export const selectClass =
  "h-11 w-full appearance-none rounded-lg border border-input bg-surface bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235B6472' stroke-width='1.5'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-[right_12px_center] bg-no-repeat pr-9 pl-3 text-base text-ink lg:h-9 lg:text-sm";

// Whole pieces only.
export const parseQty = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? Math.min(Number(digits), 9_999_999) : 0;
};

export function useCatalogue() {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const addProduct = (p: Omit<Product, "id" | "code">) => {
    const n = products.length + 1;
    const created = {
      ...p,
      id: `new-${n}`,
      code: `P-${String(n).padStart(4, "0")}`,
    };
    setProducts((ps) => [...ps, created]);
    return created;
  };
  const productsFor = (customerId: string) =>
    products.filter((p) => p.customerId === customerId);
  return { productsFor, addProduct };
}

export type Details = {
  orderDate: string;
  deliveryDate: string;
  customerRef: string;
  deliveryAddress: string;
  notes: string;
  invoiceNote: string;
};

export const emptyDetails = (customer?: Customer): Details => ({
  orderDate: TODAY,
  deliveryDate: "",
  customerRef: "",
  deliveryAddress: customer?.address ?? "",
  notes: "",
  invoiceNote: "",
});

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-ink-muted">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

const textareaClass =
  "min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle lg:text-sm";

export function DetailsFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Details;
  onChange: (d: Details) => void;
  idPrefix: string;
}) {
  const set = (k: keyof Details) => (v: string) =>
    onChange({ ...value, [k]: v });
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Order date" htmlFor={id("od")}>
        <Input
          id={id("od")}
          type="date"
          value={value.orderDate}
          onChange={(e) => set("orderDate")(e.target.value)}
        />
      </Field>
      <Field label="Delivery date" htmlFor={id("dd")}>
        <Input
          id={id("dd")}
          type="date"
          value={value.deliveryDate}
          onChange={(e) => set("deliveryDate")(e.target.value)}
        />
      </Field>
      <Field
        label="Customer reference"
        htmlFor={id("ref")}
        className="col-span-2"
      >
        <Input
          id={id("ref")}
          placeholder="Their PO or order number"
          value={value.customerRef}
          onChange={(e) => set("customerRef")(e.target.value)}
        />
      </Field>
      <Field
        label="Delivery address"
        htmlFor={id("addr")}
        className="col-span-2"
      >
        <textarea
          id={id("addr")}
          className={textareaClass}
          value={value.deliveryAddress}
          onChange={(e) => set("deliveryAddress")(e.target.value)}
        />
      </Field>
      <Field
        label="Invoice note"
        htmlFor={id("inv")}
        hint="Printed on the Invoice."
        className="col-span-2"
      >
        <textarea
          id={id("inv")}
          className={textareaClass}
          value={value.invoiceNote}
          onChange={(e) => set("invoiceNote")(e.target.value)}
        />
      </Field>
      <Field
        label="Notes"
        htmlFor={id("notes")}
        hint="Internal. Never printed."
        className="col-span-2"
      >
        <textarea
          id={id("notes")}
          className={textareaClass}
          value={value.notes}
          onChange={(e) => set("notes")(e.target.value)}
        />
      </Field>
    </div>
  );
}

export function MissingProductHint() {
  return (
    <p className="text-sm text-ink-muted">
      Product missing? Ask a manager to add it.
    </p>
  );
}

export function NewProductSheet({
  open,
  onOpenChange,
  customer,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onCreate: (p: Omit<Product, "id" | "code">) => void;
}) {
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [supplierId, setSupplierId] = useState(SUPPLIERS[0].id);
  const [sell, setSell] = useState("");
  const [buy, setBuy] = useState("");
  const valid = name.trim() && Number(sell) > 0 && Number(buy) > 0;

  const submit = () => {
    if (!valid) return;
    onCreate({
      customerId: customer.id,
      supplierId,
      name: name.trim(),
      spec: spec.trim(),
      sell: Number(sell),
      buy: Number(buy),
    });
    setName("");
    setSpec("");
    setSell("");
    setBuy("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)] sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-lg text-navy">New product</SheetTitle>
          <SheetDescription>
            For {customer.name}. Added to this order.
          </SheetDescription>
        </SheetHeader>
        <form
          className="grid grid-cols-2 gap-4 px-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Name" htmlFor="np-name" className="col-span-2">
            <Input
              id="np-name"
              placeholder="e.g. Laddu box 250 g"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Size / spec" htmlFor="np-spec" className="col-span-2">
            <Input
              id="np-spec"
              placeholder="Size, thickness, colour, print"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
            />
          </Field>
          <Field label="Supplier" htmlFor="np-sup" className="col-span-2">
            <select
              id="np-sup"
              className={selectClass}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              {SUPPLIERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sell price / pc" htmlFor="np-sell">
            <Input
              id="np-sell"
              inputMode="decimal"
              placeholder="0.00"
              className="num"
              value={sell}
              onChange={(e) => setSell(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>
          <Field label="Buy price / pc" htmlFor="np-buy">
            <Input
              id="np-buy"
              inputMode="decimal"
              placeholder="0.00"
              className="num"
              value={buy}
              onChange={(e) => setBuy(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>
          <Button type="submit" className="col-span-2 mt-2" disabled={!valid}>
            Save product and add to order
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function TotalsBlock({
  lines,
  role,
  className,
}: {
  lines: Line[];
  role: Role;
  className?: string;
}) {
  const t = totals(lines);
  return (
    <dl className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <div className="flex justify-between">
        <dt className="text-ink-muted">Sell total</dt>
        <dd className="font-semibold text-ink num">{money(t.sell)}</dd>
      </div>
      {canSeeMargin(role) && (
        <>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Buy total</dt>
            <dd className="text-ink num">{money(t.buy)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Margin</dt>
            <dd className="font-medium text-brass num">
              {money(t.margin)} · {(t.marginPct * 100).toFixed(1)}%
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}

export function WoPreview({ lines }: { lines: Line[] }) {
  const wos = workOrders(lines);
  if (!wos.length) return null;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
      {wos.map((wo) => (
        <li key={wo.supplierId} className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-canvas text-xs font-semibold text-navy">
            {wo.letter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {supplierName(wo.supplierId)}
            </p>
            <p className="text-xs text-ink-muted">
              {wo.lines.length} {wo.lines.length === 1 ? "item" : "items"} ·{" "}
              {pcs(wo.lines.reduce((n, l) => n + l.qty, 0))}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SavedScreen({
  customer,
  lines,
  onReset,
}: {
  customer: Customer;
  lines: Line[];
  onReset: () => void;
}) {
  const wos = workOrders(lines);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <CircleCheck className="size-10 text-success" strokeWidth={1.5} />
      <div>
        <p className="section-label">Order created</p>
        <p className="mt-1 text-2xl font-semibold text-navy">ORD-2026-0013</p>
        <p className="mt-1 text-ink-muted">
          {customer.name} · {money(totals(lines).sell)}
        </p>
      </div>
      <p className="text-sm text-ink-muted">
        {wos.length} Work {wos.length === 1 ? "Order" : "Orders"} ready to send:{" "}
        {wos.map((w) => `WO-2026-0013-${w.letter}`).join(", ")}
      </p>
      <Button variant="secondary" onClick={onReset}>
        Start another order
      </Button>
    </div>
  );
}
