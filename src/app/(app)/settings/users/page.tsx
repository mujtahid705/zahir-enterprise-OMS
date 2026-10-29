import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { SearchForm, SearchPending } from "@/components/search-form";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth";
import { PERMISSIONS, ROLE_LABEL } from "@/lib/permissions";
import { USERS_PAGE_SIZE, listUsers } from "@/services/users";
import { DeactivatedBadge } from "@/components/deactivated-badge";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage({
  searchParams,
}: PageProps<"/settings/users">) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-navy">Users</h2>
        <Button asChild>
          <Link href="/settings/users/new">
            <Plus strokeWidth={1.5} />
            Add User
          </Link>
        </Button>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <UserList searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function UserList({
  searchParams,
}: Pick<PageProps<"/settings/users">, "searchParams">) {
  const actor = await requireRole(...PERMISSIONS.manageUsers);
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const page = Math.max(1, Number(params.page) || 1);
  const { users, total } = await listUsers(actor, { query, page });
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const pageHref = (n: number) =>
    `/settings/users?${new URLSearchParams({ ...(query && { q: query }), page: String(n) })}`;

  return (
    <>
      <SearchForm className="max-w-sm">
        <Label htmlFor="q" className="sr-only">
          Search Users
        </Label>
        <div className="relative">
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search name or email"
          />
          <SearchPending />
        </div>
      </SearchForm>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="hidden bg-canvas md:table-header-group">
            <tr className="border-b border-border-strong text-left">
              <th className="px-4 py-3 section-label">Name</th>
              <th className="px-4 py-3 section-label">Email</th>
              <th className="px-4 py-3 section-label">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0 md:table-row md:h-11 md:p-0"
              >
                <td className="md:px-4">
                  <Link
                    href={`/settings/users/${user.id}`}
                    className="font-medium text-navy hover:underline"
                  >
                    {user.fullName}
                  </Link>
                  {!user.isActive && <DeactivatedBadge className="ml-2" />}
                </td>
                <td className="text-ink-muted md:px-4">{user.email}</td>
                <td className="text-ink-muted md:px-4 md:text-ink">
                  {ROLE_LABEL[user.role]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="px-4 py-6 text-center text-ink-muted">
            No Users match “{query}”.
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav
          aria-label="Pages"
          className="flex items-center justify-between text-sm text-ink-muted"
        >
          <span className="num">
            Page {page} of {pages} · {total} Users
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={pageHref(page - 1)}>Previous</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline">
                <Link href={pageHref(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
