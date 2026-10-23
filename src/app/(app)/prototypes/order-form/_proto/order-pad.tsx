"use client";

// PROTOTYPE variant "Order pad": the customer's whole catalogue, type quantities in place.
// Grouped by supplier, so the Work Order split is visible while ordering.

import { useState } from "react";
import { ChevronRight, Plus, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CUSTOMERS,
  SUPPLIERS,
  lineFrom,
  money,
  totals,
  workOrders,
  type Customer,
} from "./data";
import {
  DetailsFields,
  MissingProductHint,
  NewProductSheet,
  SavedScreen,
  TotalsBlock,
  WoPreview,
  canAddProduct,
  canSeeMargin,
  emptyDetails,
  parseQty,
  useCatalogue,
  type VariantProps,
} from "./shared";

export function OrderPad({ role }: VariantProps) {
  const { productsFor, addProduct } = useCatalogue();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [details, setDetails] = useState(emptyDetails());
  const [reviewing, setReviewing] = useState(false);
  const [newProduct, setNewProduct] = useState(false);
  const [saved, setSaved] = useState(false);

  const products = customer ? productsFor(customer.id) : [];
  // Suppliers in catalogue order; lines follow it so WO letters read A, B, C down the page.
  const supplierOrder = [...new Set(products.map((p) => p.supplierId))];
  const lines = supplierOrder
    .flatMap((sid) => products.filter((p) => p.supplierId === sid))
    .filter((p) => qty[p.id] > 0)
    .map((p) => lineFrom(p, qty[p.id]));
  const t = totals(lines);
  const wos = workOrders(lines);
  const letterFor = (supplierId: string) =>
    wos.find((w) => w.supplierId === supplierId)?.letter;

  const pickCustomer = (c: Customer | null) => {
    if (
      lines.length &&
      !window.confirm("Changing the customer clears the items. Continue?")
    )
      return;
    setCustomer(c);
    setQty({});
    setQ("");
    setDetails(emptyDetails(c ?? undefined));
  };

  if (saved && customer)
    return (
      <SavedScreen
        customer={customer}
        lines={lines}
        onReset={() => {
          setSaved(false);
          setCustomer(null);
          setQty({});
        }}
      />
    );

  if (!customer)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-24 md:px-8 md:pt-8">
        <h2 className="section-label">Choose customer</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CUSTOMERS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pickCustomer(c)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left hover:border-border-strong"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-navy">
                  <Store className="size-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {productsFor(c.id).length} products · {c.phone}
                  </p>
                </div>
                <ChevronRight className="size-4 text-ink-subtle" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  const visible = products.filter((p) =>
    `${p.name} ${p.spec} ${p.code}`.toLowerCase().includes(q.toLowerCase()),
  );
  const groups = supplierOrder
    .map((id) => ({
      supplier: SUPPLIERS.find((s) => s.id === id)!,
      items: visible.filter((p) => p.supplierId === id),
    }))
    .filter((g) => g.items.length);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-44 md:px-8 md:pt-8">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="section-label">Order for</p>
          <p className="truncate text-lg font-semibold text-navy">
            {customer.name}
          </p>
        </div>
        <Button variant="secondary" onClick={() => pickCustomer(null)}>
          Change
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
        <Input
          type="search"
          aria-label="Filter products"
          placeholder={`Filter ${products.length} products`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {groups.map(({ supplier, items }) => {
        const letter = letterFor(supplier.id);
        return (
          <section key={supplier.id} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold",
                  letter ? "bg-navy text-white" : "bg-canvas text-ink-subtle",
                )}
              >
                {letter ? `WO ${letter}` : "–"}
              </span>
              <span className="section-label">{supplier.name}</span>
            </h3>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {items.map((p) => {
                const n = qty[p.id] ?? 0;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "relative flex items-center gap-3 px-4 py-3",
                      n > 0 && "bg-[color-mix(in_oklab,var(--navy)_3%,white)]",
                    )}
                  >
                    {n > 0 && (
                      <span className="absolute inset-y-0 left-0 w-[3px] bg-navy" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{p.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {p.spec}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted num">
                        {money(p.sell)}/pc
                        {n > 0 && (
                          <>
                            {" → "}
                            <span className="font-medium text-ink">
                              {money(p.sell * n)}
                            </span>
                            {canSeeMargin(role) && (
                              <span className="text-brass">
                                {" "}
                                · +{money((p.sell - p.buy) * n)}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <Input
                      inputMode="numeric"
                      aria-label={`Quantity of ${p.name}`}
                      placeholder="Qty"
                      className="w-28 shrink-0 text-right num"
                      value={n ? n.toLocaleString("en-IN") : ""}
                      onChange={(e) =>
                        setQty((m) => ({
                          ...m,
                          [p.id]: parseQty(e.target.value),
                        }))
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!groups.length && (
        <p className="py-6 text-center text-ink-muted">
          No product matches “{q}”.
        </p>
      )}

      <div className="pt-2">
        {canAddProduct(role) ? (
          <Button
            variant="link"
            className="px-0"
            onClick={() => setNewProduct(true)}
          >
            <Plus /> New product for {customer.name}
          </Button>
        ) : (
          <MissingProductHint />
        )}
      </div>

      <NewProductSheet
        open={newProduct}
        onOpenChange={setNewProduct}
        customer={customer}
        onCreate={(p) => {
          addProduct(p);
          setQ("");
        }}
      />

      {/* Summary bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 px-4 pb-3 md:bottom-0 md:left-[72px] md:pb-6 xl:left-[248px]">
        <button
          type="button"
          disabled={!lines.length}
          onClick={() => setReviewing(true)}
          className="mx-auto flex w-full max-w-3xl items-center gap-4 rounded-xl bg-navy px-4 py-3 text-left text-white shadow-overlay transition-opacity duration-150 disabled:opacity-60"
        >
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold num">{money(t.sell)}</p>
            <p className="text-xs text-sidebar-text">
              {lines.length
                ? `${lines.length} ${lines.length === 1 ? "item" : "items"} · ${wos.length} Work ${wos.length === 1 ? "Order" : "Orders"}`
                : "Type a quantity to add items"}
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm font-medium">
            Review <ChevronRight className="size-4" />
          </span>
        </button>
      </div>

      <Sheet open={reviewing} onOpenChange={setReviewing}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] gap-5 overflow-y-auto rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)] sm:mx-auto sm:max-w-lg"
        >
          <SheetHeader className="pb-0">
            <SheetTitle className="text-lg text-navy">Review order</SheetTitle>
            <SheetDescription>{customer.name}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4">
            <TotalsBlock lines={lines} role={role} />
            <section className="flex flex-col gap-2">
              <h3 className="section-label">Work Orders to send</h3>
              <WoPreview lines={lines} />
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="section-label">Order details</h3>
              <DetailsFields
                value={details}
                onChange={setDetails}
                idPrefix="pad"
              />
            </section>
            <Button
              onClick={() => {
                setReviewing(false);
                setSaved(true);
              }}
            >
              Save order
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
