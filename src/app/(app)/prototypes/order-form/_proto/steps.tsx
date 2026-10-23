"use client";

// PROTOTYPE variant "Steps": one decision per screen. Customer → Items → Review.

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
  lineFrom,
  money,
  pcs,
  supplierName,
  totals,
  type Customer,
  type Line,
  type Product,
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

const STEPS = ["Customer", "Items", "Review"] as const;

export function Steps({ role }: VariantProps) {
  const { productsFor, addProduct } = useCatalogue();
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [details, setDetails] = useState(emptyDetails());
  const [picking, setPicking] = useState(false);
  const [qtyFor, setQtyFor] = useState<Line | null>(null);
  const [newProduct, setNewProduct] = useState(false);
  const [saved, setSaved] = useState(false);

  const pickCustomer = (c: Customer) => {
    if (
      customer &&
      customer.id !== c.id &&
      lines.length &&
      !window.confirm("Changing the customer clears the items. Continue?")
    )
      return;
    if (customer?.id !== c.id) {
      setLines([]);
      setDetails(emptyDetails(c));
    }
    setCustomer(c);
    setStep(1);
  };

  const upsert = (line: Line) =>
    setLines((ls) =>
      ls.some((l) => l.productId === line.productId)
        ? ls.map((l) => (l.productId === line.productId ? line : l))
        : [...ls, line],
    );

  if (saved && customer)
    return (
      <SavedScreen
        customer={customer}
        lines={lines}
        onReset={() => {
          setSaved(false);
          setCustomer(null);
          setLines([]);
          setStep(0);
        }}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 pt-4 pb-40 md:px-8 md:pt-8">
      {/* Progress */}
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const reachable =
            i === 0 || (i === 1 && customer) || (i === 2 && lines.length);
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  i === step ? "font-semibold text-navy" : "text-ink-muted",
                  !reachable && "text-ink-subtle",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-xs",
                    i < step
                      ? "border-navy bg-navy text-white"
                      : i === step
                        ? "border-navy text-navy"
                        : "border-border-strong",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <span className="h-px flex-1 bg-border" />
              )}
            </li>
          );
        })}
      </ol>

      <div
        key={step}
        className="animate-in duration-200 ease-out fade-in-0 slide-in-from-right-2"
      >
        {step === 0 && (
          <CustomerStep selected={customer} onPick={pickCustomer} />
        )}

        {step === 1 && customer && (
          <div className="flex flex-col gap-4">
            <CustomerChip customer={customer} onChange={() => setStep(0)} />
            {lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
                <p className="text-ink-muted">No items yet.</p>
                <Button className="mt-4" onClick={() => setPicking(true)}>
                  <Plus /> Add product
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
                  {lines.map((l) => (
                    <li key={l.productId}>
                      <button
                        type="button"
                        onClick={() => setQtyFor(l)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">
                            {l.name}
                          </p>
                          <p className="truncate text-xs text-ink-muted">
                            {supplierName(l.supplierId)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-ink num">
                            {money(l.sell * l.qty)}
                          </p>
                          <p className="text-xs text-ink-muted num">
                            {pcs(l.qty)}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-ink-subtle" />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" onClick={() => setPicking(true)}>
                  <Plus /> Add another product
                </Button>
              </>
            )}
          </div>
        )}

        {step === 2 && customer && (
          <div className="flex flex-col gap-6">
            <CustomerChip customer={customer} onChange={() => setStep(0)} />
            <section className="flex flex-col gap-3">
              <h2 className="section-label">Work Orders to send</h2>
              <WoPreview lines={lines} />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="section-label">Totals</h2>
              <TotalsBlock
                lines={lines}
                role={role}
                className="rounded-xl border border-border bg-surface p-4"
              />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="section-label">Order details</h2>
              <DetailsFields
                value={details}
                onChange={setDetails}
                idPrefix="steps"
              />
            </section>
          </div>
        )}
      </div>

      {/* Product picker */}
      {customer && (
        <ProductPicker
          open={picking}
          onOpenChange={setPicking}
          products={productsFor(customer.id)}
          taken={new Set(lines.map((l) => l.productId))}
          role={role}
          onPick={(p) => {
            setPicking(false);
            setQtyFor(lineFrom(p));
          }}
          onNewProduct={() => {
            setPicking(false);
            setNewProduct(true);
          }}
        />
      )}

      {/* Quantity */}
      <QuantitySheet
        line={qtyFor}
        role={role}
        isNew={!!qtyFor && !lines.some((l) => l.productId === qtyFor.productId)}
        onClose={() => setQtyFor(null)}
        onSave={(l) => {
          upsert(l);
          setQtyFor(null);
        }}
        onRemove={(l) => {
          setLines((ls) => ls.filter((x) => x.productId !== l.productId));
          setQtyFor(null);
        }}
      />

      {customer && (
        <NewProductSheet
          open={newProduct}
          onOpenChange={setNewProduct}
          customer={customer}
          onCreate={(p) => setQtyFor(lineFrom(addProduct(p)))}
        />
      )}

      {/* Footer */}
      {step > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface md:bottom-0 md:left-[72px] xl:left-[248px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3 md:px-8">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Back"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy num">
                {money(totals(lines).sell)}
              </p>
              <p className="text-xs text-ink-muted">
                {lines.length} {lines.length === 1 ? "item" : "items"}
              </p>
            </div>
            {step === 1 ? (
              <Button disabled={!lines.length} onClick={() => setStep(2)}>
                Review <ChevronRight />
              </Button>
            ) : (
              <Button onClick={() => setSaved(true)}>Save order</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerStep({
  selected,
  onPick,
}: {
  selected: Customer | null;
  onPick: (c: Customer) => void;
}) {
  const [q, setQ] = useState("");
  const list = CUSTOMERS.filter((c) =>
    `${c.name} ${c.code} ${c.phone}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-navy">
        Who is this order for?
      </h2>
      <SearchInput value={q} onChange={setQ} placeholder="Search customers" />
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{c.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {c.code} · {c.phone}
                </p>
              </div>
              {selected?.id === c.id ? (
                <Check className="size-4 text-navy" />
              ) : (
                <ChevronRight className="size-4 text-ink-subtle" />
              )}
            </button>
          </li>
        ))}
        {!list.length && (
          <li className="px-4 py-6 text-center text-ink-muted">
            No customer matches “{q}”.
          </li>
        )}
      </ul>
    </div>
  );
}

function CustomerChip({
  customer,
  onChange,
}: {
  customer: Customer;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="section-label">Customer</p>
        <p className="truncate font-medium text-ink">{customer.name}</p>
      </div>
      <Button variant="link" className="px-0" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}

function SearchInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
      <Input
        type="search"
        aria-label={props.placeholder}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

function ProductPicker({
  open,
  onOpenChange,
  products,
  taken,
  role,
  onPick,
  onNewProduct,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: Product[];
  taken: Set<string>;
  role: VariantProps["role"];
  onPick: (p: Product) => void;
  onNewProduct: () => void;
}) {
  const [q, setQ] = useState("");
  const list = products.filter((p) =>
    `${p.name} ${p.spec} ${p.code}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85dvh] gap-3 rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)] sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="text-lg text-navy">Add product</SheetTitle>
          <SheetDescription>
            Only this customer’s products are listed.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search products"
          />
        </div>
        <ul className="flex-1 overflow-y-auto px-2">
          {list.map((p) => {
            const added = taken.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-canvas disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {p.spec} · {supplierName(p.supplierId)}
                    </p>
                  </div>
                  <span className="text-sm text-ink-muted num">
                    {added ? "Added" : `${money(p.sell)}/pc`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-4 pt-3">
          {canAddProduct(role) ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={onNewProduct}
            >
              <Plus /> New product for this customer
            </Button>
          ) : (
            <MissingProductHint />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const QUICK = [500, 1000, 2000, 5000, 10000];

function QuantitySheet({
  line,
  role,
  isNew,
  onClose,
  onSave,
  onRemove,
}: {
  line: Line | null;
  role: VariantProps["role"];
  isNew: boolean;
  onClose: () => void;
  onSave: (l: Line) => void;
  onRemove: (l: Line) => void;
}) {
  const [qty, setQty] = useState(0);
  const [forId, setForId] = useState<string | null>(null);
  if (line && line.productId !== forId) {
    setForId(line.productId);
    setQty(line.qty);
  }
  if (!line && forId) setForId(null);

  return (
    <Sheet open={!!line} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="gap-4 rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)] sm:mx-auto sm:max-w-lg"
      >
        {line && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="text-lg text-navy">{line.name}</SheetTitle>
              <SheetDescription>
                {line.spec} · {supplierName(line.supplierId)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4">
              <label htmlFor="steps-qty" className="section-label">
                Quantity (pieces)
              </label>
              <Input
                id="steps-qty"
                inputMode="numeric"
                autoFocus
                placeholder="0"
                className="h-14 text-right text-2xl font-semibold num lg:h-14 lg:text-2xl"
                value={qty ? qty.toLocaleString("en-IN") : ""}
                onChange={(e) => setQty(parseQty(e.target.value))}
              />
              <div className="flex flex-wrap gap-2">
                {QUICK.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQty(n)}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm num",
                      qty === n
                        ? "border-navy bg-navy text-white"
                        : "border-border-strong bg-surface text-ink",
                    )}
                  >
                    {n.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
              <dl className="mt-1 flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">
                    Sell · <span className="num">{money(line.sell)}</span>/pc
                  </dt>
                  <dd className="font-medium num">{money(line.sell * qty)}</dd>
                </div>
                {canSeeMargin(role) && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">
                      Buy · <span className="num">{money(line.buy)}</span>/pc
                    </dt>
                    <dd className="num">
                      {money(line.buy * qty)}{" "}
                      <span className="text-brass">
                        (+{money((line.sell - line.buy) * qty)})
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="flex gap-3 px-4">
              {!isNew && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Remove item"
                  onClick={() => onRemove(line)}
                >
                  <Trash2 className="text-danger" />
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={qty <= 0}
                onClick={() => onSave({ ...line, qty })}
              >
                {isNew ? "Add to order" : "Update"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
