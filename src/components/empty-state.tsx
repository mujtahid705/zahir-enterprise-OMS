import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Faint ZE watermark, one plain line, one next action.
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <Image
        src="/brand/ze-mark-navy.svg"
        alt=""
        width={96}
        height={56}
        className="opacity-[0.08]"
      />
      <p className="text-ink-muted">{message}</p>
      {action && (
        <Button asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
