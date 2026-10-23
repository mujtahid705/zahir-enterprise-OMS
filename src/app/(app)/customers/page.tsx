import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return <PlaceholderPage title="Customers" message="No customers yet" />;
}
