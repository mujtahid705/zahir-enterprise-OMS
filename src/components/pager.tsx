import Link from "next/link";
import { Button } from "@/components/ui/button";

// Previous / Next under a paginated list (SPEC §9: 25 per page). `href`
// builds the link for a page, keeping the list's other filters.
export function Pager({
  page,
  pages,
  total,
  noun,
  href,
}: {
  page: number;
  pages: number;
  total: number;
  noun: string;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-between text-sm text-ink-muted"
    >
      <span className="num">
        Page {page} of {pages} · {total} {noun}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Button asChild variant="outline">
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        )}
        {page < pages && (
          <Button asChild variant="outline">
            <Link href={href(page + 1)}>Next</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
