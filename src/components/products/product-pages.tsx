import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ChevronLeft, Copy, Plus } from "lucide-react";
import { z } from "zod";
import {
  deleteProductAction,
  setProductActiveAction,
} from "@/actions/products";
import { DeactivatedBadge } from "@/components/deactivated-badge";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import {
  DetailTabs,
  RecordHistory,
  historyTab,
} from "@/components/activity/record-history";
import { RecordActions } from "@/components/record-actions";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getCurrentUser, requireRole, type CurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PARTY_STATUSES, type PartyStatus } from "@/lib/parties";
import { PERMISSIONS, can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { customers, suppliers } from "@/services/parties";
import { MASTER_DATA_PAGE_SIZE } from "@/services/master-data";
import { products } from "@/services/products";
import { DuplicateForm, ProductForm } from "./product-form";
import { ProductsTable } from "./products-table";

// The Product screens (SPEC §9): list, detail, new, edit, duplicate. Each
// route's page.tsx renders one of these.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const STATUS_LABEL: Record<PartyStatus, string> = {
  active: "Active",
  inactive: "Deactivated",
  all: "All",
};

function Page({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar title="Products" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>{children}</Suspense>
      </main>
    </>
  );
}

function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-navy"
    >
      <ChevronLeft className="size-4" strokeWidth={1.5} />
      {children}
    </Link>
  );
}

const uuidOrUndefined = z.uuid().optional().catch(undefined);

// Loads the Product for a detail page; 404 for a bad or unknown id.
async function loadProduct(params: IdParams, actor: CurrentUser) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const product = await products.get(actor, id);
  if (!product) notFound();
  return product;
}

export function ProductListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Page>
      <ProductList searchParams={searchParams} />
    </Page>
  );
}

async function ProductList({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getCurrentUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = z.enum(PARTY_STATUSES).catch("active").parse(params.status);
  const customerId = uuidOrUndefined.parse(params.customer);
  const supplierId = uuidOrUndefined.parse(params.supplier);
  const page = Math.max(1, Number(params.page) || 1);
  const [{ rows, total }, customerOptions, supplierOptions] = await Promise.all(
    [
      products.list(actor, { query, status, customerId, supplierId, page }),
      customers.options(actor),
      suppliers.options(actor),
    ],
  );
  const pages = Math.max(1, Math.ceil(total / MASTER_DATA_PAGE_SIZE));
  const canEdit = can(actor.role, "manageMasterData");
  const filtered = query || customerId || supplierId;
  const href = (changes: { status?: PartyStatus; page?: number }) => {
    const next = { status, page: 1, ...changes };
    return `/products?${new URLSearchParams({
      ...(query && { q: query }),
      ...(customerId && { customer: customerId }),
      ...(supplierId && { supplier: supplierId }),
      ...(next.status !== "active" && { status: next.status }),
      ...(next.page > 1 && { page: String(next.page) }),
    })}`;
  };

  if (total === 0 && !filtered && status === "active") {
    return (
      <EmptyState
        message="No products yet"
        action={
          canEdit
            ? { label: "Add first product", href: "/products/new" }
            : undefined
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          role="search"
          className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] lg:max-w-3xl"
        >
          <Label htmlFor="q" className="sr-only">
            Search Products
          </Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search code or name"
          />
          <Label htmlFor="customer" className="sr-only">
            Customer
          </Label>
          <NativeSelect
            id="customer"
            name="customer"
            defaultValue={customerId ?? ""}
          >
            <option value="">All customers</option>
            {customerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
          <Label htmlFor="supplier" className="sr-only">
            Supplier
          </Label>
          <NativeSelect
            id="supplier"
            name="supplier"
            defaultValue={supplierId ?? ""}
          >
            <option value="">All suppliers</option>
            {supplierOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
          {status !== "active" && (
            <input type="hidden" name="status" value={status} />
          )}
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
        {canEdit && (
          <Button asChild>
            <Link href="/products/new">
              <Plus strokeWidth={1.5} />
              Add Product
            </Link>
          </Button>
        )}
      </div>

      <nav aria-label="Filter" className="flex gap-1 text-sm">
        {PARTY_STATUSES.map((value) => (
          <Link
            key={value}
            href={href({ status: value })}
            aria-current={value === status ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1",
              value === status
                ? "border-navy bg-navy text-white"
                : "border-border-strong text-ink-muted hover:text-navy",
            )}
          >
            {STATUS_LABEL[value]}
          </Link>
        ))}
      </nav>

      <ProductsTable
        rows={rows}
        columns={[
          "customer",
          "supplier",
          "sellPrice",
          "buyPrice",
          ...(can(actor.role, "seeMargin") ? (["margin"] as const) : []),
        ]}
        empty={
          query
            ? `No products match “${query}”.`
            : `No ${STATUS_LABEL[status].toLowerCase()} products.`
        }
      />

      <Pager
        page={page}
        pages={pages}
        total={total}
        noun="Products"
        href={(page) => href({ page })}
      />
    </section>
  );
}

export function ProductDetailPage({
  params,
  searchParams,
}: {
  params: IdParams;
  searchParams: SearchParams;
}) {
  return (
    <Page>
      <ProductDetail params={params} searchParams={searchParams} />
    </Page>
  );
}

async function ProductDetail({
  params,
  searchParams,
}: {
  params: IdParams;
  searchParams: SearchParams;
}) {
  const actor = await getCurrentUser();
  const product = await loadProduct(params, actor);
  const href = `/products/${product.id}`;
  const tab = historyTab(actor, await searchParams, href);

  return (
    <section className="flex max-w-2xl flex-col gap-8">
      <div>
        <BackLink href="/products">Products</BackLink>
        <p className="text-sm text-ink-muted num">{product.code}</p>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          {product.name}
          {!product.isActive && <DeactivatedBadge />}
        </h2>
      </div>

      <DetailTabs label="Product" path={href} tab={tab} />

      {tab.open ? (
        <RecordHistory
          actor={actor}
          scope={{ entityType: "products", entityId: product.id }}
          page={tab.page}
          pageHref={tab.pageHref}
        />
      ) : (
        <ProductDetails actor={actor} product={product} />
      )}
    </section>
  );
}

function ProductDetails({
  actor,
  product,
}: {
  actor: CurrentUser;
  product: Awaited<ReturnType<typeof loadProduct>>;
}) {
  const specs: [string, string | null][] = [
    ["Size", product.size],
    ["Thickness", product.thickness],
    ["Colour", product.colour],
    ["Print details", product.printDetails],
    ["Description", product.description],
  ];
  const parties = [
    { term: "Customer", path: "/customers", party: product.customer },
    { term: "Supplier", path: "/suppliers", party: product.supplier },
  ];

  return (
    <>
      <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 md:p-6">
        {parties.map(({ term, path, party }) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="section-label">{term}</dt>
            <dd>
              <Link
                href={`${path}/${party.id}`}
                className="text-navy hover:underline"
              >
                {party.name}
              </Link>
              {!party.isActive && <DeactivatedBadge className="ml-2" />}
            </dd>
          </div>
        ))}
        {specs.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="section-label">{term}</dt>
            <dd
              className={cn("whitespace-pre-line", !value && "text-ink-subtle")}
            >
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>

      <dl
        aria-label="Prices per piece"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4"
      >
        <Figure term="Sell price / pc">{formatMoney(product.sellPrice)}</Figure>
        <Figure term="Buy price / pc">{formatMoney(product.buyPrice)}</Figure>
        {product.margin && (
          <>
            <Figure term="Margin / pc" accent>
              {formatMoney(product.margin.perPiece)}
            </Figure>
            <Figure term="Margin %" accent>
              {product.margin.percent}%
            </Figure>
          </>
        )}
      </dl>

      {can(actor.role, "manageMasterData") && (
        <RecordActions
          label="Product"
          name={product.name}
          editHref={`/products/${product.id}/edit`}
          isActive={product.isActive}
          setActive={setProductActiveAction.bind(
            null,
            product.id,
            !product.isActive,
          )}
          remove={
            can(actor.role, "deleteMasterData")
              ? deleteProductAction.bind(null, product.id)
              : undefined
          }
        >
          <Button asChild variant="outline">
            <Link href={`/products/${product.id}/duplicate`}>
              <Copy strokeWidth={1.5} />
              Duplicate for another customer
            </Link>
          </Button>
        </RecordActions>
      )}
    </>
  );
}

function Figure({
  term,
  accent = false,
  children,
}: {
  term: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="text-xs text-ink-muted">{term}</dt>
      <dd
        className={cn(
          "text-lg font-semibold num",
          accent ? "text-brass" : "text-navy",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function NewProductPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Page>
      <NewProduct searchParams={searchParams} />
    </Page>
  );
}

// `?customer=<id>` comes from a Customer's Products tab and fixes the
// Customer.
async function NewProduct({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireRole(...PERMISSIONS.manageMasterData);
  const customerId = uuidOrUndefined.parse((await searchParams).customer);
  const [customerOptions, supplierOptions] = await Promise.all([
    customers.options(actor),
    suppliers.options(actor),
  ]);
  const customer = customerOptions.find((option) => option.id === customerId);
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div>
        {customer ? (
          <BackLink href={`/customers/${customer.id}?tab=products`}>
            {customer.name}
          </BackLink>
        ) : (
          <BackLink href="/products">Products</BackLink>
        )}
        <h2 className="text-lg font-semibold text-navy">Add Product</h2>
      </div>
      <ProductForm
        customer={customer}
        customers={customerOptions}
        suppliers={supplierOptions}
      />
    </section>
  );
}

export function EditProductPage({ params }: { params: IdParams }) {
  return (
    <Page>
      <EditProduct params={params} />
    </Page>
  );
}

async function EditProduct({ params }: { params: IdParams }) {
  const actor = await requireRole(...PERMISSIONS.manageMasterData);
  const product = await loadProduct(params, actor);
  const active = await suppliers.options(actor);
  // A deactivated current Supplier stays pickable on its own Product.
  const supplierOptions = active.some((s) => s.id === product.supplier.id)
    ? active
    : [product.supplier, ...active];
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div>
        <BackLink href={`/products/${product.id}`}>{product.name}</BackLink>
        <h2 className="text-lg font-semibold text-navy">
          Edit {product.code} {product.name}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          New prices and Supplier apply only to order lines added afterwards.
        </p>
      </div>
      <ProductForm
        id={product.id}
        values={{ ...product, supplierId: product.supplier.id }}
        customer={product.customer}
        customers={[]}
        suppliers={supplierOptions}
      />
    </section>
  );
}

export function DuplicateProductPage({ params }: { params: IdParams }) {
  return (
    <Page>
      <DuplicateProduct params={params} />
    </Page>
  );
}

async function DuplicateProduct({ params }: { params: IdParams }) {
  const actor = await requireRole(...PERMISSIONS.manageMasterData);
  const product = await loadProduct(params, actor);
  const customerOptions = (await customers.options(actor)).filter(
    (option) => option.id !== product.customer.id,
  );
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div>
        <BackLink href={`/products/${product.id}`}>{product.name}</BackLink>
        <h2 className="text-lg font-semibold text-navy">
          Duplicate {product.code} {product.name}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Same specs, made by {product.supplier.name}, for another customer.
        </p>
      </div>
      <DuplicateForm
        id={product.id}
        buyPrice={product.buyPrice}
        customers={customerOptions}
      />
    </section>
  );
}
