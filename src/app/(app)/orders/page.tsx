import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Orders"
      message="No orders yet"
      action={{ label: "Create first order", href: "/orders/new" }}
    />
  );
}
