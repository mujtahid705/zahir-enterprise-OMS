import { EmptyState } from "@/components/empty-state";
import { TopBar } from "@/components/shell/top-bar";

// Scaffold page: top bar plus an empty state until the screen is built.
export function PlaceholderPage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <>
      <TopBar title={title} />
      <main className="flex-1 p-4 md:p-8">
        <EmptyState message={message} action={action} />
      </main>
    </>
  );
}
