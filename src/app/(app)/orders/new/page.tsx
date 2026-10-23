import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "New Order" };

export default function Page() {
  return (
    <PlaceholderPage
      title="New Order"
      message="The order form is not built yet."
    />
  );
}
