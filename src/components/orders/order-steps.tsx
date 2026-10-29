"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { createOrderAction, orderProductsAction } from "@/actions/orders";
import { FormNotice } from "@/components/form-notice";
import { OrderProductForm } from "@/components/orders/order-product-form";
import type { Option as SupplierOption } from "@/components/products/product-form";
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
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { formatMoney, formatPieces } from "@/lib/money";
import { lineTotal, orderTotals, splitWorkOrders } from "@/lib/orders";
import { priceSchema } from "@/lib/products";
import { cn } from "@/lib/utils";
import type { CustomerOption, ProductOption } from "@/services/orders";

// The order form, "Steps" (DESIGN.md §7a, SPEC §5.2): Customer → Items →
// Review, one decision per screen. Prices shown here are the Products'
// current ones; the service copies them again when it saves, except prices
// an Admin/Manager changed on the line.

type Prices = Pick<ProductOption, "sellPrice" | "buyPrice">;

// sellPrice/buyPrice are the line's own; `listed` keeps the Product's, so
// only a changed price is sent as an override.
type Line = ProductOption & {
  quantity: number;
  supplierId: string;
  listed: Prices;
};

// The product picker and the New product form: 85% height (DESIGN §7a).
const TALL_SHEET =
  "h-[85dvh] gap-3 rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)] sm:mx-auto sm:max-w-lg";

type Details = {
  orderDate: string;
  deliveryDate: string;
  customerRef: string;
  deliveryAddress: string;
  notes: string;
  invoiceNote: string;
};

const STEPS = ["Customer", "Items", "Review"] as const;

const lineFrom = (product: ProductOption): Line => ({
  ...product,
  supplierId: product.supplier.id,
  quantity: 0,
  listed: { sellPrice: product.sellPrice, buyPrice: product.buyPrice },
});

function totalsOf(lines: readonly Line[]) {
  return orderTotals(
    lines.map((line) => ({
      sellTotal: lineTotal(line.sellPrice, line.quantity),
      buyTotal: lineTotal(line.buyPrice, line.quantity),
    })),
  );
}

const countOf = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

export function OrderSteps({
  customers,
  today,
  seesMargin,
  overridesPrices,
  suppliers,
}: {
  customers: CustomerOption[];
  today: string;
  seesMargin: boolean;
  overridesPrices: boolean;
  // Active Suppliers for "+ New product"; null for roles that can't add one.
  suppliers: SupplierOption[] | null;
}) {
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [catalogue, setCatalogue] = useState<{
    customerId: string;
    products: ProductOption[];
  } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [details, setDetails] = useState<Details>({
    orderDate: today,
    deliveryDate: "",
    customerRef: "",
    deliveryAddress: "",
    notes: "",
    invoiceNote: "",
  });
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [switchTo, setSwitchTo] = useState<CustomerOption | null>(null);
  const [state, setState] = useState<FormState>();
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const products =
    customer && catalogue?.customerId === customer.id
      ? catalogue.products
      : null;

  const chooseCustomer = (next: CustomerOption) => {
    if (next.id !== customer?.id) {
      setLines([]);
      setDetails((d) => ({ ...d, deliveryAddress: next.address }));
      startLoading(async () => {
        const products = await orderProductsAction(next.id);
        setCatalogue({ customerId: next.id, products });
      });
    }
    setCustomer(next);
    setStep(1);
  };

  const pickCustomer = (next: CustomerOption) => {
    if (customer && next.id !== customer.id && lines.length) setSwitchTo(next);
    else chooseCustomer(next);
  };

  const upsert = (line: Line) =>
    setLines((current) =>
      current.some((l) => l.id === line.id)
        ? current.map((l) => (l.id === line.id ? line : l))
        : [...current, line],
    );

  const save = () =>
    startSaving(async () => {
      if (!customer) return;
      setState(
        await createOrderAction({
          customerId: customer.id,
          ...details,
          items: lines.map((line) => ({
            productId: line.id,
            quantity: line.quantity,
            ...(line.sellPrice !== line.listed.sellPrice && {
              sellPrice: line.sellPrice,
            }),
            ...(line.buyPrice !== line.listed.buyPrice && {
              buyPrice: line.buyPrice,
            }),
          })),
        }),
      );
    });

  const reachable = (i: number) =>
    i === 0 || (i === 1 && !!customer) || (i === 2 && lines.length > 0);
  const totals = totalsOf(lines);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col pb-28">
      <nav aria-label="Steps">
        <ol className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable(i)}
                aria-current={i === step ? "step" : undefined}
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  i === step ? "font-semibold text-navy" : "text-ink-muted",
                  !reachable(i) && "text-ink-subtle",
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
          ))}
        </ol>
      </nav>

      <div
        key={step}
        className="animate-in duration-200 ease-out fade-in-0 slide-in-from-right-2 motion-reduce:slide-in-from-right-0"
      >
        {step === 0 && (
          <CustomerStep
            customers={customers}
            selected={customer}
            onPick={pickCustomer}
          />
        )}

        {step === 1 && customer && (
          <div className="flex flex-col gap-4">
            <CustomerChip customer={customer} onChange={() => setStep(0)} />
            {lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
                <p className="text-ink-muted">No items yet.</p>
                <Button className="mt-4" onClick={() => setPicking(true)}>
                  <Plus strokeWidth={1.5} /> Add product
                </Button>
              </div>
            ) : (
              <>
                <ul
                  aria-label="Items"
                  className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface"
                >
                  {lines.map((line) => (
                    <li key={line.id}>
                      <button
                        type="button"
                        onClick={() => setEditing(line)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">
                            {line.name}
                          </p>
                          <p className="truncate text-xs text-ink-muted">
                            {line.supplier.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-ink num">
                            {formatMoney(
                              lineTotal(line.sellPrice, line.quantity),
                            )}
                          </p>
                          <p className="text-xs text-ink-muted num">
                            {formatPieces(line.quantity)}
                          </p>
                        </div>
                        <ChevronRight
                          className="size-4 text-ink-subtle"
                          strokeWidth={1.5}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" onClick={() => setPicking(true)}>
                  <Plus strokeWidth={1.5} /> Add another product
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
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
                {splitWorkOrders(lines).map((wo) => (
                  <li
                    key={wo.supplierId}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-canvas text-xs font-semibold text-navy">
                      {wo.letter}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {wo.lines[0]!.supplier.name}
                      </p>
                      <p className="text-xs text-ink-muted num">
                        {countOf(wo.lines.length, "item")} ·{" "}
                        {formatPieces(
                          wo.lines.reduce((n, line) => n + line.quantity, 0),
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="section-label">Totals</h2>
              <dl className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 text-sm">
                <Row term="Sell total">
                  <span className="font-semibold text-ink">
                    {formatMoney(totals.sell)}
                  </span>
                </Row>
                {seesMargin && (
                  <>
                    <Row term="Buy total">{formatMoney(totals.buy)}</Row>
                    <Row term="Margin">
                      <span className="font-medium text-brass">
                        {formatMoney(totals.margin)} · {totals.marginPercent}%
                      </span>
                    </Row>
                  </>
                )}
              </dl>
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="section-label">Order details</h2>
              <DetailsFields value={details} onChange={setDetails} />
            </section>
            <FormNotice state={state} />
          </div>
        )}
      </div>

      {customer && (
        <ProductPicker
          open={picking}
          onOpenChange={setPicking}
          products={products}
          loading={loading}
          taken={new Set(lines.map((line) => line.id))}
          onPick={(product) => {
            setPicking(false);
            setEditing(lineFrom(product));
          }}
          onNew={
            suppliers &&
            (() => {
              setPicking(false);
              setCreating(true);
            })
          }
        />
      )}

      {customer && suppliers && (
        <Sheet open={creating} onOpenChange={setCreating}>
          <SheetContent side="bottom" className={TALL_SHEET}>
            <SheetHeader className="pb-0">
              <SheetTitle className="text-lg text-navy">New product</SheetTitle>
              <SheetDescription>For {customer.name}.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4">
              <OrderProductForm
                customerId={customer.id}
                suppliers={suppliers}
                onCreated={({ product, products }) => {
                  setCatalogue({ customerId: customer.id, products });
                  setCreating(false);
                  setEditing(lineFrom(product));
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <QuantitySheet
        line={editing}
        seesMargin={seesMargin}
        overridesPrices={overridesPrices}
        isNew={!!editing && !lines.some((line) => line.id === editing.id)}
        onClose={() => setEditing(null)}
        onSave={(line) => {
          upsert(line);
          setEditing(null);
        }}
        onRemove={(line) => {
          setLines((current) => current.filter((l) => l.id !== line.id));
          setEditing(null);
        }}
      />

      <AlertDialog.Root
        open={!!switchTo}
        onOpenChange={(open) => !open && setSwitchTo(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-surface p-6 shadow-overlay">
            <AlertDialog.Title className="text-lg font-semibold text-navy">
              Change customer?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-ink-muted">
              The {countOf(lines.length, "item")} on this order belong to{" "}
              {customer?.name} and will be cleared.
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button onClick={() => switchTo && chooseCustomer(switchTo)}>
                  Change and clear items
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {step > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface md:bottom-0 md:left-[72px] xl:left-[248px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3 md:px-0">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Back"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft strokeWidth={1.5} />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-navy num">
                {formatMoney(totals.sell)}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {countOf(lines.length, "item")}
                {seesMargin && lines.length > 0 && (
                  <span className="num">
                    {" "}
                    · buy {formatMoney(totals.buy)} ·{" "}
                    <span className="text-brass">
                      +{formatMoney(totals.margin)} ({totals.marginPercent}%)
                    </span>
                  </span>
                )}
              </p>
            </div>
            {step === 1 ? (
              <Button disabled={!lines.length} onClick={() => setStep(2)}>
                Review <ChevronRight strokeWidth={1.5} />
              </Button>
            ) : (
              <Button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save order"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="text-ink num">{children}</dd>
    </div>
  );
}

function SearchBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
        strokeWidth={1.5}
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

const matches = (query: string, ...fields: string[]) =>
  fields.join(" ").toLowerCase().includes(query.trim().toLowerCase());

function CustomerStep({
  customers,
  selected,
  onPick,
}: {
  customers: CustomerOption[];
  selected: CustomerOption | null;
  onPick: (customer: CustomerOption) => void;
}) {
  const [query, setQuery] = useState("");
  const list = customers.filter((c) => matches(query, c.name, c.code, c.phone));
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-navy">
        Who is this order for?
      </h2>
      <SearchBox label="Search customers" value={query} onChange={setQuery} />
      <ul
        aria-label="Customers"
        className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface"
      >
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
                <Check className="size-4 text-navy" strokeWidth={1.5} />
              ) : (
                <ChevronRight
                  className="size-4 text-ink-subtle"
                  strokeWidth={1.5}
                />
              )}
            </button>
          </li>
        ))}
        {!list.length && (
          <li className="px-4 py-6 text-center text-ink-muted">
            {query
              ? `No customer matches “${query}”.`
              : "No active customers yet."}
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
  customer: CustomerOption;
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

function ProductPicker({
  open,
  onOpenChange,
  products,
  loading,
  taken,
  onPick,
  onNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[] | null;
  loading: boolean;
  taken: Set<string>;
  onPick: (product: ProductOption) => void;
  // Admin/Manager only; Staff get a hint instead.
  onNew: (() => void) | null;
}) {
  const [query, setQuery] = useState("");
  const list = (products ?? []).filter((p) =>
    matches(query, p.name, p.code, p.specText),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={TALL_SHEET}>
        <SheetHeader className="pb-0">
          <SheetTitle className="text-lg text-navy">Add product</SheetTitle>
          <SheetDescription>
            Only this customer’s products are listed.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <SearchBox
            label="Search products"
            value={query}
            onChange={setQuery}
          />
        </div>
        <ul aria-label="Products" className="flex-1 overflow-y-auto px-2">
          {list.map((product) => {
            const added = taken.has(product.id);
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onPick(product)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-canvas disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {[product.specText, product.supplier.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="text-sm whitespace-nowrap text-ink-muted num">
                    {added ? "Added" : `${formatMoney(product.sellPrice)}/pc`}
                  </span>
                </button>
              </li>
            );
          })}
          {!list.length && (
            <li className="px-3 py-6 text-center text-ink-muted">
              {!products || loading
                ? "Loading products…"
                : query
                  ? `No product matches “${query}”.`
                  : "This customer has no active products."}
            </li>
          )}
        </ul>
        <div className="border-t border-border px-4 pt-3">
          {onNew ? (
            <Button variant="secondary" className="w-full" onClick={onNew}>
              <Plus strokeWidth={1.5} /> New product for this customer
            </Button>
          ) : (
            <p className="text-center text-sm text-ink-muted">
              Product missing? Ask a manager to add it.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const QUICK = [500, 1000, 2000, 5000, 10000];

// Whole pieces only; typing keeps digits and shows them with lakh grouping.
const parseQuantity = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? Math.min(Number(digits), 9_999_999) : 0;
};

function QuantitySheet({
  line,
  seesMargin,
  overridesPrices,
  isNew,
  onClose,
  onSave,
  onRemove,
}: {
  line: Line | null;
  seesMargin: boolean;
  overridesPrices: boolean;
  isNew: boolean;
  onClose: () => void;
  onSave: (line: Line) => void;
  onRemove: (line: Line) => void;
}) {
  const [quantity, setQuantity] = useState(0);
  const [typed, setTyped] = useState<Prices>({ sellPrice: "", buyPrice: "" });
  const [forId, setForId] = useState<string | null>(null);
  // Starts from the line's quantity and prices each time a line opens.
  if (line && line.id !== forId) {
    setForId(line.id);
    setQuantity(line.quantity);
    setTyped({ sellPrice: line.sellPrice, buyPrice: line.buyPrice });
  }
  if (!line && forId) setForId(null);

  // Admin/Manager may change the line's prices (SPEC §5.3); a price that
  // doesn't parse keeps the line's and blocks saving.
  const sell = priceSchema.safeParse(typed.sellPrice);
  const buy = priceSchema.safeParse(typed.buyPrice);
  const priceError = (sell.error ?? buy.error)?.issues[0]?.message;
  const priced = line && {
    ...line,
    quantity,
    sellPrice: sell.data ?? line.sellPrice,
    buyPrice: buy.data ?? line.buyPrice,
  };

  return (
    <Sheet open={!!line} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="gap-4 rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)] sm:mx-auto sm:max-w-lg"
      >
        {line && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (quantity > 0 && !priceError) onSave(priced!);
            }}
          >
            <SheetHeader className="pb-0">
              <SheetTitle className="text-lg text-navy">{line.name}</SheetTitle>
              <SheetDescription>
                {[line.specText, line.supplier.name]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4">
              <Label htmlFor="order-quantity" className="section-label">
                Quantity (pieces)
              </Label>
              <Input
                id="order-quantity"
                inputMode="numeric"
                autoFocus
                placeholder="0"
                className="h-14 text-right text-2xl font-semibold num lg:h-14 lg:text-2xl"
                value={quantity ? quantity.toLocaleString("en-IN") : ""}
                onChange={(e) => setQuantity(parseQuantity(e.target.value))}
              />
              <div className="flex flex-wrap gap-2">
                {QUICK.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={quantity === n}
                    onClick={() => setQuantity(n)}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm num",
                      quantity === n
                        ? "border-navy bg-navy text-white"
                        : "border-border-strong bg-surface text-ink",
                    )}
                  >
                    {n.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
              {overridesPrices && (
                <div className="grid grid-cols-2 gap-3">
                  <PriceInput
                    label="Sell price/pc (Tk)"
                    name="sellPrice"
                    value={typed.sellPrice}
                    listed={line.listed.sellPrice}
                    onChange={(sellPrice) => setTyped({ ...typed, sellPrice })}
                  />
                  <PriceInput
                    label="Buy price/pc (Tk)"
                    name="buyPrice"
                    value={typed.buyPrice}
                    listed={line.listed.buyPrice}
                    onChange={(buyPrice) => setTyped({ ...typed, buyPrice })}
                  />
                </div>
              )}
              <dl className="mt-1 flex flex-col gap-1 text-sm">
                <Row term={`Sell · ${formatMoney(priced!.sellPrice)}/pc`}>
                  <span className="font-medium">
                    {formatMoney(lineTotal(priced!.sellPrice, quantity))}
                  </span>
                </Row>
                {seesMargin && (
                  <Row term={`Buy · ${formatMoney(priced!.buyPrice)}/pc`}>
                    {formatMoney(lineTotal(priced!.buyPrice, quantity))}{" "}
                    <span className="text-brass">
                      (+
                      {formatMoney(totalsOf([priced!]).margin)})
                    </span>
                  </Row>
                )}
              </dl>
              {priceError && (
                <p role="alert" className="text-sm text-danger">
                  {priceError}
                </p>
              )}
            </div>
            <div className="flex gap-3 px-4">
              {!isNew && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Remove item"
                  onClick={() => onRemove(line)}
                >
                  <Trash2 className="text-danger" strokeWidth={1.5} />
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1"
                disabled={quantity <= 0 || !!priceError}
              >
                {isNew ? "Add to order" : "Update"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

// A line's own price, with the Product's shown once it differs.
function PriceInput({
  label,
  name,
  value,
  listed,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  listed: string;
  onChange: (value: string) => void;
}) {
  const id = `order-${name}`;
  const parsed = priceSchema.safeParse(value);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-ink-muted">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        className="text-right num"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {parsed.success && parsed.data !== listed && (
        <p className="text-xs text-ink-subtle num">
          Product price {formatMoney(listed)}
        </p>
      )}
    </div>
  );
}

function DetailsFields({
  value,
  onChange,
}: {
  value: Details;
  onChange: (value: Details) => void;
}) {
  const bind = (name: keyof Details) => ({
    id: `order-${name}`,
    name,
    value: value[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [name]: e.target.value }),
  });
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Order date" htmlFor="order-orderDate">
        <Input type="date" required {...bind("orderDate")} />
      </Field>
      <Field label="Delivery date" htmlFor="order-deliveryDate">
        <Input type="date" {...bind("deliveryDate")} />
      </Field>
      <Field
        label="Customer reference"
        htmlFor="order-customerRef"
        className="col-span-2"
      >
        <Input
          placeholder="Their PO or order number"
          {...bind("customerRef")}
        />
      </Field>
      <Field
        label="Delivery address"
        htmlFor="order-deliveryAddress"
        className="col-span-2"
      >
        <Textarea {...bind("deliveryAddress")} />
      </Field>
      <Field
        label="Invoice note"
        htmlFor="order-invoiceNote"
        hint="Printed on the Invoice."
        className="col-span-2"
      >
        <Textarea {...bind("invoiceNote")} />
      </Field>
      <Field
        label="Notes"
        htmlFor="order-notes"
        hint="Internal. Never printed."
        className="col-span-2"
      >
        <Textarea {...bind("notes")} />
      </Field>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: ReactNode;
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
