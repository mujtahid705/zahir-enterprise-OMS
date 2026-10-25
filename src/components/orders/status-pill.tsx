import { cn } from "@/lib/utils";
import type { OrderView } from "@/services/orders";

type OrderStatus = OrderView["status"];

// SPEC §6.1 labels.
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  created: "Created",
  wo_sent: "WO Sent",
  delivered: "Delivered",
  invoiced: "Invoiced",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TONE: Record<OrderStatus, string> = {
  created: "bg-(--status-created-bg) text-(--status-created-fg)",
  wo_sent: "bg-(--status-wo-sent-bg) text-(--status-wo-sent-fg)",
  delivered: "bg-(--status-delivered-bg) text-(--status-delivered-fg)",
  invoiced: "bg-(--status-invoiced-bg) text-(--status-invoiced-fg)",
  completed: "bg-(--status-completed-bg) text-(--status-completed-fg)",
  cancelled: "bg-(--status-cancelled-bg) text-(--status-cancelled-fg)",
};

// DESIGN.md §1 status pill: soft tint, dark text, 6px dot in the text colour.
export function StatusPill({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
