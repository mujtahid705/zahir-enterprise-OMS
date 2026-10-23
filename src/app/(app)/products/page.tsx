import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return <PlaceholderPage title="Products" message="No products yet" />;
}
