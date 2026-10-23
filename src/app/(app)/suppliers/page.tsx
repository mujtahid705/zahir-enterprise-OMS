import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page() {
  return <PlaceholderPage title="Suppliers" message="No suppliers yet" />;
}
