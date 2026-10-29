import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { z } from "zod";
import { deletePartyAction, setPartyActiveAction } from "@/actions/parties";
import { DeactivatedBadge } from "@/components/deactivated-badge";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { ProductsTable } from "@/components/products/products-table";
import {
  RecordHistory,
  RecordTabs,
  historyTab,
} from "@/components/activity/record-history";
import { RecordActions } from "@/components/record-actions";
import { RoleGate } from "@/components/role-gate";
import { SearchForm, SearchPending } from "@/components/search-form";
import {
  DetailSkeleton,
  FormSkeleton,
  ListSkeleton,
} from "@/components/skeletons";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, requireRole } from "@/lib/auth";
import {
  PARTY,
  PARTY_STATUSES,
  type PartyKind,
  type PartyStatus,
} from "@/lib/parties";
import { PERMISSIONS, can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PARTIES_PAGE_SIZE, PARTY_SERVICES } from "@/services/parties";
import { products } from "@/services/products";
import { PartyForm } from "./party-form";

// The Customer and Supplier screens (SPEC §9): list, detail, new, edit. Each
// route's page.tsx renders one of these with its kind.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const STATUS_LABEL: Record<PartyStatus, string> = {
  active: "Active",
  inactive: "Deactivated",
  all: "All",
};

function Page({
  title,
  fallback,
  children,
}: {
  title: string;
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar title={title} />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={fallback}>{children}</Suspense>
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

// Loads the record for a detail or edit page; 404 for a bad or unknown id.
async function loadRecord(kind: PartyKind, params: IdParams) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const record = await PARTY_SERVICES[kind].get(actor, id);
  if (!record) notFound();
  return { actor, record };
}

export function PartyListPage({
  kind,
  searchParams,
}: {
  kind: PartyKind;
  searchParams: SearchParams;
}) {
  return (
    <Page title={PARTY[kind].plural} fallback={<ListSkeleton />}>
      <PartyList kind={kind} searchParams={searchParams} />
    </Page>
  );
}

async function PartyList({
  kind,
  searchParams,
}: {
  kind: PartyKind;
  searchParams: SearchParams;
}) {
  const { label, plural, path } = PARTY[kind];
  const actor = await getCurrentUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = z.enum(PARTY_STATUSES).catch("active").parse(params.status);
  const page = Math.max(1, Number(params.page) || 1);
  const { rows, total } = await PARTY_SERVICES[kind].list(actor, {
    query,
    status,
    page,
  });
  const pages = Math.max(1, Math.ceil(total / PARTIES_PAGE_SIZE));
  const canEdit = can(actor.role, "manageMasterData");
  const href = (changes: { status?: PartyStatus; page?: number }) => {
    const next = { status, page: 1, ...changes };
    return `${path}?${new URLSearchParams({
      ...(query && { q: query }),
      ...(next.status !== "active" && { status: next.status }),
      ...(next.page > 1 && { page: String(next.page) }),
    })}`;
  };
  const lower = label.toLowerCase();

  if (total === 0 && !query && status === "active") {
    return (
      <EmptyState
        message={`No ${plural.toLowerCase()} yet`}
        action={
          canEdit
            ? { label: `Add first ${lower}`, href: `${path}/new` }
            : undefined
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm className="w-full max-w-sm">
          <Label htmlFor="q" className="sr-only">
            Search {plural}
          </Label>
          <div className="relative">
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search code, name or phone"
            />
            <SearchPending />
          </div>
          {status !== "active" && (
            <input type="hidden" name="status" value={status} />
          )}
        </SearchForm>
        {canEdit && (
          <Button asChild>
            <Link href={`${path}/new`}>
              <Plus strokeWidth={1.5} />
              Add {label}
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

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="hidden bg-canvas md:table-header-group">
            <tr className="border-b border-border-strong text-left">
              <th className="px-4 py-3 section-label">Code</th>
              <th className="px-4 py-3 section-label">Name</th>
              <th className="px-4 py-3 section-label">Contact person</th>
              <th className="px-4 py-3 section-label">Phone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0 md:table-row md:h-11 md:p-0"
              >
                <td className="text-xs text-ink-muted num md:px-4 md:text-sm">
                  {row.code}
                </td>
                <td className="md:px-4">
                  <Link
                    href={`${path}/${row.id}`}
                    className="font-medium text-navy hover:underline"
                  >
                    {row.name}
                  </Link>
                  {!row.isActive && <DeactivatedBadge className="ml-2" />}
                </td>
                <td className="text-ink-muted md:px-4 md:text-ink">
                  {row.contactPerson}
                </td>
                <td className="text-ink-muted num md:px-4 md:text-ink">
                  {row.phone}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-ink-muted">
            {query
              ? `No ${plural.toLowerCase()} match “${query}”.`
              : `No ${STATUS_LABEL[status].toLowerCase()} ${plural.toLowerCase()}.`}
          </p>
        )}
      </div>

      <Pager
        page={page}
        pages={pages}
        total={total}
        noun={plural}
        href={(page) => href({ page })}
      />
    </section>
  );
}

export function PartyDetailPage({
  kind,
  params,
  searchParams,
}: {
  kind: PartyKind;
  params: IdParams;
  searchParams: SearchParams;
}) {
  return (
    <Page title={PARTY[kind].plural} fallback={<DetailSkeleton />}>
      <PartyDetail kind={kind} params={params} searchParams={searchParams} />
    </Page>
  );
}

const TABS = ["details", "products"] as const;
type Tab = (typeof TABS)[number] | "history";

async function PartyDetail({
  kind,
  params,
  searchParams,
}: {
  kind: PartyKind;
  params: IdParams;
  searchParams: SearchParams;
}) {
  const { label, plural, path } = PARTY[kind];
  const { actor, record } = await loadRecord(kind, params);
  const query = await searchParams;
  const history = historyTab(actor, query, `${path}/${record.id}`);
  const tab: Tab = history.open
    ? "history"
    : z.enum(TABS).catch("details").parse(query.tab);
  const tabs: { value: Tab; label: string }[] = [
    { value: "details", label: "Details" },
    { value: "products", label: "Products" },
    ...(history.allowed
      ? [{ value: "history" as const, label: "History" }]
      : []),
  ];
  const tabHref = (value: Tab) =>
    `${path}/${record.id}${value === "details" ? "" : `?tab=${value}`}`;

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div>
        <BackLink href={path}>{plural}</BackLink>
        <p className="text-sm text-ink-muted num">{record.code}</p>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          {record.name}
          {!record.isActive && <DeactivatedBadge />}
        </h2>
      </div>

      <RecordTabs label={label} tabs={tabs} current={tab} href={tabHref} />

      {tab === "details" && (
        <PartyDetails kind={kind} actor={actor} record={record} />
      )}
      {tab === "products" && (
        <PartyProducts kind={kind} actor={actor} record={record} />
      )}
      {tab === "history" && (
        <RecordHistory
          actor={actor}
          scope={{ entityType: `${kind}s`, entityId: record.id }}
          page={history.page}
          pageHref={history.pageHref}
        />
      )}
    </section>
  );
}

type Loaded = Awaited<ReturnType<typeof loadRecord>>;

function PartyDetails({ kind, actor, record }: { kind: PartyKind } & Loaded) {
  const { label, path } = PARTY[kind];
  const details: [string, string | null][] = [
    ["Contact person", record.contactPerson],
    ["Phone", record.phone],
    ["WhatsApp", record.whatsapp],
    ["Email", record.email],
    ["Address", record.address],
    ["Notes", record.notes],
  ];

  return (
    <>
      <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 md:p-6">
        {details.map(([term, value]) => (
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

      {can(actor.role, "manageMasterData") && (
        <RecordActions
          label={label}
          name={record.name}
          editHref={`${path}/${record.id}/edit`}
          isActive={record.isActive}
          setActive={setPartyActiveAction.bind(
            null,
            kind,
            record.id,
            !record.isActive,
          )}
          remove={
            can(actor.role, "deleteMasterData")
              ? deletePartyAction.bind(null, kind, record.id)
              : undefined
          }
        />
      )}
    </>
  );
}

// SPEC §4.1, §4.2: a Customer's Products (Admin/Manager add here, and see buy
// price and margin), or the Products a Supplier makes (read-only, with buy
// price). The first page; the Product list has the rest.
async function PartyProducts({
  kind,
  actor,
  record,
}: { kind: PartyKind } & Loaded) {
  const filter =
    kind === "customer" ? { customerId: record.id } : { supplierId: record.id };
  const { rows, total } = await products.list(actor, {
    ...filter,
    status: "all",
  });
  // A deactivated Customer is not offered for new Products (SPEC §4.4).
  const canAdd =
    kind === "customer" &&
    record.isActive &&
    can(actor.role, "manageMasterData");
  const seeMargin = can(actor.role, "seeMargin");

  return (
    <div className="flex flex-col gap-4">
      {canAdd && (
        <Button asChild className="self-start">
          <Link href={`/products/new?customer=${record.id}`}>
            <Plus strokeWidth={1.5} />
            Add Product
          </Link>
        </Button>
      )}
      <ProductsTable
        rows={rows}
        columns={
          kind === "customer"
            ? [
                "supplier",
                "sellPrice",
                ...(seeMargin ? (["buyPrice", "margin"] as const) : []),
              ]
            : ["customer", "buyPrice"]
        }
        empty={
          kind === "customer"
            ? "No products for this customer yet."
            : "This supplier makes no products yet."
        }
      />
      {total > rows.length && (
        <Link
          href={`/products?${kind}=${record.id}&status=all`}
          className="text-sm text-navy hover:underline"
        >
          View all {total} in Products
        </Link>
      )}
    </div>
  );
}

export function NewPartyPage({ kind }: { kind: PartyKind }) {
  const { label, plural, path } = PARTY[kind];
  return (
    <Page title={plural} fallback={<FormSkeleton />}>
      <section className="flex max-w-xl flex-col gap-6">
        <div>
          <BackLink href={path}>{plural}</BackLink>
          <h2 className="text-lg font-semibold text-navy">Add {label}</h2>
        </div>
        <RoleGate
          roles={PERMISSIONS.manageMasterData}
          fallback={<FormSkeleton />}
        >
          <PartyForm kind={kind} />
        </RoleGate>
      </section>
    </Page>
  );
}

export function EditPartyPage({
  kind,
  params,
}: {
  kind: PartyKind;
  params: IdParams;
}) {
  return (
    <Page title={PARTY[kind].plural} fallback={<FormSkeleton />}>
      <EditParty kind={kind} params={params} />
    </Page>
  );
}

async function EditParty({
  kind,
  params,
}: {
  kind: PartyKind;
  params: IdParams;
}) {
  await requireRole(...PERMISSIONS.manageMasterData);
  const { record } = await loadRecord(kind, params);
  const { path } = PARTY[kind];
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div>
        <BackLink href={`${path}/${record.id}`}>{record.name}</BackLink>
        <h2 className="text-lg font-semibold text-navy">
          Edit {record.code} {record.name}
        </h2>
      </div>
      <PartyForm kind={kind} id={record.id} values={record} />
    </section>
  );
}
