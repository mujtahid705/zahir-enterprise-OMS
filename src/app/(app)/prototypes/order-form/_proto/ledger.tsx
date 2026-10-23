"use client";

// PROTOTYPE variant "Ledger": everything on one scrolling form, lines as cards.

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CUSTOMERS,
  customerById,
  lineFrom,
  money,
  supplierName,
  totals,
  workOrders,
  type Line,
} from "./data";
import {
  DetailsFields,
  Field,
  MissingProductHint,
  NewProductSheet,
  SavedScreen,
  canAddProduct,
  canSeeMargin,
  emptyDetails,
  parseQty,
  selectClass,
  useCatalogue,
  type VariantProps,
} from "./shared";

// A line being edited may not have a product yet.
type Draft = { key: number; line: Line | null };

export function Ledger({ role }: VariantProps) {
  const { productsFor, addProduct } = useCatalogue();
  const [customerId, setCustomerId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [details, setDetails] = useState(emptyDetails());
  const [newProductFor, setNewProductFor] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [nextKey, setNextKey] = useState(1);

  const customer = customerById(customerId);
  const lines = drafts.flatMap((d) => (d.line ? [d.line] : []));
  const t = totals(lines);
  const valid = customer && lines.length > 0 && lines.every((l) => l.qty > 0);

  const addDraft = () => {
    setDrafts((ds) => [...ds, { key: nextKey, line: null }]);
    setNextKey((k) => k + 1);
  };
  const updateDraft = (key: number, line: Line | null) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, line } : d)));

  const changeCustomer = (id: string) => {
    if (
      drafts.length &&
      !window.confirm("Changing the customer clears the items. Continue?")
    )
      return;
    setCustomerId(id);
    setDrafts(id ? [{ key: nextKey, line: null }] : []);
    setNextKey((k) => k + 1);
    setDetails(emptyDetails(customerById(id)));
  };

  if (saved && customer)
    return (
      <SavedScreen
        customer={customer}
        lines={lines}
        onReset={() => {
          setSaved(false);
          setCustomerId("");
          setDrafts([]);
        }}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-40 md:px-8 md:pt-8">
      <section className="flex flex-col gap-3">
        <h2 className="section-label">Customer</h2>
        <select
          aria-label="Customer"
          className={selectClass}
          value={customerId}
          onChange={(e) => changeCustomer(e.target.value)}
        >
          <option value="">Select customer…</option>
          {CUSTOMERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {customer && (
          <p className="text-sm text-ink-muted">
            {customer.code} · {customer.phone}
            <br />
            {customer.address}
          </p>
        )}
      </section>

      {customer && (
        <section className="flex flex-col gap-3">
          <h2 className="section-label">Items</h2>
          {drafts.map((d, i) => {
            const used = new Set(
              drafts
                .filter((x) => x.key !== d.key)
                .map((x) => x.line?.productId),
            );
            const options = productsFor(customer.id).filter(
              (p) => !used.has(p.id),
            );
            return (
              <div
                key={d.key}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-3 w-5 shrink-0 text-xs text-ink-subtle num">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <select
                      aria-label={`Product, line ${i + 1}`}
                      className={selectClass}
                      value={d.line?.productId ?? ""}
                      onChange={(e) => {
                        const p = options.find((o) => o.id === e.target.value);
                        updateDraft(
                          d.key,
                          p ? lineFrom(p, d.line?.qty ?? 0) : null,
                        );
                      }}
                    >
                      <option value="">Select product…</option>
                      {options.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {d.line && (
                      <p className="truncate text-xs text-ink-muted">
                        {d.line.spec} · {supplierName(d.line.supplierId)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() =>
                      setDrafts((ds) => ds.filter((x) => x.key !== d.key))
                    }
                  >
                    <X className="text-ink-muted" />
                  </Button>
                </div>
                {d.line && (
                  <div className="ml-7 grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                    <Field label="Quantity (pcs)" htmlFor={`qty-${d.key}`}>
                      <Input
                        id={`qty-${d.key}`}
                        inputMode="numeric"
                        placeholder="0"
                        className="text-right num"
                        value={
                          d.line.qty ? d.line.qty.toLocaleString("en-IN") : ""
                        }
                        onChange={(e) =>
                          updateDraft(d.key, {
                            ...d.line!,
                            qty: parseQty(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Amount
                      label="Sell"
                      sub={`${money(d.line.sell)}/pc`}
                      value={d.line.sell * d.line.qty}
                    />
                    {canSeeMargin(role) && (
                      <>
                        <Amount
                          label="Buy"
                          sub={`${money(d.line.buy)}/pc`}
                          value={d.line.buy * d.line.qty}
                        />
                        <Amount
                          label="Margin"
                          value={(d.line.sell - d.line.buy) * d.line.qty}
                          brass
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="secondary" onClick={addDraft}>
              <Plus /> Add item
            </Button>
            {canAddProduct(role) ? (
              <Button
                variant="link"
                className="px-0"
                onClick={() => setNewProductFor(-1)}
              >
                + New product for {customer.name}
              </Button>
            ) : (
              <MissingProductHint />
            )}
          </div>
        </section>
      )}

      {customer && (
        <details className="group rounded-xl border border-border bg-surface">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4">
            <span className="section-label">Order details</span>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              {details.deliveryDate
                ? `Delivery ${details.deliveryDate}`
                : "Dates, reference, notes"}
              <ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-border p-4">
            <DetailsFields
              value={details}
              onChange={setDetails}
              idPrefix="ledger"
            />
          </div>
        </details>
      )}

      {customer && (
        <NewProductSheet
          open={newProductFor !== null}
          onOpenChange={(o) => !o && setNewProductFor(null)}
          customer={customer}
          onCreate={(p) => {
            const created = addProduct(p);
            setDrafts((ds) => {
              const empty = ds.find((d) => !d.line);
              return empty
                ? ds.map((d) =>
                    d === empty ? { ...d, line: lineFrom(created) } : d,
                  )
                : [...ds, { key: nextKey, line: lineFrom(created) }];
            });
            setNextKey((k) => k + 1);
          }}
        />
      )}

      {/* Sticky totals and Save, above the phone tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface md:bottom-0 md:left-[72px] xl:left-[248px]">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 md:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-navy num">
              {money(t.sell)}
            </p>
            <p className="truncate text-xs text-ink-muted num">
              {lines.length} {lines.length === 1 ? "item" : "items"} ·{" "}
              {workOrders(lines).length} WO
              {canSeeMargin(role) && (
                <>
                  {" · "}
                  <span className="text-brass">
                    margin {money(t.margin)} ({(t.marginPct * 100).toFixed(1)}%)
                  </span>
                </>
              )}
            </p>
          </div>
          <Button disabled={!valid} onClick={() => setSaved(true)}>
            Save order
          </Button>
        </div>
      </div>
    </div>
  );
}

function Amount({
  label,
  sub,
  value,
  brass,
}: {
  label: string;
  sub?: string;
  value: number;
  brass?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-right">
      <span className="text-xs text-ink-muted">{label}</span>
      <span
        className={cn(
          "text-sm font-medium num",
          brass ? "text-brass" : "text-ink",
        )}
      >
        {money(value)}
      </span>
      {sub && <span className="text-[11px] text-ink-subtle num">{sub}</span>}
    </div>
  );
}
